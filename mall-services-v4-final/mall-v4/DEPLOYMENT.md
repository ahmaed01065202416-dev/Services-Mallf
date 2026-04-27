# Mall Services v3.0.0 — Deployment Guide
## دليل النشر الاحترافي

---

## 🚀 خطوات النشر على Netlify

### 1. رفع المشروع
```
1. اذهب إلى: https://app.netlify.com
2. اختر "Add new site" → "Deploy manually" أو "Import from Git"
3. ارفع مجلد المشروع أو اربطه بـ GitHub
```

### 2. متغيرات البيئة (مطلوبة)
اذهب إلى: **Site Settings → Environment Variables**

```
# Paymob (مطلوب للدفع المحلي)
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_INTEGRATION_CARD=integration_id_for_visa_mc
PAYMOB_INTEGRATION_WALLET=integration_id_for_mobile_wallet
PAYMOB_INTEGRATION_FAWRY=integration_id_for_fawry
PAYMOB_IFRAME_ID=your_iframe_id
PAYMOB_HMAC_SECRET=your_hmac_secret_from_paymob

# Stripe (مطلوب للدفع الدولي)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=live

# Wise
WISE_API_TOKEN=your_wise_api_token
WISE_PROFILE_ID=your_profile_id

# Firebase Admin (للـ functions)
FIREBASE_ADMIN_SDK={"type":"service_account","project_id":"..."}

# Platform
PLATFORM_FEE_PERCENT=5
URL=https://mall-services1.netlify.app
```

### 3. Firebase Setup
```
# تثبيت Firebase CLI
npm install -g firebase-tools

# تسجيل الدخول
firebase login

# نشر الـ Security Rules
firebase deploy --only firestore:rules

# نشر الـ Indexes (مهم جداً لإزالة خطأ الـ indexes)
firebase deploy --only firestore:indexes
```

### 4. Build Command
تم الإعداد تلقائياً في `netlify.toml`:
```
npm install && npm run build:css && cd netlify/functions && npm install
```

---

## 🔧 إعداد Firebase Console

### Firestore Composite Indexes
انتظر بعد `firebase deploy --only firestore:indexes` أو أنشئها يدوياً من:
**Firebase Console → Firestore → Indexes**

### Auth Providers المطلوب تفعيلها:
- Email/Password ✅
- Google ✅

### Authorized Domains (مهم!):
**Firebase Console → Authentication → Settings → Authorized domains**
أضف: `mall-services1.netlify.app`

---

## 💳 إعداد Paymob

1. اذهب إلى: https://accept.paymob.com
2. **API Keys** → انسخ الـ API Key
3. **Payment Integrations** → أنشئ integrations لـ:
   - Card (Visa/Mastercard/Meeza)
   - Mobile Wallet
   - Fawry
4. **iFrames** → أنشئ iframe وانسخ الـ ID
5. **Webhooks** → أضف URL:
   `https://YOUR-SITE.netlify.app/.netlify/functions/payment`
   Action: `hmac`

---

## 💰 نظام الإيرادات

| المصدر | النسبة/السعر |
|--------|-------------|
| عمولة الطلبات | 5% (قابل للتخصيص) |
| اشتراك Basic | 99 ج.م/شهر |
| اشتراك Pro | 299 ج.م/شهر |
| اشتراك Business | 599 ج.م/شهر |
| اشتراك VIP | 1,499 ج.م/شهر |
| Featured يومي | 50 ج.م |
| Featured أسبوعي | 200 ج.م |
| Featured شهري | 600 ج.م |
| Boost أعلى البحث | 30 ج.م/أسبوع |
| توثيق أساسي | 49 ج.م |
| توثيق تجاري | 199 ج.م |

---

## 🛡️ الأمان

- جميع مفاتيح API في Environment Variables فقط
- Firebase Security Rules محدّثة وشاملة
- CSP headers كاملة في netlify.toml
- Rate limiting في جميع Netlify Functions
- Firebase Auth Token verification في كل طلب
- HMAC verification لـ Paymob webhooks

---

## 📊 لوحة الإدارة

للوصول إلى لوحة الإدارة:
1. سجّل دخول بحساب Admin
2. أضف حقل `isAdmin: true` لمستخدمك في Firestore → users collection
3. ستظهر "لوحة الإدارة" تلقائياً في القائمة
