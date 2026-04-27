/**
 * ============================================================================
 * REVENUE MANAGEMENT SYSTEM — MALL SERVICES v3.0.0
 * نظام إدارة الإيرادات المتكامل
 * ============================================================================
 * يشمل: عمولات • اشتراكات • Featured • Boost • إعلانات • توثيق • Affiliate
 * ============================================================================
 */
(function () {
    'use strict';

    // ── COMMISSION ENGINE ────────────────────────────────────────────────────
    const CommissionEngine = {
        /**
         * Calculate platform commission for an order
         * @param {number} amount - Order amount in EGP
         * @param {string} sellerPlan - Seller's subscription plan
         * @param {string} category - Service category
         * @param {string} paymentMethod - Payment method used
         * @returns {{ platform: number, seller: number, rate: number }}
         */
        calculate(amount, sellerPlan = 'free', category = null, paymentMethod = null) {
            const plans = window.SUBSCRIPTION_PLANS || {};
            const planData = plans[sellerPlan] || { commission: 10 };
            let rate = planData.commission / 100;

            // Category-based adjustments
            const categoryRates = {
                real_estate: 0.08,
                legal:       0.06,
                medical:     0.06,
                premium:     0.08,
            };
            if (category && categoryRates[category]) {
                rate = Math.max(rate, categoryRates[category]);
            }

            // Payment method fee adjustment
            const methodFees = {
                card:         0.025,
                fawry:        0.02,
                stripe:       0.029,
                paypal:       0.034,
            };
            const processingFee = (methodFees[paymentMethod] || 0.02) * amount;

            const platformFee = parseFloat((amount * rate).toFixed(2));
            const sellerNet   = parseFloat((amount - platformFee - processingFee).toFixed(2));

            return {
                amount,
                rate:          rate * 100,
                platform:      platformFee,
                processingFee: parseFloat(processingFee.toFixed(2)),
                seller:        sellerNet,
            };
        },

        /**
         * Record commission to Firestore and update platform revenue
         */
        async record(orderId, buyerId, sellerId, commission) {
            if (!window.db || !window.COLLECTIONS) return;
            try {
                await window.db.collection(window.COLLECTIONS.PLATFORM_REVENUE).add({
                    source:     window.REVENUE_SOURCES?.COMMISSION || 'commission',
                    orderId,
                    buyerId,
                    sellerId,
                    amount:     commission.platform,
                    rate:       commission.rate,
                    orderTotal: commission.amount,
                    sellerNet:  commission.seller,
                    createdAt:  window.serverTimestamp ? window.serverTimestamp() : new Date(),
                });
                console.log(`[Commission] Recorded: ${commission.platform} EGP (${commission.rate}%)`);
            } catch (e) {
                console.warn('[Commission] Record error:', e.message);
            }
        }
    };

    // ── FEATURED LISTINGS MANAGER ────────────────────────────────────────────
    const FeaturedManager = {
        PRICES: {
            daily:   { price: 50,  label: 'يومي' },
            weekly:  { price: 200, label: 'أسبوعي' },
            monthly: { price: 600, label: 'شهري' },
        },

        async feature(serviceId, sellerId, duration = 'weekly') {
            if (!window.db || !window.COLLECTIONS) return false;
            try {
                const price = this.PRICES[duration]?.price || 200;
                const now   = new Date();
                const days  = { daily: 1, weekly: 7, monthly: 30 }[duration] || 7;
                const expires = new Date(now.getTime() + days * 86400000);

                await window.db.collection(window.COLLECTIONS.FEATURED || 'featured_listings').add({
                    serviceId, sellerId, duration,
                    price,
                    isActive:  true,
                    startedAt: window.serverTimestamp ? window.serverTimestamp() : now,
                    expiresAt: expires,
                });

                // Record revenue
                await window.db.collection(window.COLLECTIONS.PLATFORM_REVENUE).add({
                    source:    window.REVENUE_SOURCES?.FEATURED || 'featured',
                    serviceId, sellerId,
                    amount:    price,
                    duration,
                    createdAt: window.serverTimestamp ? window.serverTimestamp() : now,
                });

                return { success: true, price, expiresAt: expires };
            } catch (e) {
                console.warn('[Featured] Error:', e.message);
                return false;
            }
        },

        showModal(serviceId, sellerId) {
            document.getElementById('featuredModal')?.remove();
            const modal = document.createElement('div');
            modal.id = 'featuredModal';
            modal.className = 'fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
                    <div class="text-center mb-6">
                        <div class="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <i class="fa-solid fa-star text-amber-500 text-2xl"></i>
                        </div>
                        <h3 class="text-2xl font-black text-gray-900">تمييز الخدمة</h3>
                        <p class="text-gray-500 mt-1">اجعل خدمتك في الصدارة</p>
                    </div>
                    <div class="space-y-3 mb-6">
                        ${Object.entries(this.PRICES).map(([dur, info]) => `
                        <button onclick="window.FeaturedManager.feature('${serviceId}', '${sellerId}', '${dur}').then(r => { if(r) { document.getElementById('featuredModal').remove(); window.showToast && window.showToast('تم تمييز خدمتك! ✨', 'success'); }})"
                            class="w-full p-4 border-2 border-gray-200 rounded-2xl hover:border-amber-400 hover:bg-amber-50 transition flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <i class="fa-solid fa-star text-amber-500"></i>
                                <span class="font-bold">${info.label}</span>
                            </div>
                            <span class="font-black text-amber-600">${info.price} ج.م</span>
                        </button>`).join('')}
                    </div>
                    <button onclick="document.getElementById('featuredModal').remove()" class="w-full py-3 border-2 border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition">إلغاء</button>
                </div>`;
            document.body.appendChild(modal);
        },
    };

    // ── BOOST MANAGER ────────────────────────────────────────────────────────
    const BoostManager = {
        TYPES: {
            top_search:   { price: 30,  label: 'أعلى البحث',    icon: 'fa-magnifying-glass', duration: 7  },
            trending:     { price: 50,  label: 'الأكثر رواجاً', icon: 'fa-fire',             duration: 7  },
            recommended:  { price: 40,  label: 'موصى به',       icon: 'fa-thumbs-up',        duration: 14 },
            urgent:       { price: 25,  label: 'عاجل',          icon: 'fa-bolt',             duration: 3  },
        },

        async boost(serviceId, sellerId, type = 'top_search') {
            if (!window.db) return false;
            try {
                const info    = this.TYPES[type];
                const expires = new Date(Date.now() + (info?.duration || 7) * 86400000);
                await window.db.collection('boosts').add({
                    serviceId, sellerId, type,
                    price:     info?.price || 30,
                    isActive:  true,
                    expiresAt: expires,
                    createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                });
                await window.db.collection(window.COLLECTIONS?.PLATFORM_REVENUE || 'platform_revenue').add({
                    source:    window.REVENUE_SOURCES?.BOOST || 'boost',
                    serviceId, sellerId,
                    amount:    info?.price || 30,
                    boostType: type,
                    createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                });
                return { success: true, price: info?.price };
            } catch (e) {
                console.warn('[Boost] Error:', e.message);
                return false;
            }
        },
    };

    // ── VERIFICATION MANAGER ─────────────────────────────────────────────────
    const VerificationManager = {
        TIERS: {
            basic:    { price: 49,  label: 'توثيق أساسي',   badge: '✓' },
            business: { price: 199, label: 'توثيق تجاري',   badge: '🏢' },
            pro:      { price: 499, label: 'توثيق احترافي', badge: '⭐' },
        },

        async verify(userId, tier = 'basic') {
            if (!window.db) return false;
            try {
                const info = this.TIERS[tier];
                await window.db.collection('verifications').add({
                    userId, tier,
                    price:  info?.price || 49,
                    status: 'pending',
                    createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                });
                await window.db.collection(window.COLLECTIONS?.PLATFORM_REVENUE || 'platform_revenue').add({
                    source:    window.REVENUE_SOURCES?.VERIFICATION || 'verification',
                    userId,
                    amount:    info?.price || 49,
                    tier,
                    createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                });
                return { success: true, price: info?.price };
            } catch (e) {
                console.warn('[Verification] Error:', e.message);
                return false;
            }
        },
    };

    // ── PROMO CODE ENGINE ────────────────────────────────────────────────────
    const PromoEngine = {
        async validate(code, amount) {
            if (!window.db || !code) return null;
            try {
                const snap = await window.db.collection(window.COLLECTIONS?.PROMO_CODES || 'promo_codes')
                    .where('code', '==', code.toUpperCase().trim())
                    .where('isActive', '==', true)
                    .get();
                if (snap.empty) return null;

                const promo = { id: snap.docs[0].id, ...snap.docs[0].data() };
                const now   = new Date();

                if (promo.expiresAt?.toDate && promo.expiresAt.toDate() < now) return null;
                if (promo.usageLimit && promo.usageCount >= promo.usageLimit) return null;
                if (promo.minAmount && amount < promo.minAmount) return null;

                const discount = promo.type === 'percent'
                    ? parseFloat((amount * promo.value / 100).toFixed(2))
                    : Math.min(promo.value, amount);

                return { valid: true, discount, code: promo.code, type: promo.type, value: promo.value };
            } catch (e) {
                return null;
            }
        },

        async use(code, orderId, userId) {
            if (!window.db || !code) return;
            try {
                const snap = await window.db.collection(window.COLLECTIONS?.PROMO_CODES || 'promo_codes')
                    .where('code', '==', code.toUpperCase().trim())
                    .get();
                if (!snap.empty) {
                    await snap.docs[0].ref.update({ usageCount: window.increment ? window.increment(1) : 1 });
                }
            } catch (e) {}
        },
    };

    // ── AFFILIATE SYSTEM ─────────────────────────────────────────────────────
    const AffiliateSystem = {
        COMMISSION_RATE: 0.05, // 5% for affiliates

        generateLink(userId) {
            const ref = btoa(userId).replace(/=/g, '').substring(0, 12);
            return `${window.location.origin}?ref=${ref}`;
        },

        async trackReferral(referralCode, newUserId) {
            if (!window.db || !referralCode) return;
            try {
                await window.db.collection(window.COLLECTIONS?.AFFILIATES || 'affiliates').add({
                    referralCode,
                    newUserId,
                    status:    'registered',
                    earnings:  0,
                    createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                });
            } catch (e) {}
        },

        async recordEarning(referralCode, orderAmount) {
            if (!window.db || !referralCode) return;
            try {
                const earning = parseFloat((orderAmount * this.COMMISSION_RATE).toFixed(2));
                const snap = await window.db.collection(window.COLLECTIONS?.AFFILIATES || 'affiliates')
                    .where('referralCode', '==', referralCode)
                    .limit(1)
                    .get();
                if (!snap.empty) {
                    await snap.docs[0].ref.update({
                        earnings: window.increment ? window.increment(earning) : earning,
                        status: 'earned',
                    });
                }
                await window.db.collection(window.COLLECTIONS?.PLATFORM_REVENUE || 'platform_revenue').add({
                    source:    window.REVENUE_SOURCES?.AFFILIATE || 'affiliate',
                    referralCode,
                    amount:    earning,
                    createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                });
            } catch (e) {}
        },
    };

    // ── SUBSCRIPTION MANAGER ─────────────────────────────────────────────────
    const SubscriptionManager = {
        async subscribe(userId, planId, billingCycle = 'monthly') {
            if (!window.db) return false;
            const plans = window.SUBSCRIPTION_PLANS || {};
            const plan  = plans[planId];
            if (!plan) return false;

            const multiplier = { monthly: 1, quarterly: 3, yearly: 12 }[billingCycle] || 1;
            const discount   = { monthly: 1, quarterly: 0.9, yearly: 0.8 }[billingCycle] || 1;
            const price      = Math.round(plan.price * multiplier * discount);

            try {
                const expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + multiplier);

                await window.db.collection('subscriptions').doc(userId).set({
                    userId, planId, billingCycle, price,
                    commission:  plan.commission,
                    maxServices: plan.maxServices,
                    status:      'active',
                    expiresAt,
                    startedAt:   window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    updatedAt:   window.serverTimestamp ? window.serverTimestamp() : new Date(),
                }, { merge: true });

                await window.db.collection('users').doc(userId).update({
                    subscriptionPlan: planId,
                    commission:       plan.commission,
                    badge:            plan.badge,
                    updatedAt:        window.serverTimestamp ? window.serverTimestamp() : new Date(),
                });

                if (price > 0) {
                    await window.db.collection(window.COLLECTIONS?.PLATFORM_REVENUE || 'platform_revenue').add({
                        source:       window.REVENUE_SOURCES?.SUBSCRIPTION || 'subscription',
                        userId, planId, billingCycle,
                        amount:       price,
                        createdAt:    window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });
                }

                return { success: true, plan, price, expiresAt };
            } catch (e) {
                console.warn('[Subscription] Error:', e.message);
                return false;
            }
        },

        showPlansModal(userId) {
            document.getElementById('subsModal')?.remove();
            const plans  = window.SUBSCRIPTION_PLANS || {};
            const modal  = document.createElement('div');
            modal.id = 'subsModal';
            modal.className = 'fixed inset-0 bg-black/60 z-[99998] flex items-center justify-center p-4 overflow-y-auto';

            const planCards = Object.entries(plans).map(([id, plan]) => {
                const isPopular = id === 'pro';
                return `
                <div class="relative bg-white rounded-2xl p-6 border-2 ${isPopular ? 'border-indigo-500' : 'border-gray-200'} hover:border-indigo-400 transition">
                    ${isPopular ? '<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">الأشهر</div>' : ''}
                    <div class="text-center mb-4">
                        <h4 class="text-lg font-black text-gray-900">${plan.nameAr}</h4>
                        <p class="text-3xl font-black text-indigo-600 mt-2">${plan.price > 0 ? plan.price + ' ج.م' : 'مجاناً'}</p>
                        <p class="text-xs text-gray-400">/شهر</p>
                    </div>
                    <ul class="space-y-2 text-sm mb-5">
                        ${(plan.features || []).map(f => `<li class="flex items-center gap-2"><i class="fa-solid fa-check text-green-500 text-xs"></i>${f}</li>`).join('')}
                        <li class="flex items-center gap-2 text-gray-500"><i class="fa-solid fa-percent text-xs text-indigo-500"></i>عمولة ${plan.commission}%</li>
                    </ul>
                    <button onclick="window.SubscriptionManager.subscribe('${userId}', '${id}').then(r => { if(r) { document.getElementById('subsModal').remove(); window.showToast && window.showToast('تم الاشتراك بنجاح! 🎉', 'success'); }})"
                        class="w-full py-3 ${isPopular ? 'bg-indigo-600 text-white' : 'border-2 border-indigo-500 text-indigo-600'} rounded-xl font-bold hover:opacity-90 transition">
                        ${plan.price > 0 ? 'اشترك الآن' : 'ابدأ مجاناً'}
                    </button>
                </div>`;
            }).join('');

            modal.innerHTML = `
                <div class="bg-gray-50 rounded-3xl w-full max-w-4xl p-8">
                    <div class="text-center mb-8">
                        <h2 class="text-3xl font-black text-gray-900">باقات الاشتراك</h2>
                        <p class="text-gray-500 mt-2">اختر الباقة المناسبة لنشاطك التجاري</p>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">${planCards}</div>
                    <button onclick="document.getElementById('subsModal').remove()" class="w-full py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition">إغلاق</button>
                </div>`;
            document.body.appendChild(modal);
        },
    };

    // ── WALLET REVENUE (fees on top-ups/withdrawals) ─────────────────────────
    const WalletRevenue = {
        TOP_UP_FEE:    0.01, // 1% on top-up
        WITHDRAW_FEE:  0.02, // 2% on withdrawal
        TRANSFER_FEE:  0.005, // 0.5% on transfers

        async chargeTopUpFee(userId, amount) {
            const fee = parseFloat((amount * this.TOP_UP_FEE).toFixed(2));
            if (fee <= 0 || !window.db) return fee;
            try {
                await window.db.collection(window.COLLECTIONS?.PLATFORM_REVENUE || 'platform_revenue').add({
                    source:    window.REVENUE_SOURCES?.WALLET_FEE || 'wallet_fee',
                    feeType:   'top_up',
                    userId,
                    amount:    fee,
                    baseAmount: amount,
                    createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                });
            } catch (e) {}
            return fee;
        },
    };

    // ── GLOBAL EXPORTS ───────────────────────────────────────────────────────
    window.CommissionEngine    = CommissionEngine;
    window.FeaturedManager     = FeaturedManager;
    window.BoostManager        = BoostManager;
    window.VerificationManager = VerificationManager;
    window.PromoEngine         = PromoEngine;
    window.AffiliateSystem     = AffiliateSystem;
    window.SubscriptionManager = SubscriptionManager;
    window.WalletRevenue       = WalletRevenue;

    // Auto-track referral code from URL
    (function checkReferral() {
        const ref = new URLSearchParams(window.location.search).get('ref');
        if (ref) {
            sessionStorage.setItem('mall_referral', ref);
            const clean = new URL(window.location.href);
            clean.searchParams.delete('ref');
            window.history.replaceState({}, '', clean.toString());
        }
    })();

    console.log('✅ Revenue Management System v3.0.0 loaded');
})();
