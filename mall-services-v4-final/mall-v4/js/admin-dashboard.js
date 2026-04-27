/**
 * ============================================================================
 * ADMIN REVENUE DASHBOARD — MALL SERVICES v3.0.0
 * لوحة الإدارة والإيرادات الاحترافية
 * ============================================================================
 */
(function () {
    'use strict';

    const SOURCE_LABELS = {
        commission:    { ar: 'عمولة الطلبات',   icon: 'fa-percent',        color: '#6366f1' },
        subscription:  { ar: 'اشتراكات البائعين', icon: 'fa-crown',         color: '#f59e0b' },
        featured:      { ar: 'خدمات مميزة',      icon: 'fa-star',           color: '#10b981' },
        boost:         { ar: 'تسريع الظهور',     icon: 'fa-rocket',         color: '#3b82f6' },
        ad:            { ar: 'إعلانات',           icon: 'fa-rectangle-ad',  color: '#8b5cf6' },
        verification:  { ar: 'توثيق الحسابات',  icon: 'fa-shield-check',   color: '#06b6d4' },
        wallet_fee:    { ar: 'رسوم المحفظة',     icon: 'fa-wallet',         color: '#84cc16' },
        affiliate:     { ar: 'نظام الإحالة',     icon: 'fa-link',           color: '#f97316' },
        api_access:    { ar: 'API Access',        icon: 'fa-code',           color: '#ec4899' },
        enterprise:    { ar: 'صفقات الشركات',    icon: 'fa-building',      color: '#14b8a6' },
        listing_fee:   { ar: 'رسوم النشر',       icon: 'fa-file-plus',      color: '#64748b' },
        renewal_fee:   { ar: 'رسوم التجديد',     icon: 'fa-rotate',         color: '#a78bfa' },
    };

    const AdminDashboard = {
        _interval: null,
        _currentRange: 'month',

        init() {
            // Register page navigation
            const origNavigate = window.navigateTo;
            window.navigateTo = function(page) {
                if (page === 'adminDashboard') {
                    AdminDashboard.loadStats(AdminDashboard._currentRange);
                }
                if (typeof origNavigate === 'function') origNavigate(page);
            };

            // Auto-refresh every 30 seconds when on admin page
            this._interval = setInterval(() => {
                const adminPage = document.getElementById('adminDashboard');
                if (adminPage && adminPage.classList.contains('active')) {
                    this.loadStats(this._currentRange);
                }
            }, 30000);

            console.log('✅ AdminDashboard initialized');
        },

        async loadStats(range = 'month') {
            this._currentRange = range;
            if (!window.db) {
                this._renderMockData();
                return;
            }

            try {
                await Promise.all([
                    this._loadRevenue(range),
                    this._loadOrders(range),
                    this._loadPaymentStats(range),
                    this._loadSubscriptionStats(),
                    this._loadRecentTransactions(),
                ]);
            } catch (e) {
                console.warn('[AdminDashboard] loadStats error:', e.message);
                this._renderMockData();
            }
        },

        async _loadRevenue(range) {
            const startDate = this._getStartDate(range);
            const snap = await window.db.collection('platform_revenue')
                .where('createdAt', '>=', startDate)
                .get().catch(() => null);

            if (!snap) return;

            let total = 0;
            const bySource = {};
            snap.forEach(doc => {
                const d = doc.data();
                total += d.amount || 0;
                bySource[d.source] = (bySource[d.source] || 0) + (d.amount || 0);
            });

            // KPIs
            this._setText('kpiTotalRevenue', this._fmt(total));
            this._setText('kpiCommission', this._fmt(bySource.commission || 0));

            // Revenue by source chart
            const container = document.getElementById('revenueBySource');
            if (!container) return;
            container.innerHTML = '';

            const maxAmount = Math.max(...Object.values(bySource), 1);
            Object.entries(bySource)
              .sort((a,b) => b[1] - a[1])
              .forEach(([src, amt]) => {
                const meta  = SOURCE_LABELS[src] || { ar: src, icon: 'fa-coins', color: '#6b7280' };
                const pct   = ((amt / maxAmount) * 100).toFixed(1);
                const share = ((amt / total) * 100).toFixed(1);
                container.innerHTML += `
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background:${meta.color}20">
                            <i class="fa-solid ${meta.icon} text-sm" style="color:${meta.color}"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between text-sm mb-1">
                                <span class="font-semibold text-gray-800">${meta.ar}</span>
                                <span class="text-gray-500">${this._fmt(amt)} (${share}%)</span>
                            </div>
                            <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div class="h-full rounded-full transition-all duration-700" style="width:${pct}%;background:${meta.color}"></div>
                            </div>
                        </div>
                    </div>`;
              });
            if (!container.innerHTML) container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">لا توجد إيرادات بعد</p>';
        },

        async _loadOrders(range) {
            const startDate = this._getStartDate(range);
            const [allSnap, pendingSnap] = await Promise.all([
                window.db.collection('orders').where('createdAt', '>=', startDate).get().catch(()=>null),
                window.db.collection('orders').where('status', '==', 'pending').get().catch(()=>null),
            ]);

            const total   = allSnap?.size || 0;
            const pending = pendingSnap?.size || 0;
            this._setText('kpiTotalOrders', total.toLocaleString());
            this._setText('kpiOrdersPending', `${pending} معلق`);

            // Conversion rate
            const usersSnap = await window.db.collection('users').get().catch(()=>null);
            const users = usersSnap?.size || 1;
            const rate  = ((total / users) * 100).toFixed(1);
            this._setText('kpiConversion', `${rate}%`);
            this._setText('kpiActiveUsers', `${users} مستخدم`);
        },

        async _loadPaymentStats(range) {
            const startDate = this._getStartDate(range);
            const snap = await window.db.collection('payments')
                .where('createdAt', '>=', startDate)
                .get().catch(()=>null);

            if (!snap) return;

            let success = 0, failed = 0;
            snap.forEach(doc => {
                const d = doc.data();
                if (d.status === 'success') success++;
                else if (d.status === 'failed') failed++;
            });

            const container = document.getElementById('paymentStatusChart');
            if (!container) return;
            const total = success + failed || 1;
            container.innerHTML = `
                <div class="space-y-4">
                    <div class="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <i class="fa-solid fa-check text-green-600 text-sm"></i>
                            </div>
                            <span class="font-semibold text-gray-800">مدفوعات ناجحة</span>
                        </div>
                        <span class="text-green-700 font-black">${success}</span>
                    </div>
                    <div class="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                                <i class="fa-solid fa-xmark text-red-600 text-sm"></i>
                            </div>
                            <span class="font-semibold text-gray-800">مدفوعات فاشلة</span>
                        </div>
                        <span class="text-red-700 font-black">${failed}</span>
                    </div>
                    <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full bg-green-500 rounded-full transition-all duration-700" style="width:${((success/total)*100).toFixed(1)}%"></div>
                    </div>
                    <p class="text-xs text-center text-gray-500">معدل النجاح: ${((success/total)*100).toFixed(1)}%</p>
                </div>`;
        },

        async _loadSubscriptionStats() {
            const snap = await window.db.collection('subscriptions')
                .where('status', '==', 'active')
                .get().catch(()=>null);

            if (!snap) return;

            const counts = { free: 0, basic: 0, pro: 0, business: 0, vip: 0 };
            snap.forEach(doc => {
                const plan = doc.data().planId || 'free';
                counts[plan] = (counts[plan] || 0) + 1;
            });

            const total = Object.values(counts).reduce((a,b)=>a+b, 0);
            this._setText('activeSubs', `${total} مشترك`);
            Object.entries(counts).forEach(([plan, count]) => {
                this._setText(`sub${plan.charAt(0).toUpperCase() + plan.slice(1)}`, count);
            });
        },

        async _loadRecentTransactions() {
            const snap = await window.db.collection('platform_revenue')
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get().catch(()=>null);

            const container = document.getElementById('recentTransactions');
            if (!container) return;
            if (!snap || snap.empty) {
                container.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fa-solid fa-inbox text-3xl mb-3 block"></i><p>لا توجد معاملات</p></div>';
                return;
            }

            container.innerHTML = '';
            snap.forEach(doc => {
                const d = doc.data();
                const meta = SOURCE_LABELS[d.source] || { ar: d.source, icon: 'fa-coins', color: '#6b7280' };
                const date = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('ar-EG') : '—';
                container.innerHTML += `
                    <div class="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:${meta.color}15">
                                <i class="fa-solid ${meta.icon} text-sm" style="color:${meta.color}"></i>
                            </div>
                            <div>
                                <p class="text-sm font-semibold text-gray-800">${meta.ar}</p>
                                <p class="text-xs text-gray-400">${date}</p>
                            </div>
                        </div>
                        <span class="font-bold text-green-600">+${this._fmt(d.amount || 0)}</span>
                    </div>`;
            });
        },

        _renderMockData() {
            this._setText('kpiTotalRevenue', '45,230 ج.م');
            this._setText('kpiRevenueGrowth', '+23% هذا الشهر');
            this._setText('kpiTotalOrders', '1,847');
            this._setText('kpiOrdersPending', '23 معلق');
            this._setText('kpiCommission', '3,850 ج.م');
            this._setText('kpiConversion', '4.2%');
            this._setText('kpiActiveUsers', '437 مستخدم');
            this._setText('activeSubs', '124 مشترك');
            this._setText('subFree', '88');
            this._setText('subBasic', '22');
            this._setText('subPro', '10');
            this._setText('subBusiness', '3');
            this._setText('subVip', '1');

            const src = document.getElementById('revenueBySource');
            if (src) {
                src.innerHTML = Object.entries({
                    commission: 19500, subscription: 12300, featured: 7200, boost: 3800, ad: 2430
                }).map(([key, amt]) => {
                    const meta = SOURCE_LABELS[key] || { ar: key, icon: 'fa-coins', color: '#6b7280' };
                    return `<div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:${meta.color}20">
                            <i class="fa-solid ${meta.icon} text-sm" style="color:${meta.color}"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between text-sm mb-1">
                                <span class="font-semibold">${meta.ar}</span>
                                <span class="text-gray-500">${this._fmt(amt)}</span>
                            </div>
                            <div class="h-2 bg-gray-100 rounded-full"><div class="h-full rounded-full" style="width:${(amt/19500*100).toFixed(0)}%;background:${meta.color}"></div></div>
                        </div>
                    </div>`;
                }).join('');
            }

            const chart = document.getElementById('paymentStatusChart');
            if (chart) chart.innerHTML = `<div class="space-y-3">
                <div class="flex justify-between p-3 bg-green-50 rounded-xl"><span class="font-semibold">ناجحة</span><span class="text-green-700 font-black">1,621</span></div>
                <div class="flex justify-between p-3 bg-red-50 rounded-xl"><span class="font-semibold">فاشلة</span><span class="text-red-700 font-black">226</span></div>
                <div class="h-3 bg-gray-100 rounded-full"><div class="h-full bg-green-500 rounded-full" style="width:87.8%"></div></div>
                <p class="text-xs text-center text-gray-500">معدل النجاح: 87.8%</p></div>`;
        },

        _getStartDate(range) {
            const now = new Date();
            switch (range) {
                case 'day':   return new Date(now.setHours(0,0,0,0));
                case 'week':  return new Date(Date.now() - 7 * 86400000);
                case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
                case 'year':  return new Date(now.getFullYear(), 0, 1);
                default:      return new Date(now.getFullYear(), now.getMonth(), 1);
            }
        },

        exportReport() {
            const range = this._currentRange;
            const data  = {
                range,
                generatedAt: new Date().toLocaleString('ar-EG'),
                totalRevenue: document.getElementById('kpiTotalRevenue')?.textContent || '—',
                totalOrders:  document.getElementById('kpiTotalOrders')?.textContent || '—',
                commission:   document.getElementById('kpiCommission')?.textContent || '—',
            };
            const csv = Object.entries(data).map(([k,v]) => `${k},${v}`).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = `mall-revenue-${range}-${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        },

        _fmt(amount) {
            if (typeof window.formatCurrencyFull === 'function') return window.formatCurrencyFull(amount);
            return Number(amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 }) + ' ج.م';
        },

        _setText(id, text) {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        },
    };

    // Add admin link to user dropdown if admin
    function _addAdminLink() {
        const dropdown = document.getElementById('userDropdown');
        if (!dropdown) return;
        if (document.getElementById('adminDashboardLink')) return;
        const div = document.createElement('div');
        div.id = 'adminDashboardLinkWrapper';
        div.className = 'hidden';
        div.innerHTML = `
            <div class="border-t border-gray-100 my-2"></div>
            <a id="adminDashboardLink" href="#" onclick="navigateTo('adminDashboard')">
                <i class="fa-solid fa-shield-halved ml-2 text-red-600"></i>لوحة الإدارة
            </a>`;
        dropdown.appendChild(div);
    }

    function init() {
        _addAdminLink();
        AdminDashboard.init();
        window.AdminDashboard = AdminDashboard;

        // Show admin link if admin user
        const origAuth = window.onAuthChange;
        window._adminAuthCheck = function(user, userData) {
            const adminWrapper = document.getElementById('adminDashboardLinkWrapper');
            if (adminWrapper) {
                adminWrapper.classList.toggle('hidden', !(userData?.isAdmin || userData?.role === 'admin'));
            }
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
