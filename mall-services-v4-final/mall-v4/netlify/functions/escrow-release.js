/**
 * escrow-release.js — Server-side Escrow Release — Mall Services v4.0
 * يُستدعى من Admin أو Auto-Release فقط
 */
const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type':                 'application/json',
};
const ok  = b => ({ statusCode: 200, headers: CORS, body: JSON.stringify(b) });
const err = (m, s=400) => ({ statusCode: s, headers: CORS, body: JSON.stringify({ error: m }) });

let admin;
try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
        const sdk = process.env.FIREBASE_ADMIN_SDK ? JSON.parse(process.env.FIREBASE_ADMIN_SDK) : null;
        if (sdk?.project_id) admin.initializeApp({ credential: admin.credential.cert(sdk) });
        else admin.initializeApp();
    }
} catch(e) { console.warn('Firebase Admin:', e.message); }

async function verifyToken(header) {
    if (!header?.startsWith('Bearer ') || !admin) return null;
    try { return await admin.auth().verifyIdToken(header.slice(7)); } catch { return null; }
}

exports.handler = async function(event) {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
    if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

    const user = await verifyToken(event.headers.authorization || event.headers.Authorization);
    if (!user) return err('Unauthorized', 401);

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }

    const { action, orderId } = body;
    if (!orderId) return err('orderId required');
    if (!admin)   return err('Server not configured', 500);

    const db = admin.firestore();
    const FV = admin.firestore.FieldValue;

    if (action === 'release') {
        try {
            const snap = await db.collection('payments')
                .where('orderId', '==', orderId)
                .where('status', '==', 'holding')
                .limit(1).get();
            if (snap.empty) return err('No escrow record found');

            const escrow    = snap.docs[0];
            const data      = escrow.data();
            const feeRate   = parseFloat(process.env.PLATFORM_FEE_PERCENT || '5') / 100;
            const fee       = parseFloat((data.amount * feeRate).toFixed(2));
            const sellerNet = parseFloat((data.amount - fee).toFixed(2));

            const batch = db.batch();
            batch.update(escrow.ref, { status: 'released', releasedAt: FV.serverTimestamp(), platformFee: fee, sellerNet });
            batch.update(db.collection('orders').doc(orderId), { status: 'completed', escrowStatus: 'released', completedAt: FV.serverTimestamp() });
            await batch.commit();

            // Credit seller wallet
            const walletRef = db.collection('wallets').doc(data.sellerId);
            await db.runTransaction(async tx => {
                const w = await tx.get(walletRef);
                if (w.exists) {
                    tx.update(walletRef, { balance: FV.increment(sellerNet), totalEarned: FV.increment(sellerNet), updatedAt: FV.serverTimestamp() });
                } else {
                    tx.set(walletRef, { userId: data.sellerId, balance: sellerNet, pending: 0, totalEarned: sellerNet, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
                }
            });

            // Record platform revenue
            await db.collection('platform_revenue').add({
                source: 'commission', orderId, sellerId: data.sellerId,
                buyerId: data.buyerId, amount: fee, orderTotal: data.amount,
                createdAt: FV.serverTimestamp(),
            });

            return ok({ success: true, sellerNet, fee });
        } catch(e) {
            return err('Release error: ' + e.message, 500);
        }
    }

    if (action === 'refund') {
        try {
            const snap = await db.collection('payments').where('orderId', '==', orderId).limit(1).get();
            if (snap.empty) return err('No escrow record');
            const data = snap.docs[0].data();
            const batch = db.batch();
            batch.update(snap.docs[0].ref, { status: 'refunded', refundedAt: FV.serverTimestamp() });
            batch.update(db.collection('orders').doc(orderId), { status: 'refunded', escrowStatus: 'refunded', updatedAt: FV.serverTimestamp() });
            await batch.commit();

            // Refund to buyer wallet
            const buyerRef = db.collection('wallets').doc(data.buyerId);
            await db.runTransaction(async tx => {
                const w = await tx.get(buyerRef);
                if (w.exists) {
                    tx.update(buyerRef, { balance: FV.increment(data.amount), updatedAt: FV.serverTimestamp() });
                } else {
                    tx.set(buyerRef, { userId: data.buyerId, balance: data.amount, pending: 0, totalEarned: 0, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
                }
            });

            return ok({ success: true, refunded: data.amount });
        } catch(e) {
            return err('Refund error: ' + e.message, 500);
        }
    }

    return err('Unknown action');
};
