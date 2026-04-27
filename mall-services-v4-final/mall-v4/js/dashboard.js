// ==================== DASHBOARD MODULE ====================
// Mall Services - Provider & Seeker Dashboards + Notifications + Messages

const DashboardManager = {

    // ==================== PROVIDER DASHBOARD ====================

    /**
     * Render provider dashboard
     */
    async renderProviderDashboard() {
        if (!AuthManager.isLoggedIn()) {
            showToast('يرجى تسجيل الدخول أولاً', 'warning');
            navigateTo('login');
            return;
        }

        const user = AuthManager.userProfile;
        if (user.role !== 'provider') {
            showToast('هذه الصفحة لمقدمي الخدمة فقط', 'warning');
            navigateTo('home');
            return;
        }

        showLoading('جاري تحميل لوحة التحكم...');

        try {
            // Load provider services
            const servicesSnapshot = await db.collection(COLLECTIONS.SERVICES)
                .where('sellerId', '==', user.uid)
                .where('isActive', '==', true)
                .get();

            const providerServices = servicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Load provider orders
            const ordersSnapshot = await db.collection(COLLECTIONS.ORDERS)
                .where('sellerId', '==', user.uid)
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();

            const providerOrders = ordersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Calculate stats
            const completedOrders = providerOrders.filter(o => o.status === 'completed');
            const activeOrders = providerOrders.filter(o => !['completed', 'cancelled'].includes(o.status));
            const earnings = completedOrders.reduce((sum, o) => sum + (o.price * 0.9), 0); // 10% platform fee
            const avgRating = providerServices.length > 0
                ? (providerServices.reduce((sum, s) => sum + parseFloat(s.rating || 0), 0) / providerServices.length).toFixed(1)
                : '0.0';

            // Update stats
            document.getElementById('providerEarnings').textContent = earnings.toFixed(2) + ' ج.م';
            document.getElementById('providerActiveOrders').textContent = activeOrders.length;
            document.getElementById('providerServices').textContent = providerServices.length;
            document.getElementById('providerRating').textContent = avgRating;

            // Store for tab rendering
            this._providerServices = providerServices;
            this._providerOrders = providerOrders;

            hideLoading();
            this.switchProviderTab('services');

        } catch (error) {
            hideLoading();
            console.error('Provider dashboard error:', error);

            // Fallback to AppState data
            const providerServices = (AppState.services || []).filter(s => s.sellerId === user.uid);
            const providerOrders = (AppState.orders || []).filter(o => o.sellerId === user.uid);
            const earnings = providerOrders
                .filter(o => o.status === 'completed')
                .reduce((sum, o) => sum + o.price, 0);

            document.getElementById('providerEarnings').textContent = earnings.toFixed(2) + ' ج.م';
            document.getElementById('providerActiveOrders').textContent =
                providerOrders.filter(o => !['completed', 'cancelled'].includes(o.status)).length;
            document.getElementById('providerServices').textContent = providerServices.length;
            document.getElementById('providerRating').textContent = '4.8';

            this._providerServices = providerServices;
            this._providerOrders = providerOrders;
            this.switchProviderTab('services');
        }
    },

    /**
     * Switch provider dashboard tab
     */
    switchProviderTab(tab) {
        // Update tab buttons
        ['services', 'orders', 'reviews'].forEach(t => {
            document.getElementById('providerTab-' + t)?.classList.remove('active');
            document.getElementById('provider' + t.charAt(0).toUpperCase() + t.slice(1) + 'Content')?.classList.add('hidden');
        });

        document.getElementById('providerTab-' + tab)?.classList.add('active');
        document.getElementById('provider' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Content')?.classList.remove('hidden');

        if (tab === 'services') this.renderProviderServices();
        if (tab === 'orders') this.renderProviderOrders();
        if (tab === 'reviews') this.renderProviderReviews();
    },

    /**
     * Render provider services list
     */
    renderProviderServices() {
        const container = document.getElementById('providerServicesContent');
        if (!container) return;

        const services = this._providerServices || [];

        if (services.length === 0) {
            container.innerHTML = `
                <div class="empty-state py-16">
                    <i class="fa-solid fa-briefcase text-6xl text-gray-200 mb-4 block text-center"></i>
                    <p class="text-center text-gray-500 mb-4">لا توجد خدمات منشورة بعد</p>
                    <div class="text-center">
                        <button onclick="openModal('createServiceModal')" class="btn-primary w-auto px-8">
                            <i class="fa-solid fa-plus ml-2"></i>
                            أنشئ أول خدمة
                        </button>
                    </div>
                </div>`;
            return;
        }

        container.innerHTML = services.map(service => `
            <div class="flex items-center justify-between p-5 bg-gray-50 rounded-2xl mb-4 hover:bg-brand-50 transition border border-transparent hover:border-brand-200">
                <div class="flex items-center gap-4">
                    <img src="${service.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100'}"
                         class="w-16 h-16 rounded-xl object-cover"
                         onerror="this.src='https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100'">
                    <div>
                        <h3 class="font-bold text-gray-900">${service.title}</h3>
                        <div class="flex items-center gap-3 mt-1">
                            <span class="text-sm text-brand-600 font-bold">${service.price} ج.م</span>
                            <span class="text-gray-300">•</span>
                            <span class="text-xs text-gray-500">
                                <i class="fa-solid fa-shopping-bag ml-1"></i>${service.orders || 0} طلب
                            </span>
                            <span class="text-gray-300">•</span>
                            <span class="text-xs text-yellow-600">
                                <i class="fa-solid fa-star ml-1"></i>${parseFloat(service.rating || 0).toFixed(1)}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="viewService('${service.id}')"
                            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-300 transition">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button onclick="ServicesManager.deleteService('${service.id}')"
                            class="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-bold hover:bg-red-200 transition">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Render provider orders list
     */
    renderProviderOrders() {
        const container = document.getElementById('providerOrdersContent');
        if (!container) return;

        const orders = this._providerOrders || [];

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state py-16">
                    <i class="fa-solid fa-bag-shopping text-6xl text-gray-200 mb-4 block text-center"></i>
                    <p class="text-center text-gray-500">لا توجد طلبات بعد</p>
                </div>`;
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="flex items-center justify-between p-5 bg-gray-50 rounded-2xl mb-4 border border-transparent hover:border-brand-200 hover:bg-brand-50 transition">
                <div class="flex items-center gap-4">
                    <img src="${order.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100'}"
                         class="w-16 h-16 rounded-xl object-cover">
                    <div>
                        <h3 class="font-bold text-gray-900">${order.title}</h3>
                        <p class="text-sm text-gray-500 mt-1">
                            <i class="fa-solid fa-user ml-1 text-brand-400"></i>${order.buyer}
                        </p>
                        <p class="text-xs text-gray-400 mt-1">${this.formatDate(order.createdAt)}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-bold text-brand-600">${order.price} ج.م</span>
                    <span class="status-badge status-${(order.status || 'pending').replace(' ', '-')}">${getStatusText(order.status)}</span>
                    <button onclick="openWorkspace('${order.id}')"
                            class="px-4 py-2 btn-primary rounded-xl text-sm">
                        <i class="fa-solid fa-comments ml-1"></i>
                        ساحة العمل
                    </button>
                    ${order.status === 'pending' ? `
                        <button onclick="OrdersManager.updateOrderStatus('${order.id}', 'in-progress').then(() => DashboardManager.renderProviderDashboard())"
                                class="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition">
                            قبول الطلب
                        </button>
                    ` : ''}
                    ${order.status === 'in-progress' ? `
                        <button onclick="OrdersManager.updateOrderStatus('${order.id}', 'delivered').then(() => { showToast('تم تسليم الطلب', 'success'); DashboardManager.renderProviderDashboard(); })"
                                class="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition">
                            <i class="fa-solid fa-check ml-1"></i>
                            تسليم
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },

    /**
     * Render provider reviews
     */
    async renderProviderReviews() {
        const container = document.getElementById('providerReviewsContent');
        if (!container) return;

        container.innerHTML = `<div class="text-center py-8"><div class="loading-spinner mx-auto"></div></div>`;

        try {
            const user = AuthManager.userProfile;
            const serviceIds = (this._providerServices || []).map(s => s.id);

            if (serviceIds.length === 0) {
                container.innerHTML = `
                    <div class="empty-state py-16">
                        <i class="fa-solid fa-star text-6xl text-gray-200 mb-4 block text-center"></i>
                        <p class="text-center text-gray-500">لا توجد تقييمات بعد</p>
                    </div>`;
                return;
            }

            // Load reviews for all provider services
            const reviews = [];
            for (const serviceId of serviceIds.slice(0, 10)) {
                const snapshot = await db.collection(COLLECTIONS.REVIEWS)
                    .where('serviceId', '==', String(serviceId))
                    .orderBy('createdAt', 'desc')
                    .limit(10)
                    .get();
                reviews.push(...snapshot.docs.map(d => d.data()));
            }

            if (reviews.length === 0) {
                container.innerHTML = `
                    <div class="empty-state py-16">
                        <i class="fa-solid fa-star text-6xl text-gray-200 mb-4 block text-center"></i>
                        <p class="text-center text-gray-500">لا توجد تقييمات بعد</p>
                    </div>`;
                return;
            }

            const avgRating = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);

            container.innerHTML = `
                <div class="flex items-center gap-6 p-6 bg-gradient-to-r from-yellow-50 to-brand-50 rounded-2xl mb-6">
                    <div class="text-center">
                        <p class="text-5xl font-black text-yellow-500">${avgRating}</p>
                        <div class="flex text-yellow-400 justify-center mt-2">${generateStars(parseFloat(avgRating))}</div>
                        <p class="text-sm text-gray-500 mt-1">${reviews.length} تقييم</p>
                    </div>
                    <div class="flex-1 space-y-2">
                        ${[5, 4, 3, 2, 1].map(star => {
                            const count = reviews.filter(r => r.rating === star).length;
                            const pct = reviews.length > 0 ? (count / reviews.length * 100).toFixed(0) : 0;
                            return `
                                <div class="flex items-center gap-3">
                                    <span class="text-sm text-gray-500 w-3">${star}</span>
                                    <i class="fa-solid fa-star text-yellow-400 text-xs"></i>
                                    <div class="flex-1 bg-gray-200 rounded-full h-2">
                                        <div class="bg-yellow-400 h-2 rounded-full" style="width: ${pct}%"></div>
                                    </div>
                                    <span class="text-xs text-gray-500 w-8">${pct}%</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="space-y-4">
                    ${reviews.map(review => `
                        <div class="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                            <div class="flex items-center gap-4 mb-3">
                                <img src="${review.userAvatar || 'https://ui-avatars.com/api/?name=U'}"
                                     class="w-10 h-10 rounded-full border-2 border-brand-100"
                                     onerror="this.src='https://ui-avatars.com/api/?name=U'">
                                <div class="flex-1">
                                    <div class="flex items-center justify-between">
                                        <p class="font-bold text-sm">${review.userName}</p>
                                        <span class="text-xs text-gray-400">${this.formatDate(review.createdAt)}</span>
                                    </div>
                                    <div class="flex text-yellow-400 text-xs mt-1">${generateStars(review.rating)}</div>
                                </div>
                            </div>
                            <p class="text-gray-600 text-sm leading-relaxed">${review.comment || 'لا يوجد تعليق'}</p>
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            container.innerHTML = `
                <div class="empty-state py-16">
                    <i class="fa-solid fa-star text-6xl text-gray-200 mb-4 block text-center"></i>
                    <p class="text-center text-gray-500">تعذر تحميل التقييمات</p>
                </div>`;
        }
    },

    // ==================== SEEKER DASHBOARD ====================

    /**
     * Render seeker dashboard
     */
    async renderSeekerDashboard() {
        if (!AuthManager.isLoggedIn()) {
            showToast('يرجى تسجيل الدخول أولاً', 'warning');
            navigateTo('login');
            return;
        }

        const user = AuthManager.userProfile;
        if (user.role !== 'seeker') {
            showToast('هذه الصفحة للباحثين عن خدمة فقط', 'warning');
            navigateTo('home');
            return;
        }

        try {
            const orders = OrdersManager.orders || AppState.orders || [];
            const seekerOrders = orders.filter(o => o.buyerId === user.uid);
            const activeOrders = seekerOrders.filter(o => !['completed', 'cancelled'].includes(o.status)).length;
            const completedOrders = seekerOrders.filter(o => o.status === 'completed').length;
            const spent = seekerOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.price, 0);

            document.getElementById('seekerActiveOrders').textContent = activeOrders;
            document.getElementById('seekerCompletedOrders').textContent = completedOrders;
            document.getElementById('seekerSpent').textContent = spent.toFixed(2) + ' ج.م';
            document.getElementById('seekerFavorites').textContent = AppState.favorites?.length || 0;

            // Render recent orders
            const container = document.getElementById('seekerOrdersList');
            if (container) {
                if (seekerOrders.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state py-12">
                            <i class="fa-solid fa-bag-shopping text-5xl text-gray-200 mb-4 block text-center"></i>
                            <p class="text-center text-gray-500 mb-4">لا توجد طلبات بعد</p>
                            <div class="text-center">
                                <button onclick="navigateTo('services')" class="btn-primary w-auto px-8">
                                    <i class="fa-solid fa-search ml-2"></i>
                                    تصفح الخدمات
                                </button>
                            </div>
                        </div>`;
                } else {
                    container.innerHTML = seekerOrders.slice(0, 5).map(order => `
                        <div class="flex items-center justify-between p-5 bg-gray-50 rounded-2xl hover:bg-brand-50 transition cursor-pointer"
                             onclick="openWorkspace('${order.id}')">
                            <div class="flex items-center gap-4">
                                <img src="${order.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100'}"
                                     class="w-16 h-16 rounded-xl object-cover">
                                <div>
                                    <h3 class="font-bold text-gray-900">${order.title}</h3>
                                    <p class="text-sm text-gray-500 mt-1">
                                        <i class="fa-solid fa-user ml-1 text-brand-400"></i>${order.seller}
                                    </p>
                                    <p class="text-xs text-gray-400">${this.formatDate(order.createdAt || order.date)}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="font-bold text-brand-600">${order.price} ج.م</span>
                                <span class="status-badge status-${(order.status || 'pending').replace(' ', '-')}">${getStatusText(order.status)}</span>
                            </div>
                        </div>
                    `).join('');
                }
            }
        } catch (error) {
            console.error('Seeker dashboard error:', error);
        }
    },

    // ==================== WALLET ====================

    /**
     * Render wallet page
     */
    async renderWallet() {
        try {
            const walletData = WalletManager.walletData || AppState.wallet || { balance: 0, pending: 0, total: 0 };

            document.getElementById('walletBalance').textContent =
                (walletData.balance || 0).toFixed(2) + ' ج.م';
            document.getElementById('walletPending').textContent =
                (walletData.pending || 0).toFixed(2) + ' ج.م';
            document.getElementById('walletTotal').textContent =
                (walletData.total || 0).toFixed(2) + ' ج.م';

            // Load transactions
            const container = document.getElementById('walletTransactions');
            if (!container) return;

            const transactions = WalletManager.transactions;

            if (!transactions || transactions.length === 0) {
                container.innerHTML = `
                    <div class="empty-state py-12">
                        <i class="fa-solid fa-receipt text-5xl text-gray-200 mb-4 block text-center"></i>
                        <p class="text-center text-gray-500">لا توجد عمليات مالية بعد</p>
                    </div>`;
                return;
            }

            container.innerHTML = transactions.map(tx => `
                <div class="flex items-center justify-between p-5 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 ${tx.type === 'credit' ? 'bg-green-100' : 'bg-red-100'} rounded-xl flex items-center justify-center">
                            <i class="fa-solid fa-${tx.type === 'credit' ? 'arrow-down text-green-600' : 'arrow-up text-red-600'} text-lg"></i>
                        </div>
                        <div>
                            <p class="font-bold text-gray-900">${tx.description}</p>
                            <p class="text-sm text-gray-500">${this.formatDate(tx.createdAt || tx.date)}</p>
                        </div>
                    </div>
                    <p class="font-black text-lg ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}">
                        ${tx.type === 'credit' ? '+' : '-'}${(tx.amount || 0).toFixed(2)} ج.م
                    </p>
                </div>
            `).join('');

        } catch (error) {
            console.error('Wallet render error:', error);
        }
    },

    // ==================== NOTIFICATIONS ====================

    /**
     * Render notifications page
     */
    async renderNotifications() {
        const container = document.getElementById('notificationsList');
        const empty = document.getElementById('notificationsEmpty');
        const badge = document.getElementById('notifBadge');

        if (!container) return;

        try {
            const user = AuthManager.currentUser;
            if (!user) return;

            const snapshot = await db.collection(COLLECTIONS.NOTIFICATIONS)
                .where('userId', '==', user.uid)
                .orderBy('createdAt', 'desc')
                .limit(30)
                .get();

            const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const unreadCount = notifications.filter(n => !n.read).length;
            if (badge) badge.classList.toggle('hidden', unreadCount === 0);

            if (notifications.length === 0) {
                container.innerHTML = '';
                if (empty) empty.classList.remove('hidden');
                return;
            }

            if (empty) empty.classList.add('hidden');

            const icons = {
                order: 'bag-shopping',
                delivery: 'truck',
                completed: 'circle-check',
                payment: 'credit-card',
                message: 'message',
                info: 'bell'
            };

            container.innerHTML = notifications.map(notif => `
                <div class="bg-white rounded-2xl border ${!notif.read ? 'border-brand-200 bg-brand-50/50' : 'border-gray-200'} p-5 shadow-sm hover:shadow-md transition cursor-pointer"
                     onclick="NotificationsManager.markAsRead('${notif.id}'); this.classList.remove('border-brand-200', 'bg-brand-50/50'); this.classList.add('border-gray-200')">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center text-brand-600 flex-shrink-0">
                            <i class="fa-solid fa-${icons[notif.type] || 'bell'} text-lg"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-start justify-between gap-2">
                                <p class="font-bold text-gray-900">${notif.title}</p>
                                ${!notif.read ? '<div class="w-2.5 h-2.5 bg-brand-500 rounded-full flex-shrink-0 mt-1"></div>' : ''}
                            </div>
                            <p class="text-gray-500 text-sm mt-1">${notif.message}</p>
                            <p class="text-xs text-gray-400 mt-2">${this.formatDate(notif.createdAt)}</p>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            // Fallback to AppState
            const notifications = AppState.notifications || [];
            if (notifications.length === 0) {
                container.innerHTML = '';
                if (empty) empty.classList.remove('hidden');
                return;
            }
            if (empty) empty.classList.add('hidden');
            container.innerHTML = notifications.map(notif => `
                <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <p class="font-bold">${notif.title}</p>
                    <p class="text-gray-500 text-sm">${notif.message}</p>
                </div>
            `).join('');
        }
    },

    // ==================== MESSAGES ====================

    /**
     * Render messages/conversations page
     */
    async renderMessages() {
        const container = document.getElementById('conversationsList');
        if (!container) return;

        try {
            const user = AuthManager.currentUser;
            if (!user) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">يرجى تسجيل الدخول</p>';
                return;
            }

            const snapshot = await db.collection(COLLECTIONS.CONVERSATIONS)
                .where('participants', 'array-contains', user.uid)
                .orderBy('updatedAt', 'desc')
                .limit(20)
                .get();

            const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (conversations.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">لا توجد محادثات</p>';
                return;
            }

            container.innerHTML = conversations.map(conv => {
                const otherUser = conv.participantData?.find(p => p.uid !== user.uid);
                return `
                    <div class="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition flex items-center gap-3"
                         onclick="DashboardManager.openConversation('${conv.id}', ${JSON.stringify(otherUser || {}).replace(/"/g, '&quot;')})">
                        <img src="${otherUser?.avatar || 'https://ui-avatars.com/api/?name=U'}"
                             class="w-12 h-12 rounded-full border-2 border-brand-100 flex-shrink-0"
                             onerror="this.src='https://ui-avatars.com/api/?name=U'">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between">
                                <p class="font-bold text-sm text-gray-900">${otherUser?.name || 'مستخدم'}</p>
                                <span class="text-xs text-gray-400">${this.formatDate(conv.updatedAt)}</span>
                            </div>
                            <p class="text-xs text-gray-500 truncate mt-1">${conv.lastMessage || 'لا توجد رسائل'}</p>
                        </div>
                        ${conv.unreadCount > 0 ? `
                            <span class="w-5 h-5 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
                                ${conv.unreadCount}
                            </span>
                        ` : ''}
                    </div>
                `;
            }).join('');

        } catch (error) {
            // Fallback to localStorage messages
            const messages = AppState.messages || [];
            if (messages.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">لا توجد محادثات</p>';
                return;
            }
            container.innerHTML = messages.map(conv => `
                <div class="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition" onclick="openChat('${conv.userId}')">
                    <div class="flex items-center gap-3">
                        <img src="${conv.avatar}" class="w-12 h-12 rounded-full">
                        <div class="flex-1">
                            <p class="font-bold text-sm">${conv.userName}</p>
                            <p class="text-xs text-gray-500 truncate">${conv.lastMessage || ''}</p>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    },

    /**
     * Open conversation and load messages
     */
    async openConversation(conversationId, otherUser) {
        const user = AuthManager.currentUser;
        if (!user) return;

        document.getElementById('chatHeader')?.classList.remove('hidden');
        document.getElementById('chatInputArea')?.classList.remove('hidden');
        
        if (document.getElementById('chatHeaderAvatar')) {
            document.getElementById('chatHeaderAvatar').src = otherUser.avatar || '';
        }
        if (document.getElementById('chatHeaderName')) {
            document.getElementById('chatHeaderName').textContent = otherUser.name || 'مستخدم';
        }

        AppState.currentConversationId = conversationId;

        // Load messages with real-time listener
        if (this._messageUnsubscribe) this._messageUnsubscribe();

        this._messageUnsubscribe = db.collection(COLLECTIONS.CONVERSATIONS)
            .doc(conversationId)
            .collection('messages')
            .orderBy('createdAt', 'asc')
            .onSnapshot(snapshot => {
                const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                this.renderConversationMessages(messages, user.uid);
            });
    },

    /**
     * Render conversation messages
     */
    renderConversationMessages(messages, currentUserId) {
        const container = document.getElementById('chatMessagesFull');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-400">
                    <i class="fa-solid fa-message text-5xl mb-4 opacity-30"></i>
                    <p>ابدأ المحادثة الآن</p>
                </div>`;
            return;
        }

        container.innerHTML = messages.map(msg => `
            <div class="flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}">
                <div class="chat-bubble ${msg.senderId === currentUserId ? 'sent' : 'received'} max-w-xs lg:max-w-md">
                    <p class="text-sm">${msg.text}</p>
                    <p class="text-xs opacity-60 mt-1 text-left">${this.formatTime(msg.createdAt)}</p>
                </div>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    },

    /**
     * Send message in conversation
     */
    async sendMessageFull() {
        const input = document.getElementById('chatInputFull');
        const text = input?.value?.trim();
        const conversationId = AppState.currentConversationId;

        if (!text || !conversationId) return;

        const user = AuthManager.currentUser;
        if (!user) return;

        input.value = '';

        try {
            await db.collection(COLLECTIONS.CONVERSATIONS)
                .doc(conversationId)
                .collection('messages')
                .add({
                    text,
                    senderId: user.uid,
                    senderName: AuthManager.userProfile?.name || '',
                    createdAt: serverTimestamp()
                });

            // Update conversation last message
            await db.collection(COLLECTIONS.CONVERSATIONS)
                .doc(conversationId)
                .update({
                    lastMessage: text,
                    updatedAt: serverTimestamp()
                });

        } catch (error) {
            // Fallback: save to AppState
            if (!AppState.messages) AppState.messages = [];
            const conv = AppState.messages.find(m => m.userId === conversationId);
            if (conv) {
                conv.messages = conv.messages || [];
                conv.messages.push({
                    sender: user.uid,
                    text,
                    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                });
                conv.lastMessage = text;
                saveToStorage();
            }
        }
    },

    // ==================== PROFILE ====================

    /**
     * Render profile page
     */
    renderProfile() {
        const user = AuthManager.userProfile || AppState.currentUser;
        if (!user) return;

        const els = {
            profileName: document.getElementById('profileName'),
            profileEmail: document.getElementById('profileEmail'),
            profileAvatar: document.getElementById('profileAvatar'),
            profileNameInput: document.getElementById('profileNameInput'),
            profileEmailInput: document.getElementById('profileEmailInput'),
            profileBio: document.getElementById('profileBio'),
            profileRole: document.getElementById('profileRole')
        };

        if (els.profileName) els.profileName.textContent = user.name || '';
        if (els.profileEmail) els.profileEmail.textContent = user.email || '';
        if (els.profileAvatar) els.profileAvatar.src = user.avatar || 'https://ui-avatars.com/api/?name=U';
        if (els.profileNameInput) els.profileNameInput.value = user.name || '';
        if (els.profileEmailInput) els.profileEmailInput.value = user.email || '';
        if (els.profileBio) els.profileBio.value = user.bio || '';

        const roleText = { provider: 'مقدم خدمة', seeker: 'باحث عن خدمة' };
        if (els.profileRole) els.profileRole.textContent = roleText[user.role] || user.role;
    },

    /**
     * Update profile
     */
    async updateProfile(e) {
        e.preventDefault();
        const name = document.getElementById('profileNameInput')?.value?.trim();
        const bio = document.getElementById('profileBio')?.value?.trim();

        if (!name) {
            showToast('يرجى إدخال الاسم', 'warning');
            return;
        }

        await AuthManager.updateProfile({ name, bio });
        this.renderProfile();
    },

    // ==================== HELPERS ====================

    formatDate(timestamp) {
        if (!timestamp) return '';
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    }
};

// ==================== NOTIFICATIONS MANAGER ====================

const NotificationsManager = {

    unsubscribe: null,

    /**
     * Start listening for notifications
     */
    startListening(userId) {
        if (this.unsubscribe) this.unsubscribe();

        this.unsubscribe = db.collection(COLLECTIONS.NOTIFICATIONS)
            .where('userId', '==', userId)
            .where('read', '==', false)
            .onSnapshot(snapshot => {
                const count = snapshot.size;
                const badge = document.getElementById('notifBadge');
                if (badge) badge.classList.toggle('hidden', count === 0);
            }, error => console.warn('Notifications error:', error));
    },

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId) {
        try {
            await db.collection(COLLECTIONS.NOTIFICATIONS).doc(notificationId).update({ read: true });
        } catch (e) {}
    },

    /**
     * Mark all notifications as read
     */
    async markAllRead() {
        try {
            const user = AuthManager.currentUser;
            if (!user) return;

            const snapshot = await db.collection(COLLECTIONS.NOTIFICATIONS)
                .where('userId', '==', user.uid)
                .where('read', '==', false)
                .get();

            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });
            await batch.commit();

            showToast('تم تحديد الكل كمقروء', 'success');
            DashboardManager.renderNotifications();

        } catch (error) {
            // Fallback
            if (AppState.notifications) {
                AppState.notifications.forEach(n => n.read = true);
                saveToStorage();
            }
            showToast('تم تحديد الكل كمقروء', 'success');
            DashboardManager.renderNotifications();
        }
    }
};

// ==================== ORDERS RENDER FUNCTIONS (for orders page) ====================

/**
 * Render orders list page
 */
async function renderOrders() {
    const container = document.getElementById('ordersList');
    const empty = document.getElementById('ordersEmpty');

    if (!container) return;

    if (!AuthManager.isLoggedIn()) {
        container.innerHTML = '';
        if (empty) {
            empty.classList.remove('hidden');
            empty.querySelector('p').textContent = 'يرجى تسجيل الدخول لعرض الطلبات';
        }
        return;
    }

    // Load from Firestore
    try {
        const user = AuthManager.currentUser;
        const snapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('buyerId', '==', user.uid)
            .orderBy('createdAt', 'desc')
            .get();

        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        AppState.orders = orders;
        OrdersManager.orders = orders;
        
        renderOrdersList(orders);
    } catch (error) {
        // Fallback to AppState
        renderOrdersList(AppState.orders || []);
    }
}

/**
 * Render orders list with filter
 */
function renderOrdersList(orders) {
    const container = document.getElementById('ordersList');
    const empty = document.getElementById('ordersEmpty');

    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    container.innerHTML = orders.map(order => `
        <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
            <div class="flex items-center justify-between flex-wrap gap-4">
                <div class="flex items-center gap-4">
                    <img src="${order.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100'}"
                         class="w-20 h-20 rounded-xl object-cover"
                         onerror="this.src='https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100'">
                    <div>
                        <h3 class="font-bold text-lg text-gray-900">${order.title}</h3>
                        <p class="text-sm text-gray-500">${order.seller} • ${DashboardManager.formatDate(order.createdAt || order.date)}</p>
                        <p class="text-brand-600 font-bold mt-1">${order.price} ج.م</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 flex-wrap">
                    <span class="status-badge status-${(order.status || 'pending').replace(' ', '-')}">${getStatusText(order.status)}</span>
                    <button onclick="openWorkspace('${order.id}')"
                            class="px-4 py-2 btn-primary rounded-xl text-sm">
                        <i class="fa-solid fa-comments ml-2"></i>
                        ساحة العمل
                    </button>
                    ${order.status === 'delivered' ? `
                        <button onclick="confirmOrderDelivery('${order.id}')"
                                class="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition">
                            <i class="fa-solid fa-check ml-1"></i>
                            استلام
                        </button>
                        <button onclick="openReviewModal('${order.id}')"
                                class="px-4 py-2 btn-secondary rounded-xl text-sm">
                            <i class="fa-solid fa-star ml-1"></i>
                            تقييم
                        </button>
                    ` : ''}
                    ${order.status === 'pending' ? `
                        <button onclick="cancelOrder('${order.id}')"
                                class="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-bold hover:bg-red-200 transition">
                            إلغاء
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Filter orders by status
 */
function filterOrders(status) {
    document.querySelectorAll('.tab-button').forEach(tab => tab.classList.remove('active'));
    document.getElementById('tab-' + status)?.classList.add('active');

    const orders = AppState.orders || [];
    const filtered = status === 'all' ? orders : orders.filter(o => o.status === status);
    renderOrdersList(filtered);
}

/**
 * Confirm order delivery
 */
async function confirmOrderDelivery(orderId) {
    await OrdersManager.updateOrderStatus(orderId, 'review');
    showToast('تم تأكيد الاستلام', 'success');
    renderOrders();
}

/**
 * Cancel order
 */
async function cancelOrder(orderId) {
    if (!confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) return;
    await OrdersManager.updateOrderStatus(orderId, 'cancelled');
    showToast('تم إلغاء الطلب', 'success');
    renderOrders();
}

// Export managers
window.DashboardManager = DashboardManager;
window.NotificationsManager = NotificationsManager;
window.renderOrders = renderOrders;
window.filterOrders = filterOrders;

console.log('✅ Dashboard module loaded');
