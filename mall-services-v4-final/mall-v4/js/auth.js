// ==================== AUTHENTICATION MODULE ====================
// Mall Services - Complete Firebase Authentication System
// يتعامل مع تسجيل الدخول، إنشاء الحساب، Google Auth، وإدارة الجلسات

const AuthManager = {
    
    // ==================== STATE ====================
    currentUser: null,
    userProfile: null,
    authListeners: [],
    unsubscribeProfile: null,

    // ==================== INITIALIZATION ====================
    
    /**
     * Initialize auth state listener
     */
    init() {
        auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                this.currentUser = firebaseUser;
                await this.loadUserProfile(firebaseUser.uid);
                this.onLogin();
            } else {
                this.currentUser = null;
                this.userProfile = null;
                if (this.unsubscribeProfile) {
                    this.unsubscribeProfile();
                    this.unsubscribeProfile = null;
                }
                this.onLogout();
            }
            
            // Notify all listeners
            this.authListeners.forEach(listener => listener(firebaseUser));
        });
    },

    /**
     * Add auth state change listener
     * @param {Function} callback
     */
    onAuthChange(callback) {
        this.authListeners.push(callback);
    },

    // ==================== USER PROFILE ====================
    
    /**
     * Load user profile from Firestore
     * @param {string} uid - User ID
     */
    async loadUserProfile(uid) {
        try {
            // Real-time listener for profile changes
            if (this.unsubscribeProfile) this.unsubscribeProfile();
            
            this.unsubscribeProfile = db.collection(COLLECTIONS.USERS)
                .doc(uid)
                .onSnapshot(doc => {
                    if (doc.exists) {
                        this.userProfile = { id: doc.id, ...doc.data() };
                        AppState.currentUser = this.userProfile;
                        updateUI();
                    }
                }, error => {
                    console.error('Profile listener error:', error);
                });

            // Also get immediate data
            const doc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
            if (doc.exists) {
                this.userProfile = { id: doc.id, ...doc.data() };
                AppState.currentUser = this.userProfile;
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    },

    /**
     * Create user profile in Firestore after registration
     * @param {Object} user - Firebase user object
     * @param {Object} additionalData - Additional profile data
     */
    async createUserProfile(user, additionalData = {}) {
        const userRef = db.collection(COLLECTIONS.USERS).doc(user.uid);
        const doc = await userRef.get();
        
        if (!doc.exists) {
            const profileData = {
                uid: user.uid,
                name: additionalData.name || user.displayName || 'مستخدم جديد',
                email: user.email,
                avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(additionalData.name || 'U')}&background=0284c7&color=fff&size=200`,
                role: additionalData.role || 'seeker',
                bio: '',
                phone: '',
                location: '',
                skills: [],
                rating: 0,
                totalReviews: 0,
                totalOrders: 0,
                completedOrders: 0,
                joinedAt: serverTimestamp(),
                lastSeen: serverTimestamp(),
                isVerified: false,
                isActive: true,
                wallet: {
                    balance: 0,
                    pending: 0,
                    total: 0
                }
            };
            
            await userRef.set(profileData);
            
            // Create wallet document
            await db.collection(COLLECTIONS.WALLET).doc(user.uid).set({
                userId: user.uid,
                balance: 0,
                pending: 0,
                total: 0,
                transactions: [],
                updatedAt: serverTimestamp()
            });
            
            return profileData;
        }
        
        // Update last seen
        await userRef.update({ lastSeen: serverTimestamp() });
        return doc.data();
    },

    // ==================== EMAIL/PASSWORD AUTH ====================
    
    /**
     * Register with email and password
     * @param {string} name - Full name
     * @param {string} email - Email address
     * @param {string} password - Password
     * @param {string} role - Account role (provider/seeker)
     * @returns {Promise<Object>} User profile
     */
    async register(name, email, password, role = 'seeker') {
        try {
            // Show loading
            showLoading('جاري إنشاء الحساب...');
            
            // Create Firebase auth user
            const result = await auth.createUserWithEmailAndPassword(email, password);
            
            // Update display name
            await result.user.updateProfile({ displayName: name });
            
            // Create Firestore profile
            const profile = await this.createUserProfile(result.user, { name, role });
            
            // Log analytics event
            if (analytics) {
                analytics.logEvent('sign_up', { method: 'email', role });
            }
            
            hideLoading();
            showToast('تم إنشاء الحساب بنجاح! مرحباً بك', 'success');
            return profile;
            
        } catch (error) {
            hideLoading();
            const message = this.getAuthErrorMessage(error.code);
            showToast(message, 'error');
            throw error;
        }
    },

    /**
     * Login with email and password
     * @param {string} email - Email address
     * @param {string} password - Password
     * @returns {Promise<Object>} User credential
     */
    async login(email, password) {
        try {
            showLoading('جاري تسجيل الدخول...');
            
            const result = await auth.signInWithEmailAndPassword(email, password);
            
            // Update last seen
            await db.collection(COLLECTIONS.USERS).doc(result.user.uid).update({
                lastSeen: serverTimestamp()
            }).catch(() => {});
            
            if (analytics) {
                analytics.logEvent('login', { method: 'email' });
            }
            
            hideLoading();
            showToast('مرحباً بك مرة أخرى!', 'success');
            return result;
            
        } catch (error) {
            hideLoading();
            const message = this.getAuthErrorMessage(error.code);
            showToast(message, 'error');
            throw error;
        }
    },

    // ==================== GOOGLE AUTH ====================
    
    /**
     * Login or register with Google
     * @param {string} role - Role for new users
     * @returns {Promise<Object>} User credential
     */
    async loginWithGoogle(role = 'seeker') {
        try {
            showLoading('جاري تسجيل الدخول عبر Google...');
            
            const result = await auth.signInWithPopup(googleProvider);
            
            // Check if new user
            const isNewUser = result.additionalUserInfo.isNewUser;
            
            // Create/update profile
            await this.createUserProfile(result.user, {
                name: result.user.displayName,
                role: role
            });
            
            if (analytics) {
                analytics.logEvent(isNewUser ? 'sign_up' : 'login', { method: 'google' });
            }
            
            hideLoading();
            showToast(isNewUser ? 'مرحباً بك في Mall Services!' : 'مرحباً بك مرة أخرى!', 'success');
            return result;
            
        } catch (error) {
            hideLoading();
            if (error.code !== 'auth/popup-closed-by-user') {
                const message = this.getAuthErrorMessage(error.code);
                showToast(message, 'error');
            }
            throw error;
        }
    },

    // ==================== PASSWORD RESET ====================
    
    /**
     * Send password reset email
     * @param {string} email - Email address
     */
    async resetPassword(email) {
        try {
            showLoading('جاري إرسال رابط إعادة التعيين...');
            await auth.sendPasswordResetEmail(email);
            hideLoading();
            showToast('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني', 'success');
        } catch (error) {
            hideLoading();
            const message = this.getAuthErrorMessage(error.code);
            showToast(message, 'error');
            throw error;
        }
    },

    /**
     * Change password for logged in user
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     */
    async changePassword(currentPassword, newPassword) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('لم يتم تسجيل الدخول');
            
            // Re-authenticate first
            const credential = firebase.auth.EmailAuthProvider.credential(
                user.email,
                currentPassword
            );
            await user.reauthenticateWithCredential(credential);
            
            // Update password
            await user.updatePassword(newPassword);
            showToast('تم تغيير كلمة المرور بنجاح', 'success');
            
        } catch (error) {
            const message = this.getAuthErrorMessage(error.code);
            showToast(message, 'error');
            throw error;
        }
    },

    // ==================== PROFILE UPDATE ====================
    
    /**
     * Update user profile
     * @param {Object} updates - Profile updates
     */
    async updateProfile(updates) {
        try {
            const uid = this.currentUser?.uid;
            if (!uid) throw new Error('لم يتم تسجيل الدخول');
            
            showLoading('جاري حفظ التغييرات...');
            
            // Handle avatar upload if file provided
            if (updates.avatarFile) {
                const url = await uploadFile(
                    updates.avatarFile,
                    STORAGE_FOLDERS.AVATARS,
                    `${uid}_avatar`
                );
                updates.avatar = url;
                delete updates.avatarFile;
                
                // Update Firebase auth display photo
                await auth.currentUser.updateProfile({ photoURL: url });
            }
            
            // Update display name if changed
            if (updates.name) {
                await auth.currentUser.updateProfile({ displayName: updates.name });
            }
            
            // Update Firestore
            updates.updatedAt = serverTimestamp();
            await db.collection(COLLECTIONS.USERS).doc(uid).update(updates);
            
            hideLoading();
            showToast('تم تحديث الملف الشخصي بنجاح', 'success');
            
        } catch (error) {
            hideLoading();
            showToast('حدث خطأ أثناء تحديث الملف الشخصي', 'error');
            throw error;
        }
    },

    // ==================== LOGOUT ====================
    
    /**
     * Sign out current user
     */
    async logout() {
        try {
            // Update last seen before logout
            if (this.currentUser) {
                await db.collection(COLLECTIONS.USERS)
                    .doc(this.currentUser.uid)
                    .update({ lastSeen: serverTimestamp() })
                    .catch(() => {});
            }
            
            await auth.signOut();
            
            // Clear app state
            AppState.currentUser = null;
            AppState.cart = [];
            
            showToast('تم تسجيل الخروج بنجاح', 'success');
            navigateTo('home');
            
        } catch (error) {
            showToast('حدث خطأ أثناء تسجيل الخروج', 'error');
        }
    },

    // ==================== EMAIL VERIFICATION ====================
    
    /**
     * Send email verification
     */
    async sendEmailVerification() {
        try {
            await auth.currentUser.sendEmailVerification();
            showToast('تم إرسال رسالة التحقق إلى بريدك الإلكتروني', 'success');
        } catch (error) {
            showToast('حدث خطأ أثناء إرسال رسالة التحقق', 'error');
        }
    },

    // ==================== CALLBACKS ====================
    
    /**
     * Called when user logs in
     */
    onLogin() {
        updateUI();
        updateCartCount();
        // Check for pending actions
        const pendingAction = sessionStorage.getItem('pendingAction');
        if (pendingAction) {
            sessionStorage.removeItem('pendingAction');
            eval(pendingAction);
        }
    },

    /**
     * Called when user logs out
     */
    onLogout() {
        updateUI();
        // Redirect to home if on protected page
        const protectedPages = ['orders', 'workspace', 'wallet', 'profile', 'providerDashboard', 'seekerDashboard'];
        const currentPage = document.querySelector('.page.active')?.id;
        if (protectedPages.includes(currentPage)) {
            navigateTo('home');
        }
    },

    // ==================== ERROR MESSAGES ====================
    
    /**
     * Get Arabic error message from Firebase error code
     * @param {string} code - Firebase error code
     * @returns {string} Arabic error message
     */
    getAuthErrorMessage(code) {
        const messages = {
            'auth/user-not-found': 'لم يتم العثور على حساب بهذا البريد الإلكتروني',
            'auth/wrong-password': 'كلمة المرور غير صحيحة',
            'auth/email-already-in-use': 'هذا البريد الإلكتروني مسجل مسبقاً',
            'auth/weak-password': 'كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل)',
            'auth/invalid-email': 'البريد الإلكتروني غير صالح',
            'auth/network-request-failed': 'خطأ في الاتصال بالإنترنت',
            'auth/too-many-requests': 'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة لاحقاً',
            'auth/user-disabled': 'تم تعطيل هذا الحساب. يرجى التواصل مع الدعم',
            'auth/popup-blocked': 'تم حجب النافذة المنبثقة. يرجى السماح بها في المتصفح',
            'auth/popup-closed-by-user': 'تم إغلاق نافذة تسجيل الدخول',
            'auth/requires-recent-login': 'يجب تسجيل الدخول مجدداً لهذه العملية',
            'auth/invalid-credential': 'بيانات الدخول غير صحيحة',
            'auth/operation-not-allowed': 'هذه الطريقة غير مفعلة',
            'auth/account-exists-with-different-credential': 'يوجد حساب بنفس البريد الإلكتروني بطريقة تسجيل دخول مختلفة'
        };
        return messages[code] || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى';
    },

    // ==================== HELPERS ====================
    
    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isLoggedIn() {
        return !!this.currentUser;
    },

    /**
     * Require authentication to proceed
     * @param {Function} action - Action to perform after login
     * @returns {boolean} True if logged in
     */
    requireAuth(action = null) {
        if (!this.currentUser) {
            if (action) {
                sessionStorage.setItem('pendingAction', action.toString() + '()');
            }
            showToast('يرجى تسجيل الدخول أولاً', 'warning');
            navigateTo('login');
            return false;
        }
        return true;
    },

    /**
     * Check if current user is a provider
     * @returns {boolean}
     */
    isProvider() {
        return this.userProfile?.role === 'provider';
    },

    /**
     * Check if current user is a seeker
     * @returns {boolean}
     */
    isSeeker() {
        return this.userProfile?.role === 'seeker';
    },

    /**
     * Get user initials for avatar fallback
     * @param {string} name - Full name
     * @returns {string} Initials
     */
    getInitials(name) {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substr(0, 2);
    }
};

// ==================== AUTH FORM HANDLERS ====================

/**
 * Handle login form submission
 */
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showToast('يرجى ملء جميع الحقول', 'warning');
        return;
    }
    
    try {
        await AuthManager.login(email, password);
        navigateTo('home');
    } catch (error) {
        // Error already handled in AuthManager.login
    }
}

/**
 * Handle register form submission
 */
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const accountType = document.querySelector('input[name="accountType"]:checked')?.value || 'seeker';
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    if (!name || !email || !password) {
        showToast('يرجى ملء جميع الحقول', 'warning');
        return;
    }
    
    if (password.length < 6) {
        showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning');
        return;
    }
    
    if (!agreeTerms) {
        showToast('يرجى الموافقة على الشروط والأحكام', 'warning');
        return;
    }
    
    try {
        await AuthManager.register(name, email, password, accountType);
        navigateTo('home');
    } catch (error) {
        // Error already handled in AuthManager.register
    }
}

/**
 * Handle Google login button
 */
async function handleGoogleLogin() {
    try {
        const role = document.querySelector('input[name="accountType"]:checked')?.value || 'seeker';
        await AuthManager.loginWithGoogle(role);
        navigateTo('home');
    } catch (error) {
        // Error already handled
    }
}

/**
 * Handle logout
 */
async function logout() {
    await AuthManager.logout();
}

/**
 * Handle forgot password
 */
async function handleForgotPassword() {
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) {
        showToast('يرجى إدخال البريد الإلكتروني أولاً', 'warning');
        return;
    }
    await AuthManager.resetPassword(email);
}

// ==================== SHOW/HIDE LOADING ====================

function showLoading(message = 'جاري التحميل...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center';
        overlay.innerHTML = `
            <div class="bg-white rounded-3xl p-10 flex flex-col items-center gap-5 shadow-2xl">
                <div class="loading-spinner"></div>
                <p id="loadingMessage" class="font-bold text-gray-700 text-lg">${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        document.getElementById('loadingMessage').textContent = message;
        overlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

// Initialize Auth
window.AuthManager = AuthManager;
console.log('✅ Auth module loaded');
