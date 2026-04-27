/**
 * ============================================================================
 * SUBSCRIPTIONS FUNCTION — MALL SERVICES v3.0.0
 * netlify/functions/subscriptions.js
 * ============================================================================
 */

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type':                 'application/json',
};

const ok  = (body) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const err = (msg, s = 400) => ({ statusCode: s, headers: CORS, body: JSON.stringify({ error: msg }) });

const PLANS = {
    free:     { price: 0,    maxServices: 3,   commission: 10 },
    basic:    { price: 99,   maxServices: 10,  commission: 8  },
    pro:      { price: 299,  maxServices: 50,  commission: 5  },
    business: { price: 599,  maxServices: 200, commission: 3  },
    vip:      { price: 1499, maxServices: -1,  commission: 1  },
};

let admin;
try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
        const sdk = process.env.FIREBASE_ADMIN_SDK
            ? JSON.parse(process.env.FIREBASE_ADMIN_SDK)
            : null;
        if (sdk?.project_id) {
            admin.initializeApp({ credential: admin.credential.cert(sdk) });
        } else {
            admin.initializeApp();
        }
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

    const { action, planId, userId } = body;
    const targetUser = userId || user.uid;

    if (action === 'subscribe') {
        const plan = PLANS[planId];
        if (!plan) return err('Invalid plan');

        try {
            if (!admin) return err('Server not configured', 500);
            const db = admin.firestore();
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 1);

            await db.collection('subscriptions').doc(targetUser).set({
                userId:     targetUser,
                planId,
                price:      plan.price,
                commission: plan.commission,
                maxServices: plan.maxServices,
                status:     'active',
                startedAt:  admin.firestore.FieldValue.serverTimestamp(),
                expiresAt,
                updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
            });

            await db.collection('users').doc(targetUser).update({
                subscriptionPlan: planId,
                commission:       plan.commission,
                updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
            });

            // Record revenue
            if (plan.price > 0) {
                await db.collection('platform_revenue').add({
                    source:    'subscription',
                    amount:    plan.price,
                    userId:    targetUser,
                    planId,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            return ok({ success: true, plan: { id: planId, ...plan }, expiresAt });
        } catch (e) {
            return err('Subscription error: ' + e.message, 500);
        }
    }

    if (action === 'getStatus') {
        try {
            if (!admin) return ok({ plan: 'free', status: 'active' });
            const db   = admin.firestore();
            const snap = await db.collection('subscriptions').doc(targetUser).get();
            if (!snap.exists) return ok({ plan: 'free', status: 'active' });
            return ok(snap.data());
        } catch (e) {
            return err('Error: ' + e.message, 500);
        }
    }

    return err('Unknown action');
};
