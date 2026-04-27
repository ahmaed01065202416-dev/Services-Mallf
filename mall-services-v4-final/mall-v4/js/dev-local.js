/**
 * ============================================================================
 * LOCAL DEVELOPMENT CONFIG
 * تشغيل المشروع محليًا بدون Netlify Functions
 * ============================================================================
 * ✅ Mock Payment Gateways
 * ✅ Local Storage Support
 * ✅ Development Mode
 * ============================================================================
 */
(function () {
    'use strict';

    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname.includes('dev.');

    if (!isDev) return; // Only load in development

    // Mock Netlify Functions endpoint
    window._mockPaymentEndpoint = async (body) => {
        const { action, amount, orderId, paymentMethod } = body;

        console.log('🔧 [DEV] Payment mock:', { action, paymentMethod, amount });

        switch (action) {
            case 'getPaymentKey':
                // Mock Paymob iframe URL
                return {
                    success: true,
                    iframeUrl: `data:text/html,<div style="padding:40px;text-align:center;font-family:Arial"><h2>🔧 Development Mode</h2><p>Payment Method: ${paymentMethod}</p><p>Amount: ${amount} EGP</p><button onclick="window.parent.postMessage({success:true,payment_status:'paid'},window.location.origin)">Confirm Payment</button></div>`,
                    simulated: true,
                };
            case 'stripeIntent':
                return {
                    success: true,
                    clientSecret: 'sk_test_mock_secret',
                    publishableKey: null, // Mock mode - no stripe
                };
            case 'paypalOrder':
                return {
                    success: true,
                    approvalUrl: window.location.origin + '?paypal_mock=success',
                };
            default:
                return { success: true, message: 'Mock response' };
        }
    };

    // Override fetch for /.netlify/functions/payment
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const [url, options] = args;
        
        if (typeof url === 'string' && url.includes('/.netlify/functions/payment')) {
            try {
                const body = JSON.parse(options?.body || '{}');
                return Promise.resolve(new Response(
                    JSON.stringify(await window._mockPaymentEndpoint(body)),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                ));
            } catch (e) {
                console.error('Mock payment error:', e);
                return Promise.resolve(new Response(
                    JSON.stringify({ error: e.message }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                ));
            }
        }
        return originalFetch.apply(this, args);
    };

    console.log('🔧 Local Development Mode Enabled — Mock Payment Gateways Active');
})();
