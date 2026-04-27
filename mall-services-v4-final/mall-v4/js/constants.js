/**
 * ============================================================================
 * CONSTANTS & HELPERS — MALL SERVICES PLATFORM v3.0.0
 * يُحمَّل مباشرة بعد firebase-config.js
 * ============================================================================
 */

// ── Firestore Collections ────────────────────────────────────────────────────
const COLLECTIONS = {
    USERS:            'users',
    SERVICES:         'services',
    ORDERS:           'orders',
    REVIEWS:          'reviews',
    NOTIFICATIONS:    'notifications',
    MESSAGES:         'messages',
    CONVERSATIONS:    'conversations',
    WALLET:           'wallets',
    TRANSACTIONS:     'transactions',
    PAYMENTS:         'payments',
    REPORTS:          'reports',
    CATEGORIES:       'categories',
    SUBSCRIPTIONS:    'subscriptions',
    ADS:              'ads',
    FEATURED:         'featured_listings',
    AFFILIATES:       'affiliates',
    PROMO_CODES:      'promo_codes',
    REVENUE:          'revenue',
    PLATFORM_REVENUE: 'platform_revenue',
    BOOSTS:           'boosts',
    VERIFICATIONS:    'verifications',
};

// ── Storage Folders ──────────────────────────────────────────────────────────
const STORAGE_FOLDERS = {
    AVATARS:  'avatars',
    SERVICES: 'services',
    CHAT:     'chat',
    DOCS:     'docs',
    ADS:      'ads',
};

// ── Platform Config ──────────────────────────────────────────────────────────
const PLATFORM = {
    FEE_PERCENT:       5,
    MIN_WITHDRAWAL:    100,
    CURRENCY:          'ج.م',
    CURRENCY_CODE:     'EGP',
    NAME:              'مول الخدمات',
    NAME_EN:           'Mall Services',
    SUPPORT_EMAIL:     'support@mall-services.com',
    VERSION:           '3.0.0',
};

// ── Seller Subscription Plans ────────────────────────────────────────────────
const SUBSCRIPTION_PLANS = {
    free: {
        id: 'free', nameAr: 'مجاني', nameEn: 'Free',
        price: 0, currency: 'EGP',
        maxServices: 3, commission: 10,
        features: ['3 خدمات', 'دعم أساسي'],
        badge: null,
    },
    basic: {
        id: 'basic', nameAr: 'أساسي', nameEn: 'Basic',
        price: 99, currency: 'EGP',
        maxServices: 10, commission: 8,
        features: ['10 خدمات', 'ظهور محسّن', 'دعم بريد إلكتروني'],
        badge: 'basic',
    },
    pro: {
        id: 'pro', nameAr: 'احترافي', nameEn: 'Pro',
        price: 299, currency: 'EGP',
        maxServices: 50, commission: 5,
        features: ['50 خدمة', 'Featured تلقائي', 'تقارير متقدمة', 'دعم أولوية'],
        badge: 'pro',
    },
    business: {
        id: 'business', nameAr: 'تجاري', nameEn: 'Business',
        price: 599, currency: 'EGP',
        maxServices: 200, commission: 3,
        features: ['200 خدمة', 'Boost أسبوعي', 'مدير حساب', 'API Access'],
        badge: 'business',
    },
    vip: {
        id: 'vip', nameAr: 'VIP', nameEn: 'VIP',
        price: 1499, currency: 'EGP',
        maxServices: -1, commission: 1,
        features: ['خدمات غير محدودة', 'Featured دائم', 'White Label', 'عمولة 1%'],
        badge: 'vip',
    },
};

// ── Revenue Sources (for Dashboard) ─────────────────────────────────────────
const REVENUE_SOURCES = {
    COMMISSION:         'commission',
    SUBSCRIPTION:       'subscription',
    FEATURED:           'featured',
    BOOST:              'boost',
    AD:                 'ad',
    VERIFICATION:       'verification',
    WALLET_FEE:         'wallet_fee',
    AFFILIATE:          'affiliate',
    API_ACCESS:         'api_access',
    ENTERPRISE:         'enterprise',
    LISTING_FEE:        'listing_fee',
    RENEWAL_FEE:        'renewal_fee',
};

// ── Currencies ───────────────────────────────────────────────────────────────
const CURRENCIES = {
    EGP: { symbol: 'ج.م', name: 'الجنيه المصري', nameEn: 'Egyptian Pound', rate: 1 },
    USD: { symbol: '$',   name: 'الدولار الأمريكي', nameEn: 'US Dollar',    rate: 0.021 },
    EUR: { symbol: '€',   name: 'اليورو',           nameEn: 'Euro',         rate: 0.019 },
    GBP: { symbol: '£',   name: 'الجنيه الإسترليني', nameEn: 'British Pound', rate: 0.016 },
    SAR: { symbol: 'ر.س', name: 'الريال السعودي',   nameEn: 'Saudi Riyal',  rate: 0.079 },
    AED: { symbol: 'د.إ', name: 'الدرهم الإماراتي', nameEn: 'UAE Dirham',   rate: 0.077 },
};

// ── i18n Translations ────────────────────────────────────────────────────────
const I18N = {
    ar: {
        home: 'الرئيسية', services: 'الخدمات', orders: 'طلباتي',
        cart: 'السلة', wallet: 'محفظتي', profile: 'ملفي الشخصي',
        login: 'تسجيل الدخول', register: 'إنشاء حساب', logout: 'تسجيل الخروج',
        dashboard: 'لوحة التحكم', notifications: 'الإشعارات',
        search: 'ابحث عن خدمة...', buy: 'اشتر الآن', addToCart: 'أضف للسلة',
        checkout: 'إتمام الدفع', payNow: 'ادفع الآن',
        totalEarnings: 'إجمالي الأرباح', totalOrders: 'إجمالي الطلبات',
        pending: 'قيد المعالجة', completed: 'مكتمل', cancelled: 'ملغي',
        currency: 'EGP', dir: 'rtl', lang: 'ar',
    },
    en: {
        home: 'Home', services: 'Services', orders: 'My Orders',
        cart: 'Cart', wallet: 'Wallet', profile: 'Profile',
        login: 'Login', register: 'Register', logout: 'Logout',
        dashboard: 'Dashboard', notifications: 'Notifications',
        search: 'Search for a service...', buy: 'Buy Now', addToCart: 'Add to Cart',
        checkout: 'Checkout', payNow: 'Pay Now',
        totalEarnings: 'Total Earnings', totalOrders: 'Total Orders',
        pending: 'Pending', completed: 'Completed', cancelled: 'Cancelled',
        currency: 'USD', dir: 'ltr', lang: 'en',
    }
};

// ── Current Language State ───────────────────────────────────────────────────
let _currentLang = localStorage.getItem('mall_lang') || 'ar';
let _currentCurrency = localStorage.getItem('mall_currency') || 'EGP';

function t(key) {
    return (I18N[_currentLang] && I18N[_currentLang][key]) || key;
}

function setLang(lang) {
    if (!I18N[lang]) return;
    _currentLang = lang;
    localStorage.setItem('mall_lang', lang);
    document.documentElement.dir  = I18N[lang].dir;
    document.documentElement.lang = lang;
    // Refresh UI labels
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t(key) !== key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t(key) !== key) el.placeholder = t(key);
    });
}

function setCurrency(code) {
    if (!CURRENCIES[code]) return;
    _currentCurrency = code;
    localStorage.setItem('mall_currency', code);
}

function convertCurrency(amountEGP) {
    const cur = CURRENCIES[_currentCurrency] || CURRENCIES.EGP;
    return (amountEGP * cur.rate).toFixed(2);
}

function formatCurrencyFull(amountEGP) {
    const cur = CURRENCIES[_currentCurrency] || CURRENCIES.EGP;
    const converted = amountEGP * cur.rate;
    return `${cur.symbol}${converted.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// ── Firebase Helpers ─────────────────────────────────────────────────────────
function serverTimestamp() {
    if (window.firebase?.firestore?.FieldValue) {
        return window.firebase.firestore.FieldValue.serverTimestamp();
    }
    return new Date();
}

function increment(value) {
    if (window.firebase?.firestore?.FieldValue) {
        return window.firebase.firestore.FieldValue.increment(value);
    }
    return value;
}

async function uploadFile(file, folder, filename) {
    if (!window.storage) throw new Error('Storage not initialized');
    const ext  = file.name.split('.').pop();
    const path = `${folder}/${filename}.${ext}`;
    const ref  = window.storage.ref(path);
    await ref.put(file);
    return await ref.getDownloadURL();
}

function generateId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatDateAr(timestamp) {
    if (!timestamp) return '—';
    let date;
    if (timestamp?.toDate)       date = timestamp.toDate();
    else if (timestamp?.seconds) date = new Date(timestamp.seconds * 1000);
    else                         date = new Date(timestamp);
    if (isNaN(date.getTime()))   return '—';
    const locale = _currentLang === 'en' ? 'en-US' : 'ar-EG';
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatCurrency(amount) {
    if (isNaN(amount)) return `0 ${PLATFORM.CURRENCY}`;
    return formatCurrencyFull(Number(amount));
}

function previewImage(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('serviceImagePreview');
        const zone    = document.getElementById('uploadZoneText');
        if (preview) { preview.src = e.target.result; preview.classList.remove('hidden'); }
        if (zone)    { zone.classList.add('hidden'); }
    };
    reader.readAsDataURL(file);
}

// ── Revenue Tracker (Platform) ───────────────────────────────────────────────
const RevenueTracker = {
    async record(source, amount, meta = {}) {
        if (!window.db) return;
        try {
            const today = new Date();
            const dayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
            await window.db.collection(COLLECTIONS.PLATFORM_REVENUE).add({
                source,
                amount: parseFloat(amount),
                meta,
                date: dayKey,
                month: dayKey.substring(0, 7),
                year:  String(today.getFullYear()),
                createdAt: serverTimestamp(),
            });
        } catch (e) {
            console.warn('[RevenueTracker] Failed to record:', e.message);
        }
    },

    async getDashboardStats(range = 'month') {
        if (!window.db) return null;
        try {
            const now = new Date();
            let startDate;
            switch (range) {
                case 'day':   startDate = new Date(now.setHours(0,0,0,0)); break;
                case 'week':  startDate = new Date(now - 7*86400000); break;
                case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
                case 'year':  startDate = new Date(now.getFullYear(), 0, 1); break;
                default:      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
            const snap = await window.db.collection(COLLECTIONS.PLATFORM_REVENUE)
                .where('createdAt', '>=', startDate)
                .get();

            const stats = { total: 0, bySource: {} };
            snap.forEach(doc => {
                const d = doc.data();
                stats.total += d.amount || 0;
                stats.bySource[d.source] = (stats.bySource[d.source] || 0) + (d.amount || 0);
            });
            return stats;
        } catch (e) {
            console.warn('[RevenueTracker] getDashboardStats error:', e.message);
            return null;
        }
    }
};

// ── Export globals ───────────────────────────────────────────────────────────
window.COLLECTIONS       = COLLECTIONS;
window.STORAGE_FOLDERS   = STORAGE_FOLDERS;
window.PLATFORM          = PLATFORM;
window.SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS;
window.REVENUE_SOURCES   = REVENUE_SOURCES;
window.CURRENCIES        = CURRENCIES;
window.I18N              = I18N;
window.RevenueTracker    = RevenueTracker;

// Helper functions
window.t                 = t;
window.setLang           = setLang;
window.setCurrency       = setCurrency;
window.convertCurrency   = convertCurrency;
window.formatCurrencyFull = formatCurrencyFull;
window.serverTimestamp   = serverTimestamp;
window.increment         = increment;
window.uploadFile        = uploadFile;
window.generateId        = generateId;
window.formatDateAr      = formatDateAr;
window.formatCurrency    = formatCurrency;
window.previewImage      = previewImage;

// Apply saved language on load
setLang(_currentLang);

console.log('✅ Constants v3.0.0 loaded — lang:', _currentLang, '| currency:', _currentCurrency);
