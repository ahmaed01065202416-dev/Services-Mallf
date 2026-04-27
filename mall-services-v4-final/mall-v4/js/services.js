// ==================== SERVICES MODULE ====================
// Mall Services - Complete Services & Orders Management with Firestore

const ServicesManager = {

    // ==================== STATE ====================
    allServices: [],
    filteredServices: [],
    currentFilter: 'all',
    currentSort: 'newest',
    minRating: 0,
    minPrice: 0,
    maxPrice: Infinity,
    currentPage: 1,
    itemsPerPage: 12,
    unsubscribeServices: null,

    // ==================== INITIALIZATION ====================

    /**
     * Initialize services with real-time listener
     */
    init() {
        this.loadServices();
    },

    /**
     * Load services from Firestore with real-time updates
     */
    loadServices() {
        if (this.unsubscribeServices) this.unsubscribeServices();

        this.unsubscribeServices = db.collection(COLLECTIONS.SERVICES)
            .where('isActive', '==', true)
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                this.allServices = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Merge with default services if empty
                if (this.allServices.length === 0) {
                    this.seedDefaultServices();
                }

                this.applyFilters();
                this.renderFeaturedServices();
                updateStats();
            }, error => {
                if (error.code === 'failed-precondition' || error.message?.includes('index')) {
                    // Composite index missing — fall back to simple query
                    console.warn('[Services] Composite index missing, using simple query. Create index at:', error.message?.match(/https:\/\/[^\s]+/)?.[0] || 'Firebase Console');
                    db.collection(window.COLLECTIONS?.SERVICES || 'services')
                      .where('isActive', '==', true)
                      .orderBy('createdAt', 'desc')
                      .get()
                      .then(snap => {
                          this.allServices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                          if (!this.allServices.length) this.seedDefaultServices();
                          this.applyFilters();
                          this.renderFeaturedServices();
                      })
                      .catch(() => {
                          this.allServices = JSON.parse(localStorage.getItem('services') || '[]');
                          if (!this.allServices.length) this.allServices = defaultServices || [];
                          this.applyFilters();
                          this.renderFeaturedServices();
                      });
                } else {
                    console.warn('[Services] Firestore error:', error.message);
                    const cached = JSON.parse(localStorage.getItem('services') || '[]');
                    this.allServices = cached.length > 0 ? cached : (defaultServices || []);
                    this.applyFilters();
                    this.renderFeaturedServices();
                }
            });
    },

    /**
     * Seed default services to Firestore
     */
    async seedDefaultServices() {
        try {
            const batch = db.batch();
            defaultServices.forEach(service => {
                const ref = db.collection(COLLECTIONS.SERVICES).doc(String(service.id));
                batch.set(ref, {
                    ...service,
                    id: String(service.id),
                    isActive: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            });
            await batch.commit();
        } catch (e) {
            console.warn('Could not seed services:', e.message);
            this.allServices = defaultServices;
        }
    },

    // ==================== FILTER & SORT ====================

    /**
     * Apply all current filters and sort
     */
    applyFilters() {
        let filtered = [...this.allServices];

        // Category filter
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(s => s.category === this.currentFilter);
        }

        // Price filter
        filtered = filtered.filter(s =>
            s.price >= this.minPrice && s.price <= this.maxPrice
        );

        // Rating filter
        if (this.minRating > 0) {
            filtered = filtered.filter(s => parseFloat(s.rating) >= this.minRating);
        }

        // Sort
        filtered = this.sortServices(filtered, this.currentSort);

        this.filteredServices = filtered;
        this.currentPage = 1;
        this.renderServices();
    },

    /**
     * Sort services array
     */
    sortServices(services, sort) {
        const arr = [...services];
        switch (sort) {
            case 'newest': return arr.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            case 'popular': return arr.sort((a, b) => (b.orders || 0) - (a.orders || 0));
            case 'price-low': return arr.sort((a, b) => a.price - b.price);
            case 'price-high': return arr.sort((a, b) => b.price - a.price);
            case 'rating': return arr.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
            default: return arr;
        }
    },

    /**
     * Filter by category
     */
    filterByCategory(category) {
        this.currentFilter = category;
        this.applyFilters();
    },

    /**
     * Filter by price range
     */
    filterByPrice(min, max) {
        this.minPrice = min || 0;
        this.maxPrice = max || Infinity;
        this.applyFilters();
    },

    /**
     * Filter by minimum rating
     */
    filterByRating(rating) {
        this.minRating = rating;
        this.applyFilters();
    },

    /**
     * Search services
     */
    search(query) {
        if (!query.trim()) {
            this.applyFilters();
            return;
        }
        const q = query.toLowerCase();
        const filtered = this.allServices.filter(s =>
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.seller.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q)
        );
        this.filteredServices = filtered;
        this.currentPage = 1;
        this.renderServices();
    },

    /**
     * Clear all filters
     */
    clearFilters() {
        this.currentFilter = 'all';
        this.minPrice = 0;
        this.maxPrice = Infinity;
        this.minRating = 0;
        this.currentSort = 'newest';
        document.getElementById('priceMin').value = '';
        document.getElementById('priceMax').value = '';
        document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false);
        this.applyFilters();
    },

    // ==================== RENDER ====================

    /**
     * Render services grid with pagination
     */
    renderServices() {
        const grid = document.getElementById('servicesGrid');
        const empty = document.getElementById('servicesEmpty');
        const countEl = document.getElementById('servicesCount');
        const pagination = document.getElementById('pagination');

        if (!grid) return;

        if (this.filteredServices.length === 0) {
            grid.innerHTML = '';
            empty?.classList.remove('hidden');
            pagination && (pagination.innerHTML = '');
            return;
        }

        empty?.classList.add('hidden');

        // Pagination
        const total = this.filteredServices.length;
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const paginatedServices = this.filteredServices.slice(start, end);

        if (countEl) countEl.textContent = `${total} خدمة متاحة`;

        grid.innerHTML = paginatedServices.map(s => this.createServiceCard(s)).join('');

        // Render pagination
        if (pagination) {
            this.renderPagination(Math.ceil(total / this.itemsPerPage));
        }
    },

    /**
     * Render featured services on homepage
     */
    renderFeaturedServices() {
        const container = document.getElementById('featuredServices');
        if (!container) return;

        const featured = this.allServices
            .sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0))
            .slice(0, 4);

        container.innerHTML = featured.map(s => this.createServiceCard(s)).join('');
    },

    /**
     * Create service card HTML
     */
    createServiceCard(service) {
        const stars = generateStars(parseFloat(service.rating) || 0);
        const isFavorite = AppState.favorites.some(f => f.id === service.id);

        return `
            <div class="card bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer glow-card relative group"
                 onclick="viewService('${service.id}')">
                <div class="h-56 bg-gray-200 relative overflow-hidden">
                    <img src="${service.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500'}"
                         class="w-full h-full object-cover hover:scale-110 transition duration-700"
                         onerror="this.src='https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500'">
                    <span class="absolute top-4 right-4 category-badge">${getCategoryName(service.category)}</span>
                    <button onclick="event.stopPropagation(); toggleFavoriteService('${service.id}')"
                            class="absolute top-4 left-4 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition">
                        <i class="${isFavorite ? 'fa-solid text-red-500' : 'fa-regular text-gray-400'} fa-heart text-sm"></i>
                    </button>
                </div>
                <div class="p-5">
                    <h3 class="font-bold text-gray-900 text-base line-clamp-2 mb-3 hover:text-brand-600 leading-relaxed">${service.title}</h3>
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            <img src="${service.avatar || 'https://ui-avatars.com/api/?name=U'}"
                                 class="w-8 h-8 rounded-full border-2 border-brand-100"
                                 onerror="this.src='https://ui-avatars.com/api/?name=U'">
                            <span class="text-sm text-gray-600 font-medium">${service.seller || 'مجهول'}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="text-yellow-400 text-xs">${stars}</span>
                            <span class="text-gray-500 text-xs font-bold">${parseFloat(service.rating || 0).toFixed(1)}</span>
                        </div>
                    </div>
                    <div class="border-t border-gray-100 pt-4 flex justify-between items-center">
                        <span class="text-xs text-gray-500 flex items-center gap-1">
                            <i class="fa-regular fa-clock"></i>
                            ${service.delivery || 3} أيام
                        </span>
                        <span class="price-badge">${service.price} ج.م</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render pagination
     */
    renderPagination(totalPages) {
        const pagination = document.getElementById('pagination');
        if (!pagination || totalPages <= 1) {
            if (pagination) pagination.innerHTML = '';
            return;
        }

        let html = '';

        // Previous button
        html += `<button onclick="ServicesManager.goToPage(${this.currentPage - 1})"
                         class="px-4 py-2 rounded-xl ${this.currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-200 text-gray-700 hover:bg-brand-50'}"
                         ${this.currentPage === 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-right"></i>
                 </button>`;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                html += `<button onclick="ServicesManager.goToPage(${i})"
                                 class="px-4 py-2 rounded-xl font-bold ${i === this.currentPage ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-brand-50'}">
                            ${i}
                         </button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                html += `<span class="px-2 text-gray-400">...</span>`;
            }
        }

        // Next button
        html += `<button onclick="ServicesManager.goToPage(${this.currentPage + 1})"
                         class="px-4 py-2 rounded-xl ${this.currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-200 text-gray-700 hover:bg-brand-50'}"
                         ${this.currentPage === totalPages ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left"></i>
                 </button>`;

        pagination.innerHTML = html;
    },

    /**
     * Go to specific page
     */
    goToPage(page) {
        const totalPages = Math.ceil(this.filteredServices.length / this.itemsPerPage);
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.renderServices();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ==================== SERVICE DETAIL ====================

    /**
     * View service detail
     * @param {string} serviceId
     */
    async viewService(serviceId) {
        try {
            let service = this.allServices.find(s => s.id === serviceId || s.id === parseInt(serviceId));

            if (!service) {
                // Try fetching from Firestore
                const doc = await db.collection(COLLECTIONS.SERVICES).doc(serviceId).get();
                if (doc.exists) {
                    service = { id: doc.id, ...doc.data() };
                } else {
                    showToast('لم يتم العثور على الخدمة', 'error');
                    return;
                }
            }

            AppState.currentService = service;

            // Update page content
            document.getElementById('detailImage').src = service.image || '';
            document.getElementById('detailTitle').textContent = service.title;
            document.getElementById('detailAvatar').src = service.avatar || '';
            document.getElementById('detailSeller').textContent = service.seller;
            document.getElementById('detailRating').textContent = parseFloat(service.rating || 0).toFixed(1);
            document.getElementById('detailDescription').textContent = service.description;
            document.getElementById('detailPrice').textContent = service.price + ' ج.م';
            document.getElementById('detailDelivery').textContent = service.delivery + ' أيام';
            document.getElementById('detailOrderCount').textContent = (service.orders || 0) + ' مرة';
            document.getElementById('detailCategory').textContent = getCategoryName(service.category);

            // Update favorite icon
            const isFav = AppState.favorites.some(f => f.id === serviceId);
            document.getElementById('favoriteIcon').className = isFav
                ? 'fa-solid fa-heart text-2xl text-red-500'
                : 'fa-regular fa-heart text-2xl';

            // Load reviews
            await this.loadServiceReviews(serviceId);

            navigateTo('serviceDetail');

            // Track view
            if (analytics) {
                analytics.logEvent('view_item', {
                    item_id: serviceId,
                    item_name: service.title,
                    price: service.price
                });
            }

        } catch (error) {
            console.error('Error viewing service:', error);
            showToast('حدث خطأ أثناء تحميل الخدمة', 'error');
        }
    },

    /**
     * Load service reviews from Firestore
     * @param {string} serviceId
     */
    async loadServiceReviews(serviceId) {
        const container = document.getElementById('serviceReviews');
        if (!container) return;

        try {
            const snapshot = await db.collection(COLLECTIONS.REVIEWS)
                .where('serviceId', '==', serviceId)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            const reviews = snapshot.docs.map(doc => doc.data());

            if (reviews.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">لا توجد تقييمات بعد</p>';
                return;
            }

            container.innerHTML = reviews.map(review => `
                <div class="border-b border-gray-100 pb-6 last:border-0">
                    <div class="flex items-center gap-4 mb-3">
                        <img src="${review.userAvatar || 'https://ui-avatars.com/api/?name=U'}"
                             class="w-10 h-10 rounded-full border-2 border-gray-100"
                             onerror="this.src='https://ui-avatars.com/api/?name=U'">
                        <div class="flex-1">
                            <div class="flex items-center justify-between">
                                <p class="font-bold text-sm">${review.userName}</p>
                                <span class="text-xs text-gray-400">${this.formatDate(review.createdAt)}</span>
                            </div>
                            <div class="flex text-yellow-400 text-xs mt-1">${generateStars(review.rating)}</div>
                        </div>
                    </div>
                    <p class="text-gray-600 text-sm leading-relaxed">${review.comment}</p>
                </div>
            `).join('');

        } catch (error) {
            // Fallback to service.reviews if Firestore fails
            const service = AppState.currentService;
            if (service?.reviews && service.reviews.length > 0) {
                container.innerHTML = service.reviews.map(review => `
                    <div class="border-b border-gray-100 pb-6 last:border-0">
                        <div class="flex items-center gap-4 mb-3">
                            <img src="${review.avatar || 'https://ui-avatars.com/api/?name=U'}" class="w-10 h-10 rounded-full">
                            <div>
                                <p class="font-bold text-sm">${review.userName}</p>
                                <div class="flex text-yellow-400 text-xs">${generateStars(review.rating)}</div>
                            </div>
                        </div>
                        <p class="text-gray-600 text-sm">${review.comment}</p>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">لا توجد تقييمات بعد</p>';
            }
        }
    },

    // ==================== CREATE SERVICE ====================

    /**
     * Create new service
     */
    async createService() {
        if (!AuthManager.requireAuth()) return;
        if (!AuthManager.isProvider()) {
            showToast('يجب أن تكون مقدم خدمة لإنشاء خدمة', 'warning');
            return;
        }

        const title = document.getElementById('serviceTitle').value.trim();
        let category = document.getElementById('serviceCategory').value;
        const price = parseFloat(document.getElementById('servicePrice').value);
        const delivery = parseInt(document.getElementById('serviceDelivery').value);
        const description = document.getElementById('serviceDescription').value.trim();
        const imageFile = document.getElementById('serviceImage').files[0];

        if (category === 'other') {
            category = document.getElementById('customCategory').value.trim() || 'other';
        }

        if (!title || !category || !price || !delivery || !description) {
            showToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
            return;
        }

        if (price < 10) {
            showToast('الحد الأدنى للسعر هو 10 ج.م', 'warning');
            return;
        }

        try {
            showLoading('جاري نشر الخدمة...');

            const user = AuthManager.userProfile;
            let imageUrl = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500';

            // Upload image if provided
            if (imageFile) {
                imageUrl = await uploadFile(imageFile, STORAGE_FOLDERS.SERVICES);
            }

            const serviceData = {
                title,
                category,
                price,
                delivery,
                description,
                image: imageUrl,
                seller: user.name,
                sellerId: user.uid,
                avatar: user.avatar,
                rating: 0,
                orders: 0,
                reviews: [],
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const docRef = await db.collection(COLLECTIONS.SERVICES).add(serviceData);

            hideLoading();
            closeModal('createServiceModal');
            showToast('تم نشر الخدمة بنجاح!', 'success');

            // Clear form
            document.getElementById('serviceTitle').value = '';
            document.getElementById('serviceCategory').value = '';
            document.getElementById('servicePrice').value = '';
            document.getElementById('serviceDelivery').value = '';
            document.getElementById('serviceDescription').value = '';
            document.getElementById('imagePreview').classList.remove('show');

            if (analytics) {
                analytics.logEvent('create_service', { category, price });
            }

        } catch (error) {
            hideLoading();
            console.error('Create service error:', error);
            showToast('حدث خطأ أثناء نشر الخدمة', 'error');
        }
    },

    /**
     * Delete service
     */
    async deleteService(serviceId) {
        if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;

        try {
            showLoading('جاري حذف الخدمة...');

            await db.collection(COLLECTIONS.SERVICES).doc(serviceId).update({
                isActive: false,
                deletedAt: serverTimestamp()
            });

            hideLoading();
            showToast('تم حذف الخدمة بنجاح', 'success');

        } catch (error) {
            hideLoading();
            showToast('حدث خطأ أثناء حذف الخدمة', 'error');
        }
    },

    // ==================== HELPERS ====================

    formatDate(timestamp) {
        if (!timestamp) return '';
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
};

// ==================== ORDERS MANAGER ====================

const OrdersManager = {

    orders: [],
    currentOrder: null,
    unsubscribeOrders: null,

    /**
     * Initialize orders listener
     */
    init() {
        auth.onAuthStateChanged(user => {
            if (user) {
                this.loadOrders(user.uid);
            } else {
                this.orders = [];
                if (this.unsubscribeOrders) {
                    this.unsubscribeOrders();
                    this.unsubscribeOrders = null;
                }
            }
        });
    },

    /**
     * Load user orders with real-time updates
     */
    loadOrders(userId) {
        if (this.unsubscribeOrders) this.unsubscribeOrders();

        this.unsubscribeOrders = db.collection(COLLECTIONS.ORDERS)
            .where('buyerId', '==', userId)
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                this.orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                AppState.orders = this.orders;
                this.updateOrderBadge();
            }, error => {
                console.warn('Orders listener error:', error);
                // Fallback to localStorage
                this.orders = AppState.orders;
            });
    },

    updateOrderBadge() {
        const activeOrders = this.orders.filter(o =>
            o.status === 'delivered' || o.status === 'pending'
        ).length;

        const badge = document.getElementById('messageBadge');
        if (badge) badge.classList.toggle('hidden', activeOrders === 0);
    },

    /**
     * Create new order after payment
     */
    async createOrder(serviceData, paymentMethod, paymentId = null) {
        const user = AuthManager.userProfile;
        if (!user) throw new Error('لم يتم تسجيل الدخول');

        const orderData = {
            serviceId: serviceData.id,
            title: serviceData.title,
            description: serviceData.description || '',
            seller: serviceData.seller,
            sellerId: serviceData.sellerId,
            sellerAvatar: serviceData.avatar,
            buyer: user.name,
            buyerId: user.uid,
            buyerAvatar: user.avatar,
            price: serviceData.price,
            status: 'pending',
            paymentMethod: paymentMethod,
            paymentId: paymentId,
            delivery: serviceData.delivery,
            image: serviceData.image,
            messages: [],
            files: [],
            requirements: '',
            deliveryNote: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        const docRef = await db.collection(COLLECTIONS.ORDERS).add(orderData);

        // Update service order count
        await db.collection(COLLECTIONS.SERVICES).doc(String(serviceData.id)).update({
            orders: firebase.firestore.FieldValue.increment(1)
        }).catch(() => {});

        // Add notification for seller
        await this.addNotification(serviceData.sellerId, {
            title: 'طلب جديد',
            message: `لديك طلب جديد لخدمة: ${serviceData.title}`,
            type: 'order',
            orderId: docRef.id
        });

        // Log analytics
        if (analytics) {
            analytics.logEvent('purchase', {
                transaction_id: docRef.id,
                value: serviceData.price,
                currency: 'EGP',
                items: [{
                    item_id: serviceData.id,
                    item_name: serviceData.title,
                    price: serviceData.price
                }]
            });
        }

        return { id: docRef.id, ...orderData };
    },

    /**
     * Update order status
     */
    async updateOrderStatus(orderId, status, additionalData = {}) {
        const data = {
            status,
            updatedAt: serverTimestamp(),
            ...additionalData
        };

        await db.collection(COLLECTIONS.ORDERS).doc(orderId).update(data);

        // Notify relevant party
        const order = this.orders.find(o => o.id === orderId);
        if (order) {
            if (status === 'delivered') {
                await this.addNotification(order.buyerId, {
                    title: 'تم تسليم الطلب',
                    message: `قام ${order.seller} بتسليم: ${order.title}`,
                    type: 'delivery',
                    orderId
                });
            } else if (status === 'completed') {
                await this.addNotification(order.sellerId, {
                    title: 'تم اكتمال الطلب',
                    message: `أكد ${order.buyer} استلام: ${order.title}`,
                    type: 'completed',
                    orderId
                });

                // Release payment to seller
                await this.releasePayment(order);
            }
        }
    },

    /**
     * Release payment to seller after order completion
     */
    async releasePayment(order) {
        try {
            const platformFee = order.price * 0.1; // 10% platform fee
            const sellerAmount = order.price - platformFee;

            // Update seller wallet
            await db.collection(COLLECTIONS.WALLET).doc(order.sellerId).update({
                balance: firebase.firestore.FieldValue.increment(sellerAmount),
                total: firebase.firestore.FieldValue.increment(sellerAmount),
                pending: firebase.firestore.FieldValue.increment(-order.price),
                updatedAt: serverTimestamp()
            });

            // Add transaction record
            await db.collection(COLLECTIONS.TRANSACTIONS).add({
                userId: order.sellerId,
                type: 'credit',
                amount: sellerAmount,
                description: `أرباح: ${order.title}`,
                orderId: order.id,
                createdAt: serverTimestamp()
            });

        } catch (e) {
            console.warn('Payment release error:', e);
        }
    },

    /**
     * Add notification
     */
    async addNotification(userId, notificationData) {
        try {
            await db.collection(COLLECTIONS.NOTIFICATIONS).add({
                userId,
                ...notificationData,
                read: false,
                createdAt: serverTimestamp()
            });
        } catch (e) {
            console.warn('Notification error:', e);
        }
    },

    /**
     * Send message in workspace
     */
    async sendWorkspaceMessage(orderId, text, userId) {
        const messageData = {
            sender: userId,
            text,
            time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            createdAt: serverTimestamp()
        };

        await db.collection(COLLECTIONS.ORDERS).doc(orderId).update({
            messages: firebase.firestore.FieldValue.arrayUnion(messageData),
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Submit review for completed order
     */
    async submitReview(orderId, rating, comment) {
        const order = AppState.orders.find(o => o.id === orderId) ||
                      this.orders.find(o => o.id === orderId);
        if (!order) return;

        const user = AuthManager.userProfile;

        const reviewData = {
            serviceId: String(order.serviceId),
            orderId,
            userId: user.uid,
            userName: user.name,
            userAvatar: user.avatar,
            rating,
            comment,
            createdAt: serverTimestamp()
        };

        const batch = db.batch();

        // Add review document
        const reviewRef = db.collection(COLLECTIONS.REVIEWS).doc();
        batch.set(reviewRef, reviewData);

        // Update order status to completed
        const orderRef = db.collection(COLLECTIONS.ORDERS).doc(orderId);
        batch.update(orderRef, {
            status: 'completed',
            reviewId: reviewRef.id,
            updatedAt: serverTimestamp()
        });

        await batch.commit();

        // Update service rating
        await this.updateServiceRating(String(order.serviceId));
    },

    /**
     * Recalculate and update service rating
     */
    async updateServiceRating(serviceId) {
        const snapshot = await db.collection(COLLECTIONS.REVIEWS)
            .where('serviceId', '==', serviceId)
            .get();

        if (snapshot.empty) return;

        const ratings = snapshot.docs.map(doc => doc.data().rating);
        const avgRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);

        await db.collection(COLLECTIONS.SERVICES).doc(serviceId).update({
            rating: parseFloat(avgRating),
            totalReviews: ratings.length
        }).catch(() => {});
    }
};

// ==================== WALLET MANAGER ====================

const WalletManager = {

    walletData: { balance: 0, pending: 0, total: 0 },
    transactions: [],
    unsubscribe: null,

    /**
     * Initialize wallet listener
     */
    init() {
        auth.onAuthStateChanged(user => {
            if (user) {
                this.loadWallet(user.uid);
            } else {
                this.walletData = { balance: 0, pending: 0, total: 0 };
                this.transactions = [];
                if (this.unsubscribe) {
                    this.unsubscribe();
                    this.unsubscribe = null;
                }
            }
        });
    },

    /**
     * Load wallet with real-time updates
     */
    loadWallet(userId) {
        if (this.unsubscribe) this.unsubscribe();

        this.unsubscribe = db.collection(COLLECTIONS.WALLET)
            .doc(userId)
            .onSnapshot(doc => {
                if (doc.exists) {
                    this.walletData = doc.data();
                    AppState.wallet = this.walletData;
                }
            }, error => {
                console.warn('Wallet listener error:', error);
                this.walletData = AppState.wallet;
            });

        // Load transactions
        this.loadTransactions(userId);
    },

    /**
     * Load transaction history
     */
    async loadTransactions(userId) {
        try {
            const snapshot = await db.collection(COLLECTIONS.TRANSACTIONS)
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();

            this.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.warn('Transactions error:', e);
            this.transactions = AppState.wallet?.transactions || [];
        }
    },

    /**
     * Add funds to wallet via Paymob
     */
    async addFunds(amount, paymentMethod = 'paymob') {
        if (!amount || amount < 50) {
            showToast('الحد الأدنى للإيداع هو 50 ج.م', 'warning');
            return;
        }

        // Initialize Paymob payment
        await PaymobManager.initiatePayment(amount, 'wallet_topup', {
            description: `إضافة رصيد للمحفظة: ${amount} ج.م`
        });
    },

    /**
     * Deduct from wallet
     */
    async deductBalance(amount, description, userId) {
        const userWallet = await db.collection(COLLECTIONS.WALLET).doc(userId).get();
        const balance = userWallet.data()?.balance || 0;

        if (balance < amount) {
            throw new Error('الرصيد غير كافي');
        }

        await db.collection(COLLECTIONS.WALLET).doc(userId).update({
            balance: firebase.firestore.FieldValue.increment(-amount),
            updatedAt: serverTimestamp()
        });

        await db.collection(COLLECTIONS.TRANSACTIONS).add({
            userId,
            type: 'debit',
            amount,
            description,
            createdAt: serverTimestamp()
        });
    },

    /**
     * Credit wallet after payment
     */
    async creditBalance(amount, description, userId) {
        await db.collection(COLLECTIONS.WALLET).doc(userId).set({
            balance: firebase.firestore.FieldValue.increment(amount),
            total: firebase.firestore.FieldValue.increment(amount),
            updatedAt: serverTimestamp()
        }, { merge: true });

        await db.collection(COLLECTIONS.TRANSACTIONS).add({
            userId,
            type: 'credit',
            amount,
            description,
            createdAt: serverTimestamp()
        });
    }
};

// Export managers
window.ServicesManager = ServicesManager;
window.OrdersManager = OrdersManager;
window.WalletManager = WalletManager;

console.log('✅ Services module loaded');
