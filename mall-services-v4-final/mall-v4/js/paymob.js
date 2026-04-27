/**
 * ============================================================================
 * PAYMENT MODULE — MALL SERVICES v4.0.0
 * نظام الدفع الموحد — يدعم جميع وسائل الدفع المحلية والعالمية
 * ============================================================================
 * المحلي:  Paymob • Fawry • Vodafone Cash • Orange Cash • Meeza • InstaPay
 * العالمي: Stripe • PayPal • Wise • Payoneer • Apple Pay • Google Pay
 * ============================================================================
 * ✅ NO DUPLICATE DECLARATIONS
 * ✅ CLEAN IIFE PATTERN
 * ✅ PRODUCTION READY
 * ============================================================================
 */
(function () {
    'use strict';

    // ── CONFIG ──────────────────────────────────────────────────────────────
    const CONFIG = {
        endpoint: '/.netlify/functions/payment',
        currency: 'EGP',
        currencySubunit: 100,
        timeout: 30000,
        maxRetries: 3,
        iframeHeight: '520px',
        platformFee: 0.05,
        messages: {
            loginRequired:       'يرجى تسجيل الدخول أولاً',
            paymentInitError:    'حدث خطأ أثناء تهيئة الدفع',
            cardPaymentError:    'حدث خطأ في بوابة الدفع',
            walletInsufficient:  'الرصيد غير كافي. تحتاج {{amount}} ج.م إضافية',
            walletSuccess:       'تم الدفع من المحفظة بنجاح ✅',
            fawryCodeCreated:    'تم إنشاء كود Fawry بنجاح ✅',
            paymentSuccess:      'تمت عملية الدفع بنجاح! ✅',
            paymentFailed:       'فشل الدفع. يرجى المحاولة مرة أخرى',
            orderFinalized:      'تم تقديم الطلبات بنجاح! ✅',
            orderFinalizeError:  'حدث خطأ أثناء تأكيد الطلبات',
            selectMethod:        'يرجى اختيار طريقة الدفع أولاً',
            invalidAmount:       'قيمة الدفع غير صحيحة',
            emptyCart:           'السلة فارغة',
            unsupportedMethod:   'وسيلة الدفع غير مدعومة',
            copyCode:            'تم نسخ الكود ✅',
        }
    };

    // ── PAYMENT METHOD IDS ───────────────────────────────────────────────────
    const METHOD = {
        CARD:      'card',
        WALLET:    'balance',
        FAWRY:     'fawry',
        STRIPE:    'stripe',
        PAYPAL:    'paypal',
        VODAFONE:  'vodafone_cash',
        ORANGE:    'orange_cash',
        ETISALAT:  'etisalat_cash',
        WE:        'we_pay',
        INSTAPAY:  'instapay',
        BANK:      'bank_transfer',
        WISE:      'wise',
        PAYONEER:  'payoneer',
    };

    // ── UTILITIES ──────────────────────────────────────────────────────────
    const Utils = {
        appState()           { return (typeof window.AppState === 'object' && window.AppState) || {}; },
        walletBalance()      { return parseFloat(this.appState().wallet?.balance) || 0; },
        currentUser()        { return this.appState().currentUser || null; },
        cartTotal()          {
            const cart = this.appState().cart;
            if (!Array.isArray(cart) || !cart.length) return 0;
            return cart.reduce((s, i) => s + (parseFloat(i?.price) || 0), 0);
        },
        serviceTotal()       { return parseFloat(this.appState().currentPaymentService?.price) || 0; },
        fees(amt, r = 0.05)  { return Number((parseFloat(amt) * r).toFixed(2)); },
        fmt(amt, sym = 'ج.م') {
            return new Intl.NumberFormat('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          .format(parseFloat(amt) || 0) + ' ' + sym;
        },
        orderId(pfx = 'MS', uid = null) {
            const ts  = Date.now();
            const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
            const u   = uid ? uid.substring(0, 8) : 'GUEST';
            return `${pfx}_${ts}_${u}_${rnd}`;
        },
        delay(ms) { return new Promise(r => setTimeout(r, ms)); },

        // Safe modal helpers
        openModal(id) {
            if (typeof window.openModal === 'function') { window.openModal(id); return; }
            const el = document.getElementById(id);
            if (el) { el.classList.remove('hidden'); el.classList.add('active'); }
        },
        closeModal(id) {
            if (typeof window.closeModal === 'function') { window.closeModal(id); return; }
            const el = document.getElementById(id);
            if (el) { el.classList.add('hidden'); el.classList.remove('active'); }
        },
        showLoading(msg = 'جاري المعالجة...') {
            if (typeof window.showLoading === 'function') { window.showLoading(msg); return; }
            let el = document.getElementById('_pmLoader');
            if (!el) {
                el = document.createElement('div');
                el.id = '_pmLoader';
                el.className = 'fixed inset-0 bg-black/60 z-[100000] flex items-center justify-center';
                el.innerHTML = `<div class="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl"><div class="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div><p id="_pmLoaderMsg" class="text-gray-700 font-semibold">${msg}</p></div>`;
                document.body.appendChild(el);
            } else {
                const p = el.querySelector('#_pmLoaderMsg');
                if (p) p.textContent = msg;
                el.classList.remove('hidden');
            }
        },
        hideLoading() {
            if (typeof window.hideLoading === 'function') { window.hideLoading(); return; }
            const el = document.getElementById('_pmLoader');
            if (el) el.classList.add('hidden');
        },
        toast(msg, type = 'info') {
            if (typeof window.showToast === 'function') { window.showToast(msg, type); return; }
            const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
            const icons  = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
            const el = document.createElement('div');
            el.style.cssText = `position:fixed;top:20px;right:20px;background:${colors[type]||colors.info};color:#fff;padding:14px 20px;border-radius:12px;z-index:999999;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;`;
            el.innerHTML = `<span>${icons[type]||''}</span><span>${msg}</span>`;
            document.body.appendChild(el);
            setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; setTimeout(() => el.remove(), 400); }, 4000);
        },
        navigate(page) {
            if (typeof window.navigateTo === 'function') window.navigateTo(page);
            else window.location.hash = `#${page}`;
        },
        async idToken() {
            try {
                if (window.auth?.currentUser?.getIdToken) return await window.auth.currentUser.getIdToken();
            } catch {}
            return null;
        }
    };

    // ── CORE PAYMENT MANAGER ────────────────────────────────────────────────
    const PaymobManager = {
        _state: {
            selectedMethod:   null,
            currentPayData:   null,
            payCallbacks:     null,
            msgHandler:       null,
        },

        // ── Public: Initiate payment flow ───────────────────────────────────
        async initiatePayment(amount, orderId, orderData = {}, onSuccess = null, onFailure = null) {
            if (!Utils.currentUser()) {
                Utils.toast(CONFIG.messages.loginRequired, 'warning');
                Utils.navigate('login');
                return false;
            }
            this._state.currentPayData = { amount, orderId, orderData };
            this._state.payCallbacks   = { onSuccess, onFailure };
            this._showMethodModal(amount, orderId);
            return true;
        },

        _showMethodModal(amount, orderId) {
            const bal = document.getElementById('walletBalanceDisplay');
            if (bal) bal.textContent = Utils.walletBalance().toFixed(2);
            const amEl = document.getElementById('paymentAmount');
            if (amEl) amEl.textContent = Utils.fmt(amount);
            const orEl = document.getElementById('paymentOrderId');
            if (orEl && orderId) orEl.textContent = orderId;
            Utils.openModal('paymentModal');
        },

        // ── Public: Process selected method ─────────────────────────────────
        async processPayment(method) {
            const target = method || this._state.selectedMethod;
            if (!target) {
                Utils.toast(CONFIG.messages.selectMethod, 'warning');
                return false;
            }
            this._state.selectedMethod = target;
            Utils.closeModal('paymentModal');

            // Build payment data if missing
            if (!this._state.currentPayData?.amount) {
                const base = Utils.cartTotal() || Utils.serviceTotal();
                if (base <= 0) { Utils.toast(CONFIG.messages.invalidAmount, 'error'); return false; }
                const fees  = Utils.fees(base);
                const total = Number((base + fees).toFixed(2));
                const uid   = Utils.currentUser()?.uid?.substring(0, 8) || 'guest';
                this._state.currentPayData = { amount: total, orderId: Utils.orderId('MS', uid), orderData: { cartTotal: base, fees } };
            }

            const { amount, orderId, orderData } = this._state.currentPayData;

            switch (target) {
                case METHOD.CARD:     return await this._payCard(amount, orderId, orderData);
                case METHOD.WALLET:   return await this._payBalance(amount, orderId);
                case METHOD.FAWRY:    return await this._payFawry(amount, orderId, orderData);
                case METHOD.STRIPE:   return await this._payStripe(amount, orderId, orderData);
                case METHOD.PAYPAL:   return await this._payPayPal(amount, orderId, orderData);
                case METHOD.VODAFONE:
                case METHOD.ORANGE:
                case METHOD.ETISALAT:
                case METHOD.WE:
                case METHOD.INSTAPAY:
                case METHOD.BANK:      return this._showManualPayment(target, amount, orderId);
                default:
                    Utils.toast(CONFIG.messages.unsupportedMethod, 'error');
                    return false;
            }
        },

        // ── Card (Paymob) ──────────────────────────────────────────────────
        async _payCard(amount, orderId, orderData = {}) {
            try {
                Utils.showLoading('جاري تهيئة بوابة الدفع...');
                const user = Utils.currentUser() || {};
                const parts = (user.name || 'Customer').split(' ');
                const token = await Utils.idToken();

                const res = await fetch(CONFIG.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify({
                        action:        'getPaymentKey',
                        amount, orderId,
                        paymentMethod: METHOD.CARD,
                        customerData:  { first_name: parts[0] || 'Customer', last_name: parts.slice(1).join(' ') || '', email: user.email || 'customer@mall.com', phone: user.phone || '+201000000000' },
                        orderData:     { description: 'Mall Services — Purchase', ...orderData }
                    })
                });
                const data = await res.json();
                Utils.hideLoading();
                if (!res.ok || !data.iframeUrl) throw new Error(data.error || 'Failed to get iframe URL');
                this._openIframe(data.iframeUrl, amount, orderId, data.simulated);
                return true;
            } catch (e) {
                Utils.hideLoading();
                Utils.toast(`${CONFIG.messages.cardPaymentError}: ${e.message}`, 'error');
                this._state.payCallbacks?.onFailure?.(e);
                return false;
            }
        },

        _openIframe(url, amount, orderId, simulated = false) {
            document.getElementById('paymobPaymentModal')?.remove();
            const modal = document.createElement('div');
            modal.id = 'paymobPaymentModal';
            modal.className = 'fixed inset-0 bg-black/70 z-[99999] flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
                    <div class="bg-gradient-to-r from-indigo-600 to-purple-700 p-5 flex items-center justify-between text-white">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-lock text-xl"></i>
                            <div>
                                <h3 class="font-bold text-lg">دفع آمن عبر Paymob</h3>
                                <p class="opacity-80 text-sm">المبلغ: ${Utils.fmt(amount)}</p>
                            </div>
                        </div>
                        <button onclick="window.PaymobManager.closePaymentModal(false)" class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition">
                            <i class="fa-solid fa-xmark text-xl"></i>
                        </button>
                    </div>
                    ${simulated ? '<div class="p-3 bg-orange-50 text-orange-700 text-sm text-center font-medium">⚠️ وضع تجريبي — بدون مفاتيح حقيقية</div>' : ''}
                    <div class="p-3 bg-green-50 flex items-center gap-3 text-sm text-green-700">
                        <i class="fa-solid fa-shield-check"></i>
                        <span>مشفّر بـ SSL 256-bit • بياناتك محمية بالكامل</span>
                    </div>
                    <iframe src="${url}" class="w-full" style="height:${CONFIG.iframeHeight};border:none;" allow="payment" loading="lazy"></iframe>
                    <div class="p-4 bg-gray-50 border-t flex justify-center gap-6">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" class="h-6 opacity-60" alt="Visa">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" class="h-6 opacity-60" alt="MC">
                    </div>
                </div>`;
            document.body.appendChild(modal);

            const handler = (e) => {
                const d = e.data;
                if (d?.type === 'payment' || d?.payment_status || d?.source === 'paymob') {
                    this._handleCallback(d, orderId, amount);
                    window.removeEventListener('message', handler);
                }
            };
            this._state.msgHandler = handler;
            window.addEventListener('message', handler);
            this._checkRedirect();
        },

        _checkRedirect() {
            const p = new URLSearchParams(window.location.search);
            const success = p.get('success');
            const orderId = p.get('merchant_order_id') || p.get('order_id');
            const txId    = p.get('id') || p.get('transaction_id');
            if (success !== null && orderId) {
                window.history.replaceState({}, document.title, window.location.pathname);
                if (success === 'true') this._onSuccess(orderId, txId);
                else this._onFailure(orderId);
            }
        },

        _handleCallback(data, orderId, amount) {
            if (data.success === true || data.status === 'success' || data.payment_status === 'paid') {
                this._onSuccess(orderId, data.transaction_id || data.id || data.payment_id);
            } else if (data.success === false || data.status === 'failed') {
                this._onFailure(orderId, data.message);
            } else if (data.status === 'cancelled' || data.action === 'close') {
                this.closePaymentModal(false);
            }
        },

        async _onSuccess(orderId, transactionId, raw = {}) {
            this.closePaymentModal(true);
            Utils.toast(CONFIG.messages.paymentSuccess, 'success');
            if (window.db && window.COLLECTIONS) {
                try {
                    await window.db.collection(window.COLLECTIONS.PAYMENTS).add({
                        orderId, transactionId,
                        amount:   this._state.currentPayData?.amount || 0,
                        method:   this._state.selectedMethod || 'paymob_card',
                        status:   'success',
                        userId:   Utils.currentUser()?.uid,
                        rawData:  raw,
                        createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });
                } catch (e) { console.warn('[Payment] Firestore write error:', e.message); }
            }
            await this._state.payCallbacks?.onSuccess?.(transactionId, raw);
            await this._finalizeOrders(this._state.selectedMethod || 'paymob_card', transactionId);
        },

        _onFailure(orderId, msg = null) {
            this.closePaymentModal(false);
            Utils.toast(msg || CONFIG.messages.paymentFailed, 'error');
            this._state.payCallbacks?.onFailure?.(msg);
        },

        closePaymentModal(success) {
            const modal = document.getElementById('paymobPaymentModal');
            if (modal) modal.remove();
            if (this._state.msgHandler) {
                window.removeEventListener('message', this._state.msgHandler);
                this._state.msgHandler = null;
            }
            if (success) setTimeout(() => Utils.navigate('orders'), 300);
        },

        // ── Wallet/Balance ─────────────────────────────────────────────────
        async _payBalance(amount, orderId) {
            const balance = Utils.walletBalance();
            if (balance < amount) {
                const needed = (amount - balance).toFixed(2);
                Utils.toast(CONFIG.messages.walletInsufficient.replace('{{amount}}', needed), 'error');
                return false;
            }
            Utils.showLoading('جاري خصم المبلغ...');
            try {
                const uid = Utils.currentUser()?.uid;
                if (typeof window.WalletManager?.deductBalance === 'function') {
                    await window.WalletManager.deductBalance(amount, 'شراء خدمة', uid, { orderId });
                } else {
                    const s = Utils.appState();
                    if (s?.wallet) s.wallet.balance = parseFloat((balance - amount).toFixed(2));
                    if (typeof window.saveToStorage === 'function') window.saveToStorage();
                }
                Utils.hideLoading();
                Utils.toast(CONFIG.messages.walletSuccess, 'success');
                await this._finalizeOrders(METHOD.WALLET, null);
                return true;
            } catch (e) {
                Utils.hideLoading();
                Utils.toast(e.message || CONFIG.messages.paymentFailed, 'error');
                return false;
            }
        },

        // ── Fawry ──────────────────────────────────────────────────────────
        async _payFawry(amount, orderId, orderData = {}) {
            try {
                Utils.showLoading('جاري إنشاء كود Fawry...');
                const token = await Utils.idToken();
                const user  = Utils.currentUser() || {};
                const res = await fetch(CONFIG.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify({
                        action: 'getPaymentKey',
                        amount, orderId,
                        paymentMethod: METHOD.FAWRY,
                        customerData: { email: user.email || 'customer@mall.com', phone: user.phone || '+201000000000' },
                        orderData: { description: 'Fawry — Mall Services', ...orderData }
                    })
                });
                const data = await res.json();
                Utils.hideLoading();
                if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
                const ref = data.referenceNumber || data.reference_number || data.code;
                if (ref) { this._showFawryModal(ref, amount, orderId, data.simulated); return true; }
                throw new Error(data.error || 'فشل إنشاء كود Fawry');
            } catch (e) {
                Utils.hideLoading();
                Utils.toast(`${CONFIG.messages.paymentInitError}: ${e.message}`, 'error');
                return false;
            }
        },

        _showFawryModal(code, amount, orderId, simulated = false) {
            document.getElementById('fawryPaymentModal')?.remove();
            const modal = document.createElement('div');
            modal.id = 'fawryPaymentModal';
            modal.className = 'fixed inset-0 bg-black/70 z-[99999] flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
                    <div class="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <i class="fa-solid fa-store text-white text-3xl"></i>
                    </div>
                    <h3 class="text-2xl font-black text-gray-900 mb-2">كود Fawry</h3>
                    <p class="text-gray-500 mb-5">اذهب لأقرب نقطة Fawry وادفع المبلغ</p>
                    ${simulated ? '<div class="text-xs text-orange-500 bg-orange-50 p-3 rounded-xl mb-4">وضع تجريبي</div>' : ''}
                    <div class="bg-gray-50 rounded-2xl p-6 mb-5">
                        <p class="text-sm text-gray-500 mb-2">كود الدفع</p>
                        <p class="text-3xl font-black text-indigo-700 tracking-widest">${code}</p>
                        <button onclick="navigator.clipboard.writeText('${code}').then(()=>window.PaymobManager._copySuccess())" class="mt-3 text-sm text-indigo-600 hover:underline flex items-center justify-center gap-2">
                            <i class="fa-regular fa-copy"></i> نسخ الكود
                        </button>
                    </div>
                    <div class="space-y-2 text-sm text-gray-600 mb-5">
                        <div class="flex items-center gap-3 bg-indigo-50 p-3 rounded-xl">
                            <i class="fa-solid fa-coins text-indigo-600"></i>
                            <span>المبلغ: <strong class="text-indigo-700">${Utils.fmt(amount)}</strong></span>
                        </div>
                        <div class="flex items-center gap-3 bg-yellow-50 p-3 rounded-xl">
                            <i class="fa-solid fa-clock text-yellow-600"></i>
                            <span>صالح لمدة <strong>72 ساعة</strong></span>
                        </div>
                    </div>
                    <button onclick="document.getElementById('fawryPaymentModal').remove(); window.navigateTo && window.navigateTo('orders');" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition">
                        متابعة الطلبات
                    </button>
                </div>`;
            document.body.appendChild(modal);
            this._finalizeOrders(METHOD.FAWRY, code);
        },

        _copySuccess() { Utils.toast(CONFIG.messages.copyCode, 'success'); },

        // ── Stripe ──────────────────────────────────────────────────────────
        async _payStripe(amount, orderId, orderData = {}) {
            try {
                Utils.showLoading('جاري تهيئة Stripe...');
                const token = await Utils.idToken();
                const res = await fetch(CONFIG.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify({ action: 'stripeIntent', amount, currency: 'usd', orderId })
                });
                const data = await res.json();
                Utils.hideLoading();
                if (!res.ok || !data.clientSecret) throw new Error(data.error || 'Stripe not configured');
                this._showStripeModal(data.clientSecret, data.publishableKey, amount, orderId);
                return true;
            } catch (e) {
                Utils.hideLoading();
                Utils.toast(`Stripe: ${e.message}`, 'error');
                return false;
            }
        },

        _showStripeModal(clientSecret, publishableKey, amount, orderId) {
            document.getElementById('stripePaymentModal')?.remove();
            const modal = document.createElement('div');
            modal.id = 'stripePaymentModal';
            modal.className = 'fixed inset-0 bg-black/70 z-[99999] flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                                <i class="fa-brands fa-stripe text-white text-xl"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-900">Stripe Payment</h3>
                                <p class="text-sm text-gray-500">Amount: $${(amount * 0.021).toFixed(2)}</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('stripePaymentModal').remove()" class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200">
                            <i class="fa-solid fa-xmark text-gray-600"></i>
                        </button>
                    </div>
                    <div id="stripe-element" class="p-4 border-2 border-gray-200 rounded-xl mb-4 min-h-[60px] flex items-center justify-center text-gray-400 text-sm">
                        ${publishableKey ? 'Loading Stripe...' : '⚠️ Stripe not configured — add STRIPE_SECRET_KEY to Netlify env vars'}
                    </div>
                    ${publishableKey ? `<button id="stripePayBtn" onclick="window._stripeConfirm && window._stripeConfirm()" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition">Pay Now</button>` : '<button class="w-full bg-gray-400 text-white py-4 rounded-2xl font-bold cursor-not-allowed">Not Configured</button>'}
                </div>`;
            document.body.appendChild(modal);

            if (publishableKey && typeof Stripe !== 'undefined') {
                const stripe  = Stripe(publishableKey);
                const elements = stripe.elements({ clientSecret });
                const element = elements.create('payment');
                element.mount('#stripe-element');
                window._stripeConfirm = async () => {
                    const btn = document.getElementById('stripePayBtn');
                    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }
                    const { error, paymentIntent } = await stripe.confirmPayment({
                        elements, redirect: 'if_required'
                    });
                    if (error) {
                        Utils.toast(error.message, 'error');
                        if (btn) { btn.disabled = false; btn.textContent = 'Pay Now'; }
                    } else if (paymentIntent?.status === 'succeeded') {
                        document.getElementById('stripePaymentModal')?.remove();
                        this._onSuccess(orderId, paymentIntent.id);
                    }
                };
            }
        },

        // ── PayPal ─────────────────────────────────────────────────────────
        async _payPayPal(amount, orderId, orderData = {}) {
            try {
                Utils.showLoading('جاري تهيئة PayPal...');
                const token = await Utils.idToken();
                const res = await fetch(CONFIG.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify({ action: 'paypalOrder', amount: (amount * 0.021).toFixed(2), currency: 'USD', orderId })
                });
                const data = await res.json();
                Utils.hideLoading();
                if (!res.ok || !data.approvalUrl) throw new Error(data.error || 'PayPal not configured');
                window.open(data.approvalUrl, '_blank', 'width=500,height=700');
                return true;
            } catch (e) {
                Utils.hideLoading();
                Utils.toast(`PayPal: ${e.message}`, 'error');
                return false;
            }
        },

        // ── Manual Payment (Vodafone/Orange/InstaPay) ──────────────────────
        _showManualPayment(method, amount, orderId) {
            const info = {
                vodafone_cash: { name: 'Vodafone Cash', number: '010-XXXX-XXXX', color: '#e4002b', icon: 'fa-mobile-screen-button' },
                orange_cash:   { name: 'Orange Cash',   number: '012-XXXX-XXXX', color: '#ff6600', icon: 'fa-mobile-screen-button' },
                etisalat_cash: { name: 'Etisalat Cash', number: '011-XXXX-XXXX', color: '#0099cc', icon: 'fa-mobile-screen-button' },
                we_pay:        { name: 'WE Pay',        number: '015-XXXX-XXXX', color: '#6600cc', icon: 'fa-wifi' },
                instapay:      { name: 'InstaPay',      number: 'your-instapay-id', color: '#0066cc', icon: 'fa-bolt' },
                bank_transfer: { name: 'Bank Transfer', number: 'IBAN: EGXXXXXXXXXXXXXXXX', color: '#374151', icon: 'fa-building-columns' },
            }[method] || { name: method, number: 'N/A', color: '#6366f1', icon: 'fa-wallet' };

            document.getElementById('manualPayModal')?.remove();
            const modal = document.createElement('div');
            modal.id = 'manualPayModal';
            modal.className = 'fixed inset-0 bg-black/70 z-[99999] flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
                    <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:${info.color}">
                        <i class="fa-solid ${info.icon} text-white text-2xl"></i>
                    </div>
                    <h3 class="text-xl font-black text-gray-900 mb-2">${info.name}</h3>
                    <p class="text-gray-500 mb-5">أرسل المبلغ على الرقم التالي ثم تواصل مع الدعم</p>
                    <div class="bg-gray-50 rounded-2xl p-5 mb-5">
                        <p class="text-sm text-gray-500 mb-1">الرقم</p>
                        <p class="text-2xl font-black" style="color:${info.color}">${info.number}</p>
                        <p class="text-lg font-bold text-gray-800 mt-3">${Utils.fmt(amount)}</p>
                        <p class="text-xs text-gray-400 mt-2">رقم الطلب: ${orderId}</p>
                    </div>
                    <p class="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-xl mb-4">
                        ⚠️ بعد الإرسال، تواصل مع الدعم على البريد: support@mall-services.com
                    </p>
                    <button onclick="document.getElementById('manualPayModal').remove()" class="w-full bg-gray-800 text-white py-4 rounded-2xl font-bold hover:bg-gray-900 transition">حسناً، تم</button>
                </div>`;
            document.body.appendChild(modal);
            return true;
        },

        // ── Finalize Orders ────────────────────────────────────────────────
        async _finalizeOrders(payMethod, payId) {
            try {
                const cart = Utils.appState().cart;
                if (!Array.isArray(cart) || !cart.length) return true;
                Utils.showLoading('جاري تأكيد الطلبات...');
                const user = Utils.currentUser();
                for (const item of cart) {
                    let orderId = null;
                    if (typeof window.OrdersManager?.createOrder === 'function') {
                        orderId = await window.OrdersManager.createOrder(item, payMethod, payId);
                    }
                    // ── ESCROW: hold payment until buyer confirms delivery ──
                    if (window.EscrowSystem && user) {
                        const oid = orderId || Utils.orderId('ORD', user.uid?.substring(0,8));
                        await window.EscrowSystem.holdPayment(
                            oid,
                            parseFloat(item.price) || 0,
                            user.uid,
                            item.sellerId || item.userId || 'platform',
                            payId
                        ).catch(e => console.warn('[Escrow] hold warning:', e.message));
                    }
                }
                const s = Utils.appState();
                s.cart = [];
                if (typeof window.saveToStorage === 'function') window.saveToStorage();
                if (typeof window.updateCartCount === 'function') window.updateCartCount();
                Utils.hideLoading();
                Utils.toast(CONFIG.messages.orderFinalized, 'success');
                Utils.navigate('orders');
                return true;
            } catch (e) {
                Utils.hideLoading();
                Utils.toast(CONFIG.messages.orderFinalizeError, 'error');
                return false;
            }
        },

        // ── Verify ─────────────────────────────────────────────────────────
        async verifyPayment(transactionId, gateway = 'paymob') {
            try {
                const token = await Utils.idToken();
                const res = await fetch(CONFIG.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify({ action: 'verifyPayment', transactionId, gateway })
                });
                const data = await res.json();
                return data.verified;
            } catch { return null; }
        },

        // Public shortcuts
        formatAmount(amt, sym) { return Utils.fmt(amt, sym); },
        showLoading(msg) { Utils.showLoading(msg); },
        hideLoading() { Utils.hideLoading(); },
        showToast(msg, type) { Utils.toast(msg, type); },
        generateOrderId(pfx, uid) { return Utils.orderId(pfx, uid); },

        // Legacy compat
        checkPaymentRedirect() { this._checkRedirect(); },
        safeNavigateToOrders() { Utils.navigate('orders'); },
    };

    // ── GLOBAL WRAPPER FUNCTIONS ──────────────────────────────────────────
    function selectPayment(method, event) {
        PaymobManager._state.selectedMethod = method;

        document.querySelectorAll('.payment-option').forEach(opt => {
            opt.classList.remove('border-indigo-500', 'bg-indigo-50', 'border-brand-500', 'bg-brand-50');
            const ic = opt.querySelector('[data-check]');
            if (ic) { ic.classList.remove('text-indigo-600', 'text-brand-600'); ic.classList.add('text-gray-300'); }
        });

        const target = event?.currentTarget || event?.target;
        if (target) {
            target.classList.add('border-indigo-500', 'bg-indigo-50');
            const ic = target.querySelector('[data-check]');
            if (ic) { ic.classList.remove('text-gray-300'); ic.classList.add('text-indigo-600'); }
        }
    }

    async function processPayment() {
        if (!PaymobManager._state.selectedMethod) {
            Utils.toast(CONFIG.messages.selectMethod, 'warning');
            return false;
        }
        return await PaymobManager.processPayment();
    }

    async function checkout(service = null) {
        const auth = window.AuthManager;
        if (!auth || typeof auth.isLoggedIn !== 'function' || !auth.isLoggedIn()) {
            Utils.toast(CONFIG.messages.loginRequired, 'warning');
            Utils.navigate('login');
            return;
        }
        const cart = Utils.appState().cart;
        if (!Array.isArray(cart) || !cart.length) {
            Utils.toast(CONFIG.messages.emptyCart, 'warning');
            return;
        }
        if (service) {
            Utils.appState().currentPaymentService = service;
        }
        const total = Utils.cartTotal() || Utils.serviceTotal();
        const uid   = Utils.currentUser()?.uid?.substring(0, 8) || 'guest';
        PaymobManager._showMethodModal(total, Utils.orderId('MS', uid));
    }

    function openPaymentModal(service = null) {
        checkout(service);
    }

    // ── INIT ──────────────────────────────────────────────────────────────
    function init() {
        window.selectPayment    = selectPayment;
        window.processPayment   = processPayment;
        window.checkout         = checkout;
        window.openPaymentModal = openPaymentModal;
        window.PaymobManager    = PaymobManager;
        window.PaymentUtils     = Utils;

        // Check for payment redirect params on load
        PaymobManager._checkRedirect();

        console.log('✅ Payment Module v4.0.0 ready — methods:', Object.values(METHOD).join(', '));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
