// ==================== FIREBASE NOTIFICATIONS FUNCTION (SECURE) ====================
// netlify/functions/firebase-notifications.js

const admin = require('firebase-admin');
const crypto = require('crypto');

// ── Firebase Admin Init ────────────────────────────────────────────────
if (!admin.apps.length) {
    try {
        const sdk = process.env.FIREBASE_ADMIN_SDK
            ? JSON.parse(process.env.FIREBASE_ADMIN_SDK)
            : null;

        if (sdk) {
            admin.initializeApp({
                credential: admin.credential.cert(sdk),
            });
        } else {
            console.warn('⚠️ FIREBASE_ADMIN_SDK is missing or invalid');
            admin.initializeApp();
        }
    } catch (e) {
        console.error('Firebase Admin Init Error:', e.message);
        admin.initializeApp();
    }
}

// ── Constants ───────────────────────────────────────────────────────────
const COMMISSION = 0.05;

// ── Rate Limiter (in-memory) ────────────────────────────────────────────
const _rl = new Map();

function checkRate(uid, max = 20, windowMs = 60000) {
    const now = Date.now();
    const r = _rl.get(uid) || { n: 0, reset: now + windowMs };

    if (now > r.reset) {
        _rl.set(uid, { n: 1, reset: now + windowMs });
        return true;
    }

    if (r.n >= max) return false;

    r.n++;
    _rl.set(uid, r);
    return true;
}

// ── Verify Firebase ID Token ───────────────────────────────────────────
async function verifyToken(header) {
    if (!header?.startsWith('Bearer ')) return null;

    try {
        const token = header.slice(7);
        return await admin.auth().verifyIdToken(token);
    } catch (e) {
        console.warn('Token verification failed:', e.message);
        return null;
    }
}

// ── Get user role ───────────────────────────────────────────────────────
async function getUserRole(uid) {
    try {
        const snap = await admin.firestore().collection('users').doc(uid).get();
        return snap.data()?.role || 'seeker';
    } catch {
        return 'seeker';
    }
}

// ── CORS ────────────────────────────────────────────────────────────────
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
};

// ── MAIN HANDLER ────────────────────────────────────────────────────────
exports.handler = async (event) => {

    // OPTIONS (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS, body: '' };
    }

    // Only POST allowed
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: CORS,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    try {
        // ── AUTH ───────────────────────────────────────────────────────
        const decoded = await verifyToken(event.headers.authorization);
        if (!decoded) {
            return {
                statusCode: 401,
                headers: CORS,
                body: JSON.stringify({ error: 'غير مصرح' }),
            };
        }

        // ── RATE LIMIT ────────────────────────────────────────────────
        if (!checkRate(decoded.uid)) {
            return {
                statusCode: 429,
                headers: CORS,
                body: JSON.stringify({ error: 'تجاوزت الحد المسموح' }),
            };
        }

        const db = admin.firestore();
        const now = admin.firestore.FieldValue.serverTimestamp();
        const { action, data = {} } = JSON.parse(event.body || '{}');

        // ============================================================
        // 📩 SEND NOTIFICATION
        // ============================================================
        if (action === 'sendNotification') {
            if (!data.userId || !data.message) {
                return {
                    statusCode: 400,
                    headers: CORS,
                    body: JSON.stringify({ error: 'Missing userId or message' }),
                };
            }

            await db.collection('notifications').add({
                userId: data.userId,
                title: (data.title || 'إشعار').slice(0, 100),
                message: (data.message || '').slice(0, 500),
                type: ['info', 'order', 'payment', 'refund'].includes(data.type)
                    ? data.type
                    : 'info',
                read: false,
                createdAt: now,
            });

            return {
                statusCode: 200,
                headers: CORS,
                body: JSON.stringify({ success: true }),
            };
        }

        // ============================================================
        // 📦 UPDATE ORDER
        // ============================================================
        if (action === 'updateOrder') {
            const { orderId, status } = data;

            if (!orderId || !status) {
                return {
                    statusCode: 400,
                    headers: CORS,
                    body: JSON.stringify({ error: 'Missing orderId or status' }),
                };
            }

            const orderSnap = await db.collection('orders').doc(orderId).get();

            if (!orderSnap.exists) {
                return {
                    statusCode: 404,
                    headers: CORS,
                    body: JSON.stringify({ error: 'الطلب غير موجود' }),
                };
            }

            const order = orderSnap.data();
            const role = await getUserRole(decoded.uid);

            const canUpdate =
                order.buyerId === decoded.uid ||
                order.sellerId === decoded.uid ||
                role === 'admin';

            if (!canUpdate) {
                return {
                    statusCode: 403,
                    headers: CORS,
                    body: JSON.stringify({ error: 'ليس لديك صلاحية' }),
                };
            }

            const allowed = ['in-progress', 'delivered', 'completed', 'cancelled'];

            if (!allowed.includes(status)) {
                return {
                    statusCode: 400,
                    headers: CORS,
                    body: JSON.stringify({ error: 'حالة غير مسموحة' }),
                };
            }

            await db.collection('orders').doc(orderId).update({
                status,
                updatedAt: now,
            });

            return {
                statusCode: 200,
                headers: CORS,
                body: JSON.stringify({ success: true }),
            };
        }

        // ============================================================
        // 💳 CONFIRM PAYMENT
        // ============================================================
        if (action === 'confirmPayment') {
            const { orderId, paymobTxId } = data;

            if (!orderId || !paymobTxId) {
                return {
                    statusCode: 400,
                    headers: CORS,
                    body: JSON.stringify({ error: 'Missing orderId or paymobTxId' }),
                };
            }

            const orderSnap = await db.collection('orders').doc(orderId).get();

            if (!orderSnap.exists) {
                return {
                    statusCode: 404,
                    headers: CORS,
                    body: JSON.stringify({ error: 'الطلب غير موجود' }),
                };
            }

            const order = orderSnap.data();

            if (order.buyerId !== decoded.uid) {
                return {
                    statusCode: 403,
                    headers: CORS,
                    body: JSON.stringify({ error: 'Forbidden' }),
                };
            }

            await db.collection('orders').doc(orderId).update({
                status: 'in-progress',
                paymentRef: String(paymobTxId),
                escrowLocked: true,
                paidAt: now,
                updatedAt: now,
            });

            if (order.sellerId) {
                await db.collection('notifications').add({
                    userId: order.sellerId,
                    title: 'طلب جديد! 🎉',
                    message: `طلب جديد بقيمة ${order.price} ج.م — ابدأ العمل الآن`,
                    type: 'order',
                    read: false,
                    createdAt: now,
                });
            }

            return {
                statusCode: 200,
                headers: CORS,
                body: JSON.stringify({ success: true }),
            };
        }

        // ============================================================
        // 💰 RELEASE PAYMENT (ADMIN ONLY)
        // ============================================================
        if (action === 'releasePayment') {
            const role = await getUserRole(decoded.uid);

            if (role !== 'admin') {
                return {
                    statusCode: 403,
                    headers: CORS,
                    body: JSON.stringify({ error: 'هذه العملية للإدارة فقط' }),
                };
            }

            const { orderId, sellerId, amount } = data;

            if (!orderId || !sellerId || !amount || isNaN(amount)) {
                return {
                    statusCode: 400,
                    headers: CORS,
                    body: JSON.stringify({ error: 'Missing or invalid fields' }),
                };
            }

            const platformFee = amount * COMMISSION;
            const sellerReceives = +(amount - platformFee).toFixed(2);

            const batch = db.batch();

            batch.set(db.collection('wallets').doc(sellerId), {
                balance: admin.firestore.FieldValue.increment(sellerReceives),
                total: admin.firestore.FieldValue.increment(sellerReceives),
                pending: admin.firestore.FieldValue.increment(-amount),
                updatedAt: now,
            }, { merge: true });

            batch.set(db.collection('transactions').doc(), {
                userId: sellerId,
                type: 'credit',
                amount: sellerReceives,
                platformFee,
                description: `أرباح طلب #${orderId}`,
                orderId,
                createdAt: now,
            });

            batch.update(db.collection('orders').doc(orderId), {
                status: 'completed',
                escrowLocked: false,
                completedAt: now,
                updatedAt: now,
            });

            await batch.commit();

            await db.collection('notifications').add({
                userId: sellerId,
                title: 'تم تحرير مستحقاتك 💰',
                message: `تم إضافة ${sellerReceives} ج.م لمحفظتك`,
                type: 'payment',
                read: false,
                createdAt: now,
            });

            return {
                statusCode: 200,
                headers: CORS,
                body: JSON.stringify({ success: true, sellerReceives }),
            };
        }

        // ============================================================
        // 🔄 REFUND PAYMENT (ADMIN ONLY)
        // ============================================================
        if (action === 'refundPayment') {
            const role = await getUserRole(decoded.uid);

            if (role !== 'admin') {
                return {
                    statusCode: 403,
                    headers: CORS,
                    body: JSON.stringify({ error: 'هذه العملية للإدارة فقط' }),
                };
            }

            const { orderId, buyerId, amount } = data;

            if (!orderId || !buyerId || !amount) {
                return {
                    statusCode: 400,
                    headers: CORS,
                    body: JSON.stringify({ error: 'Missing fields' }),
                };
            }

            const batch = db.batch();

            batch.set(db.collection('wallets').doc(buyerId), {
                balance: admin.firestore.FieldValue.increment(amount),
                total: admin.firestore.FieldValue.increment(amount),
                updatedAt: now,
            }, { merge: true });

            batch.update(db.collection('orders').doc(orderId), {
                status: 'cancelled',
                escrowLocked: false,
                cancelledAt: now,
                updatedAt: now,
            });

            await batch.commit();

            await db.collection('notifications').add({
                userId: buyerId,
                title: 'تم استرداد مبلغك 🔄',
                message: `تم إضافة ${amount} ج.م لمحفظتك`,
                type: 'refund',
                read: false,
                createdAt: now,
            });

            return {
                statusCode: 200,
                headers: CORS,
                body: JSON.stringify({ success: true }),
            };
        }

        // Unknown action
        return {
            statusCode: 400,
            headers: CORS,
            body: JSON.stringify({ error: 'Unknown action' }),
        };

    } catch (err) {
        console.error('firebase-notifications error:', err);

        return {
            statusCode: 500,
            headers: CORS,
            body: JSON.stringify({ error: 'حدث خطأ داخلي' }),
        };
    }
};