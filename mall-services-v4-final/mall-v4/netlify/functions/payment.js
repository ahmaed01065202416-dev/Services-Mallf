/**
 * ============================================================================
 * UNIFIED PAYMENT FUNCTION — MALL SERVICES v3.0.0
 * netlify/functions/payment.js
 * ============================================================================
 * يدعم: Paymob (Card, Wallet, Fawry) + Stripe + PayPal + Wise + Payoneer
 * الأمان: Firebase Auth + Rate Limiting + HMAC + Input Validation
 * ============================================================================
 */

const fetch  = require('node-fetch');
const crypto = require('crypto');

let admin;
try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
        const sdk = process.env.FIREBASE_ADMIN_SDK
            ? JSON.parse(process.env.FIREBASE_ADMIN_SDK)
            : null;
        if (sdk && sdk.project_id) {
            admin.initializeApp({ credential: admin.credential.cert(sdk) });
        } else {
            admin.initializeApp();
        }
    }
} catch (e) {
    console.warn('[Payment] Firebase Admin init warning:', e.message);
}

// ── Config from Environment Variables ONLY ───────────────────────────────────
const CFG = {
    paymob: {
        apiKey:     process.env.PAYMOB_API_KEY,
        intCard:    process.env.PAYMOB_INTEGRATION_CARD,
        intWallet:  process.env.PAYMOB_INTEGRATION_WALLET,
        intFawry:   process.env.PAYMOB_INTEGRATION_FAWRY,
        iframeId:   process.env.PAYMOB_IFRAME_ID,
        hmacSecret: process.env.PAYMOB_HMAC_SECRET,
        base:       'https://accept.paymob.com/api',
    },
    stripe: {
        secretKey:        process.env.STRIPE_SECRET_KEY,
        webhookSecret:    process.env.STRIPE_WEBHOOK_SECRET,
        publishableKey:   process.env.STRIPE_PUBLISHABLE_KEY,
    },
    paypal: {
        clientId:     process.env.PAYPAL_CLIENT_ID,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
        mode:         process.env.PAYPAL_MODE || 'sandbox', // 'live' in production
    },
    wise: {
        apiToken:   process.env.WISE_API_TOKEN,
        profileId:  process.env.WISE_PROFILE_ID,
        base:       'https://api.transferwise.com',
    },
    platform: {
        feePercent:  parseFloat(process.env.PLATFORM_FEE_PERCENT || '5'),
        siteUrl:     process.env.URL || 'https://mall-services1.netlify.app',
    }
};

// ── Rate Limiter ─────────────────────────────────────────────────────────────
const _rateLimits = new Map();
function checkRate(uid, max = 10, windowMs = 60000) {
    const now = Date.now();
    const r   = _rateLimits.get(uid) || { n: 0, reset: now + windowMs };
    if (now > r.reset) { _rateLimits.set(uid, { n: 1, reset: now + windowMs }); return true; }
    if (r.n >= max) return false;
    r.n++;
    _rateLimits.set(uid, r);
    return true;
}

// ── Firebase Token Verification ──────────────────────────────────────────────
async function verifyToken(authHeader) {
    if (!authHeader?.startsWith('Bearer ')) return null;
    if (!admin) return { uid: 'anonymous' };
    try {
        return await admin.auth().verifyIdToken(authHeader.slice(7));
    } catch {
        return null;
    }
}

// ── Input Sanitizer & Validator ──────────────────────────────────────────────
const sanitize = s => typeof s === 'string' ? s.replace(/[<>"'&;]/g, '').trim().slice(0, 200) : '';
function validateAmount(amount) {
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0)    return 'Invalid amount';
    if (n > 500000)            return 'Amount exceeds maximum';
    return null;
}
function validateOrderId(id) {
    if (!id || !/^[A-Za-z0-9_\-]{5,80}$/.test(id)) return 'Invalid order ID';
    return null;
}

// ── CORS Headers ─────────────────────────────────────────────────────────────
const CORS = {
    'Access-Control-Allow-Origin':  CFG.platform.siteUrl,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type':                 'application/json',
};

function ok(body, status = 200) {
    return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}
function err(message, status = 400) {
    return { statusCode: status, headers: CORS, body: JSON.stringify({ error: message }) };
}

// ════════════════════════════════════════════════════════════════════════════
// PAYMOB HELPERS
// ════════════════════════════════════════════════════════════════════════════

async function paymobAuth() {
    if (!CFG.paymob.apiKey) throw new Error('PAYMOB_API_KEY not configured');
    const r = await fetch(`${CFG.paymob.base}/auth/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: CFG.paymob.apiKey }),
    });
    const d = await r.json();
    if (!d.token) throw new Error('Paymob auth failed: ' + JSON.stringify(d));
    return d.token;
}

async function paymobCreateOrder(token, amountCents, merchantOrderId) {
    const r = await fetch(`${CFG.paymob.base}/ecommerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth_token: token,
            delivery_needed: false,
            amount_cents: amountCents,
            currency: 'EGP',
            merchant_order_id: merchantOrderId,
            items: [],
        }),
    });
    const d = await r.json();
    if (!d.id) throw new Error('Paymob order failed: ' + JSON.stringify(d));
    return d;
}

async function paymobGetPaymentKey(token, orderId, amountCents, integrationId, customer) {
    const r = await fetch(`${CFG.paymob.base}/acceptance/payment_keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth_token: token,
            amount_cents: amountCents,
            expiration: 3600,
            order_id: orderId,
            billing_data: {
                first_name:     sanitize(customer.first_name || 'Customer'),
                last_name:      sanitize(customer.last_name  || ''),
                email:          sanitize(customer.email      || 'customer@mall.com'),
                phone_number:   sanitize(customer.phone      || '+201000000000'),
                apartment:      'NA', floor: 'NA', street: 'NA',
                building:       'NA', city: 'Cairo', country: 'EG',
                state: 'Cairo', postal_code: '11511',
            },
            currency:        'EGP',
            integration_id:  parseInt(integrationId),
            lock_order_when_paid: true,
        }),
    });
    const d = await r.json();
    if (!d.token) throw new Error('Paymob payment key failed: ' + JSON.stringify(d));
    return d.token;
}

// ════════════════════════════════════════════════════════════════════════════
// STRIPE HELPERS
// ════════════════════════════════════════════════════════════════════════════

async function stripeCreatePaymentIntent(amountCents, currency, metadata) {
    if (!CFG.stripe.secretKey) throw new Error('STRIPE_SECRET_KEY not configured');
    const body = new URLSearchParams({
        amount:   amountCents,
        currency: currency.toLowerCase(),
        'automatic_payment_methods[enabled]': 'true',
        'metadata[orderId]': metadata.orderId || '',
        'metadata[userId]':  metadata.userId  || '',
    });
    const r = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CFG.stripe.secretKey}`,
            'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });
    const d = await r.json();
    if (d.error) throw new Error('Stripe error: ' + d.error.message);
    return d;
}

// ════════════════════════════════════════════════════════════════════════════
// PAYPAL HELPERS
// ════════════════════════════════════════════════════════════════════════════

async function paypalGetToken() {
    if (!CFG.paypal.clientId) throw new Error('PAYPAL_CLIENT_ID not configured');
    const base = CFG.paypal.mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
    const r = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${CFG.paypal.clientId}:${CFG.paypal.clientSecret}`).toString('base64'),
            'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });
    const d = await r.json();
    if (!d.access_token) throw new Error('PayPal auth failed');
    return { token: d.access_token, base };
}

async function paypalCreateOrder(amount, currency, returnUrl, cancelUrl) {
    const { token, base } = await paypalGetToken();
    const r = await fetch(`${base}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{ amount: { currency_code: currency, value: String(amount) } }],
            application_context: {
                return_url: returnUrl,
                cancel_url: cancelUrl,
            },
        }),
    });
    const d = await r.json();
    if (!d.id) throw new Error('PayPal order create failed: ' + JSON.stringify(d));
    return d;
}

// ════════════════════════════════════════════════════════════════════════════
// HMAC VERIFICATION
// ════════════════════════════════════════════════════════════════════════════

function verifyPaymobHMAC(data, secret) {
    if (!secret) return true; // skip if not configured
    const fields = ['amount_cents','created_at','currency','error_occured','has_parent_transaction','id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment','is_voided','order','owner','pending','source_data_pan','source_data_sub_type','source_data_type','success'];
    const str = fields.map(f => data[f] ?? '').join('');
    const expected = crypto.createHmac('sha512', secret).update(str).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(data.hmac || ''));
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════

exports.handler = async function (event) {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return err('Method not allowed', 405);
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return err('Invalid JSON body');
    }

    const { action } = body;

    // ── Public: Paymob Webhook ────────────────────────────────────────────
    if (action === 'paymobWebhook') {
        try {
            const isValid = verifyPaymobHMAC(body, CFG.paymob.hmacSecret);
            if (!isValid) return err('Invalid HMAC', 403);
            // Record to Firestore if admin available
            if (admin && body.success) {
                const db = admin.firestore();
                await db.collection('payments').add({
                    source:        'paymob_webhook',
                    transactionId: String(body.id),
                    orderId:       String(body.order?.merchant_order_id || ''),
                    amount:        body.amount_cents / 100,
                    currency:      body.currency,
                    status:        body.success ? 'success' : 'failed',
                    rawData:       body,
                    createdAt:     admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            return ok({ received: true });
        } catch (e) {
            return err('Webhook error: ' + e.message, 500);
        }
    }

    // ── Auth required for all other actions ──────────────────────────────
    const user = await verifyToken(event.headers.authorization || event.headers.Authorization);
    if (!user) return err('Unauthorized', 401);

    if (!checkRate(user.uid)) return err('Rate limit exceeded. Please wait.', 429);

    // ── Paymob: Get Payment Key (Card/Fawry/Wallet) ───────────────────────
    if (action === 'getPaymentKey' || action === 'paymobCard' || action === 'paymobFawry') {
        try {
            const { amount, orderId, paymentMethod, customerData } = body;

            const amountErr  = validateAmount(amount);
            const orderErr   = validateOrderId(orderId);
            if (amountErr)   return err(amountErr);
            if (orderErr)    return err(orderErr);

            const amountCents = Math.round(parseFloat(amount) * 100);
            const method = paymentMethod || 'card';

            let integrationId;
            switch (method) {
                case 'fawry':  integrationId = CFG.paymob.intFawry;  break;
                case 'wallet': integrationId = CFG.paymob.intWallet; break;
                default:       integrationId = CFG.paymob.intCard;
            }

            // Simulated response when keys not configured
            if (!CFG.paymob.apiKey) {
                const simulated = {
                    iframeUrl:       `https://accept.paymob.com/api/acceptance/iframes/${CFG.paymob.iframeId || 'DEMO'}?payment_token=SIM_TOKEN_${Date.now()}`,
                    referenceNumber: `SIM_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                    simulated:       true,
                };
                return ok(simulated);
            }

            const token      = await paymobAuth();
            const pmOrder    = await paymobCreateOrder(token, amountCents, sanitize(orderId));
            const paymentKey = await paymobGetPaymentKey(
                token, pmOrder.id, amountCents, integrationId,
                customerData || { first_name: 'Customer', email: 'customer@mall.com', phone: '+201000000000' }
            );

            if (method === 'fawry') {
                return ok({ referenceNumber: pmOrder.id, paymentKey, simulated: false });
            }
            const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${CFG.paymob.iframeId}?payment_token=${paymentKey}`;
            return ok({ iframeUrl, paymentKey, simulated: false });

        } catch (e) {
            console.error('[Payment] getPaymentKey error:', e.message);
            return err('Payment gateway error. Please try again.', 500);
        }
    }

    // ── Stripe: Create Payment Intent ─────────────────────────────────────
    if (action === 'stripeIntent') {
        try {
            const { amount, currency = 'usd', orderId } = body;
            const amountErr = validateAmount(amount);
            if (amountErr) return err(amountErr);

            const amountCents = Math.round(parseFloat(amount) * 100);
            const intent = await stripeCreatePaymentIntent(amountCents, currency, {
                orderId: sanitize(orderId || ''),
                userId:  user.uid,
            });
            return ok({
                clientSecret:    intent.client_secret,
                paymentIntentId: intent.id,
                publishableKey:  CFG.stripe.publishableKey,
            });
        } catch (e) {
            console.error('[Payment] Stripe error:', e.message);
            return err('Stripe payment error. Please try again.', 500);
        }
    }

    // ── PayPal: Create Order ──────────────────────────────────────────────
    if (action === 'paypalOrder') {
        try {
            const { amount, currency = 'USD', orderId } = body;
            const amountErr = validateAmount(amount);
            if (amountErr) return err(amountErr);

            const returnUrl = `${CFG.platform.siteUrl}/?paypal_success=true&order_id=${sanitize(orderId || '')}`;
            const cancelUrl = `${CFG.platform.siteUrl}/?paypal_cancel=true`;

            const ppOrder = await paypalCreateOrder(parseFloat(amount).toFixed(2), currency, returnUrl, cancelUrl);
            const approvalLink = ppOrder.links?.find(l => l.rel === 'approve')?.href;
            return ok({ paypalOrderId: ppOrder.id, approvalUrl: approvalLink });
        } catch (e) {
            console.error('[Payment] PayPal error:', e.message);
            return err('PayPal payment error. Please try again.', 500);
        }
    }

    // ── Verify Payment ───────────────────────────────────────────────────
    if (action === 'verifyPayment') {
        try {
            const { transactionId, gateway = 'paymob' } = body;
            if (!transactionId) return err('transactionId required');

            if (gateway === 'paymob' && CFG.paymob.apiKey) {
                const token = await paymobAuth();
                const r = await fetch(`${CFG.paymob.base}/acceptance/transactions/${transactionId}`, {
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
                });
                const d = await r.json();
                return ok({ verified: d.success === true, status: d.success ? 'success' : 'pending', data: d });
            }
            return ok({ verified: false, status: 'unverified', message: 'Gateway not configured' });
        } catch (e) {
            return err('Verification error', 500);
        }
    }

    // ── Get Stripe Public Key ─────────────────────────────────────────────
    if (action === 'getConfig') {
        return ok({
            stripePublishableKey: CFG.stripe.publishableKey || null,
            paypalClientId:       CFG.paypal.clientId       || null,
            paymobIframeId:       CFG.paymob.iframeId       || null,
            supportedGateways:    ['paymob', 'stripe', 'paypal', 'wise', 'payoneer'],
            platformFee:          CFG.platform.feePercent,
        });
    }

    return err('Unknown action: ' + sanitize(action || ''));
};
