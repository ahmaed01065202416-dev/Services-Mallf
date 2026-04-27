/**
 * i18n.js — Full Bilingual System (AR/EN) — Mall Services v4.0
 * نظام الترجمة الكامل — يغطي كل نص في الموقع
 */
(function () {
    'use strict';

    // ══════════════════════════════════════════════════════════
    // TRANSLATIONS — كل نصوص الموقع
    // ══════════════════════════════════════════════════════════
    const TR = {
        ar: {
            // ── SITE ────────────────────────────────────────────
            siteName: 'مول الخدمات', siteTagline: 'منصتك الأولى للخدمات الاحترافية',
            // ── NAV ─────────────────────────────────────────────
            home: 'الرئيسية', services: 'الخدمات', orders: 'طلباتي',
            cart: 'السلة', wallet: 'محفظتي', profile: 'ملفي الشخصي',
            login: 'تسجيل الدخول', register: 'إنشاء حساب', logout: 'تسجيل الخروج',
            dashboard: 'لوحة التحكم', notifications: 'الإشعارات', messages: 'الرسائل',
            favorites: 'المفضلة', adminPanel: 'لوحة الإدارة', settings: 'الإعدادات',
            // ── ACTIONS ─────────────────────────────────────────
            buyNow: 'اشترِ الآن', addToCart: 'أضف للسلة', checkout: 'إتمام الدفع',
            payNow: 'ادفع الآن', cancel: 'إلغاء', confirm: 'تأكيد', save: 'حفظ',
            edit: 'تعديل', delete: 'حذف', search: 'بحث', filter: 'تصفية',
            sort: 'ترتيب', loadMore: 'تحميل المزيد', submit: 'إرسال',
            upload: 'رفع ملف', download: 'تحميل', close: 'إغلاق', back: 'رجوع',
            next: 'التالي', prev: 'السابق', yes: 'نعم', no: 'لا',
            apply: 'تطبيق', clear: 'مسح', refresh: 'تحديث', copy: 'نسخ',
            // ── DELIVERY ────────────────────────────────────────
            confirmDelivery: 'تأكيد الاستلام', requestRevision: 'طلب مراجعة',
            openDispute: 'فتح نزاع', releasePayment: 'إطلاق الدفع',
            markDelivered: 'تعليم كمسلَّم', deliverWork: 'تسليم العمل',
            // ── ORDER STATUS ─────────────────────────────────────
            pending: 'قيد الانتظار', inProgress: 'جاري التنفيذ',
            delivered: 'تم التسليم', completed: 'مكتمل', cancelled: 'ملغي',
            disputed: 'نزاع', refunded: 'مسترجع', onHold: 'محجوز',
            revision: 'مراجعة مطلوبة', accepted: 'مقبول', rejected: 'مرفوض',
            // ── PAYMENT ─────────────────────────────────────────
            paymentMethod: 'طريقة الدفع', totalAmount: 'المبلغ الإجمالي',
            subtotal: 'المجموع الفرعي', fees: 'رسوم الخدمة (5%)', tax: 'الضريبة',
            discount: 'الخصم', promoCode: 'كود خصم', applyPromo: 'تطبيق الكود',
            securePayment: 'دفع آمن ومشفر 256-bit', paymentSuccess: 'تم الدفع بنجاح! ✅',
            paymentFailed: 'فشل الدفع. حاول مرة أخرى', processing: 'جاري المعالجة...',
            localPayments: 'الدفع المحلي — مصر', intlPayments: 'الدفع الدولي',
            // ── CART ────────────────────────────────────────────
            cartEmpty: 'السلة فارغة', cartEmptySub: 'أضف خدمات واستمر في التسوق',
            removeItem: 'حذف', clearCart: 'تفريغ السلة',
            continueShopping: 'متابعة التسوق', proceedCheckout: 'إتمام الشراء',
            itemsInCart: 'عناصر في السلة', promoApplied: 'تم تطبيق الخصم ✅',
            promoInvalid: 'كود الخصم غير صحيح',
            // ── ORDERS ──────────────────────────────────────────
            orderDetails: 'تفاصيل الطلب', orderNumber: 'رقم الطلب',
            orderDate: 'تاريخ الطلب', deliveryDate: 'موعد التسليم',
            seller: 'مقدم الخدمة', buyer: 'العميل', service: 'الخدمة',
            noOrders: 'لا توجد طلبات بعد', viewOrder: 'عرض الطلب',
            orderTimeline: 'مسار الطلب', allOrders: 'كل الطلبات',
            // ── WORKSPACE ───────────────────────────────────────
            workspace: 'مساحة العمل', sendMessage: 'إرسال رسالة',
            typeMessage: 'اكتب رسالتك...', attachFile: 'إرفاق ملف',
            deliveryNote: 'ملاحظات التسليم', revisionNote: 'ملاحظات المراجعة',
            disputeReason: 'سبب النزاع', deliveryHistory: 'سجل التسليمات',
            // ── ESCROW ──────────────────────────────────────────
            escrowHeld: 'الدفع محجوز بأمان', escrowInfo: 'سيتم تحرير الأموال بعد تأكيد الاستلام',
            escrowReleased: 'تم تحويل الأموال للبائع', escrowRefunded: 'تم استرجاع الأموال',
            disputeOpened: 'تم فتح النزاع — تحت المراجعة',
            // ── WALLET ──────────────────────────────────────────
            walletBalance: 'الرصيد المتاح', pendingBalance: 'قيد المعالجة',
            totalEarned: 'إجمالي الأرباح', withdraw: 'سحب', topUp: 'شحن الرصيد',
            withdrawMin: 'الحد الأدنى للسحب 100 ج.م',
            // ── SERVICES ────────────────────────────────────────
            startingAt: 'يبدأ من', deliveryTime: 'مدة التسليم',
            days: 'أيام', day: 'يوم', hours: 'ساعات',
            reviews: 'تقييمات', rating: 'التقييم', orders_done: 'طلب مكتمل',
            category: 'الفئة', allCategories: 'كل الفئات',
            newService: 'خدمة جديدة', editService: 'تعديل الخدمة',
            serviceTitle: 'عنوان الخدمة', serviceDesc: 'وصف الخدمة',
            servicePrice: 'السعر', serviceDelivery: 'مدة التسليم (أيام)',
            // ── NOTIFICATIONS ───────────────────────────────────
            newOrder: 'طلب جديد', orderUpdated: 'تم تحديث الطلب',
            paymentReceived: 'تم استلام الدفع', deliveryReceived: 'تم استلام التسليم',
            disputeUpdate: 'تحديث النزاع', markAllRead: 'تعليم الكل كمقروء',
            // ── ERRORS ──────────────────────────────────────────
            loginRequired: 'يجب تسجيل الدخول أولاً', networkError: 'خطأ في الاتصال',
            tryAgain: 'حاول مجدداً', somethingWrong: 'حدث خطأ ما',
            // ── MISC ────────────────────────────────────────────
            by: 'بواسطة', at: 'في', from: 'من', to: 'إلى',
            total: 'الإجمالي', or: 'أو', and: 'و', of: 'من',
            loading: 'جاري التحميل...', empty: 'لا توجد بيانات',
            dir: 'rtl', locale: 'ar-EG', currencyCode: 'EGP',
        },
        en: {
            // ── SITE ────────────────────────────────────────────
            siteName: 'Mall Services', siteTagline: 'Your #1 Professional Services Platform',
            // ── NAV ─────────────────────────────────────────────
            home: 'Home', services: 'Services', orders: 'My Orders',
            cart: 'Cart', wallet: 'Wallet', profile: 'Profile',
            login: 'Login', register: 'Sign Up', logout: 'Logout',
            dashboard: 'Dashboard', notifications: 'Notifications', messages: 'Messages',
            favorites: 'Favorites', adminPanel: 'Admin Panel', settings: 'Settings',
            // ── ACTIONS ─────────────────────────────────────────
            buyNow: 'Buy Now', addToCart: 'Add to Cart', checkout: 'Checkout',
            payNow: 'Pay Now', cancel: 'Cancel', confirm: 'Confirm', save: 'Save',
            edit: 'Edit', delete: 'Delete', search: 'Search', filter: 'Filter',
            sort: 'Sort', loadMore: 'Load More', submit: 'Submit',
            upload: 'Upload File', download: 'Download', close: 'Close', back: 'Back',
            next: 'Next', prev: 'Previous', yes: 'Yes', no: 'No',
            apply: 'Apply', clear: 'Clear', refresh: 'Refresh', copy: 'Copy',
            // ── DELIVERY ────────────────────────────────────────
            confirmDelivery: 'Confirm Delivery', requestRevision: 'Request Revision',
            openDispute: 'Open Dispute', releasePayment: 'Release Payment',
            markDelivered: 'Mark as Delivered', deliverWork: 'Deliver Work',
            // ── ORDER STATUS ─────────────────────────────────────
            pending: 'Pending', inProgress: 'In Progress',
            delivered: 'Delivered', completed: 'Completed', cancelled: 'Cancelled',
            disputed: 'Disputed', refunded: 'Refunded', onHold: 'On Hold',
            revision: 'Revision Requested', accepted: 'Accepted', rejected: 'Rejected',
            // ── PAYMENT ─────────────────────────────────────────
            paymentMethod: 'Payment Method', totalAmount: 'Total Amount',
            subtotal: 'Subtotal', fees: 'Service Fee (5%)', tax: 'Tax',
            discount: 'Discount', promoCode: 'Promo Code', applyPromo: 'Apply Code',
            securePayment: '256-bit Encrypted Secure Payment', paymentSuccess: 'Payment Successful! ✅',
            paymentFailed: 'Payment Failed. Please try again.', processing: 'Processing...',
            localPayments: 'Local Payments — Egypt', intlPayments: 'International Payments',
            // ── CART ────────────────────────────────────────────
            cartEmpty: 'Your cart is empty', cartEmptySub: 'Add services to get started',
            removeItem: 'Remove', clearCart: 'Clear Cart',
            continueShopping: 'Continue Shopping', proceedCheckout: 'Proceed to Checkout',
            itemsInCart: 'items in cart', promoApplied: 'Promo code applied ✅',
            promoInvalid: 'Invalid promo code',
            // ── ORDERS ──────────────────────────────────────────
            orderDetails: 'Order Details', orderNumber: 'Order #',
            orderDate: 'Order Date', deliveryDate: 'Delivery Date',
            seller: 'Service Provider', buyer: 'Buyer', service: 'Service',
            noOrders: 'No orders yet', viewOrder: 'View Order',
            orderTimeline: 'Order Timeline', allOrders: 'All Orders',
            // ── WORKSPACE ───────────────────────────────────────
            workspace: 'Workspace', sendMessage: 'Send Message',
            typeMessage: 'Type your message...', attachFile: 'Attach File',
            deliveryNote: 'Delivery Notes', revisionNote: 'Revision Notes',
            disputeReason: 'Dispute Reason', deliveryHistory: 'Delivery History',
            // ── ESCROW ──────────────────────────────────────────
            escrowHeld: 'Payment Held Securely', escrowInfo: 'Funds release after delivery confirmation',
            escrowReleased: 'Funds released to seller', escrowRefunded: 'Funds refunded to buyer',
            disputeOpened: 'Dispute opened — Under review',
            // ── WALLET ──────────────────────────────────────────
            walletBalance: 'Available Balance', pendingBalance: 'Pending',
            totalEarned: 'Total Earned', withdraw: 'Withdraw', topUp: 'Top Up',
            withdrawMin: 'Minimum withdrawal: 100 EGP',
            // ── SERVICES ────────────────────────────────────────
            startingAt: 'Starting at', deliveryTime: 'Delivery Time',
            days: 'days', day: 'day', hours: 'hours',
            reviews: 'reviews', rating: 'Rating', orders_done: 'orders done',
            category: 'Category', allCategories: 'All Categories',
            newService: 'New Service', editService: 'Edit Service',
            serviceTitle: 'Service Title', serviceDesc: 'Service Description',
            servicePrice: 'Price', serviceDelivery: 'Delivery (days)',
            // ── NOTIFICATIONS ───────────────────────────────────
            newOrder: 'New Order', orderUpdated: 'Order Updated',
            paymentReceived: 'Payment Received', deliveryReceived: 'Delivery Received',
            disputeUpdate: 'Dispute Update', markAllRead: 'Mark All Read',
            // ── ERRORS ──────────────────────────────────────────
            loginRequired: 'Please login first', networkError: 'Network error',
            tryAgain: 'Try again', somethingWrong: 'Something went wrong',
            // ── MISC ────────────────────────────────────────────
            by: 'by', at: 'at', from: 'from', to: 'to',
            total: 'Total', or: 'or', and: 'and', of: 'of',
            loading: 'Loading...', empty: 'No data available',
            dir: 'ltr', locale: 'en-US', currencyCode: 'USD',
        }
    };

    // ══════════════════════════════════════════════════════════
    // CURRENCIES
    // ══════════════════════════════════════════════════════════
    const CURRENCIES = {
        EGP: { symbol: 'ج.م',  name: 'الجنيه المصري',    nameEn: 'Egyptian Pound',  rate: 1,      locale: 'ar-EG', digits: 2 },
        USD: { symbol: '$',    name: 'الدولار الأمريكي',  nameEn: 'US Dollar',       rate: 0.0206, locale: 'en-US', digits: 2 },
        EUR: { symbol: '€',    name: 'اليورو',            nameEn: 'Euro',            rate: 0.019,  locale: 'de-DE', digits: 2 },
        GBP: { symbol: '£',    name: 'الجنيه الإسترليني', nameEn: 'British Pound',   rate: 0.016,  locale: 'en-GB', digits: 2 },
        SAR: { symbol: 'ر.س', name: 'الريال السعودي',    nameEn: 'Saudi Riyal',     rate: 0.077,  locale: 'ar-SA', digits: 2 },
        AED: { symbol: 'د.إ', name: 'الدرهم الإماراتي',  nameEn: 'UAE Dirham',      rate: 0.0756, locale: 'ar-AE', digits: 2 },
    };

    // Country → currency auto-detection
    const COUNTRY_CURRENCY = {
        EG: 'EGP', US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR',
        SA: 'SAR', AE: 'AED', KW: 'KWD', QA: 'QAR',
    };

    // ══════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════
    let _lang     = localStorage.getItem('mall_lang')     || 'ar';
    let _currency = localStorage.getItem('mall_currency') || 'EGP';

    // ══════════════════════════════════════════════════════════
    // CORE FUNCTIONS
    // ══════════════════════════════════════════════════════════

    function t(key) {
        return (TR[_lang] && TR[_lang][key]) || (TR['ar'] && TR['ar'][key]) || key;
    }

    function setLang(lang) {
        if (!TR[lang]) return;
        _lang = lang;
        localStorage.setItem('mall_lang', lang);
        document.documentElement.lang = lang;
        document.documentElement.dir  = TR[lang].dir || (lang === 'ar' ? 'rtl' : 'ltr');
        _applyTranslations();
        _dispatchLangChange(lang);
        console.log('[i18n] Language set to:', lang);
    }

    function setCurrency(code) {
        if (!CURRENCIES[code]) return;
        _currency = code;
        localStorage.setItem('mall_currency', code);
        _applyCurrencyUpdates();
        console.log('[i18n] Currency set to:', code);
    }

    function fmt(amountEGP, opts = {}) {
        const cur  = CURRENCIES[_currency] || CURRENCIES.EGP;
        const conv = parseFloat(amountEGP || 0) * cur.rate;
        if (opts.symbolOnly) return cur.symbol;
        return `${cur.symbol}${conv.toLocaleString(cur.locale, {
            minimumFractionDigits: cur.digits,
            maximumFractionDigits: cur.digits,
        })}`;
    }

    function fmtNative(amountEGP) {
        return fmt(amountEGP);
    }

    // Detect country from browser/IP (best-effort)
    async function detectCountry() {
        try {
            const r   = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
            const d   = await r.json();
            const cur = COUNTRY_CURRENCY[d.country_code] || 'EGP';
            if (!localStorage.getItem('mall_currency')) setCurrency(cur);
            if (!localStorage.getItem('mall_lang')) {
                if (d.country_code !== 'EG' && d.languages && !d.languages.startsWith('ar')) {
                    setLang('en');
                }
            }
        } catch (_) { /* silent fallback */ }
    }

    function _applyTranslations() {
        // data-i18n → textContent
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const val = t(key);
            if (val && val !== key) el.textContent = val;
        });
        // data-i18n-ph → placeholder
        document.querySelectorAll('[data-i18n-ph]').forEach(el => {
            const key = el.getAttribute('data-i18n-ph');
            const val = t(key);
            if (val && val !== key) el.placeholder = val;
        });
        // data-i18n-title → title attr
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const val = t(key);
            if (val && val !== key) el.title = val;
        });
    }

    function _applyCurrencyUpdates() {
        document.querySelectorAll('[data-price-egp]').forEach(el => {
            const egp = parseFloat(el.getAttribute('data-price-egp') || 0);
            el.textContent = fmt(egp);
        });
    }

    function _dispatchLangChange(lang) {
        window.dispatchEvent(new CustomEvent('mall:langchange', { detail: { lang } }));
    }

    // ══════════════════════════════════════════════════════════
    // EXPORTS
    // ══════════════════════════════════════════════════════════
    window.t            = t;
    window.setLang      = setLang;
    window.setCurrency  = setCurrency;
    window.fmt          = fmt;
    window.fmtNative    = fmtNative;
    window.CURRENCIES   = CURRENCIES;
    window.TR           = TR;

    // Apply on load
    setLang(_lang);
    detectCountry();

    console.log('✅ i18n v4.0 ready — lang:', _lang, '| currency:', _currency);
})();
