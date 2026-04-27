/**
 * delivery.js — Order Delivery & Workspace System — Mall Services v4.0
 * نظام تسليم الطلبات — رفع ملفات • رسائل • مراجعات • تأكيد
 */
(function () {
    'use strict';

    const ALLOWED_TYPES = [
        'image/jpeg','image/png','image/gif','image/webp',
        'application/pdf',
        'application/zip','application/x-zip-compressed',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain','text/html','text/css',
        'application/javascript',
        'video/mp4','video/webm',
        'audio/mpeg','audio/wav',
    ];
    const MAX_SIZE_MB = 50;

    const DeliverySystem = {
        _orderId:      null,
        _order:        null,
        _unsub:        null,
        _sending:      false,

        // ── OPEN WORKSPACE ───────────────────────────────────────────────────
        async openWorkspace(orderId) {
            this._orderId = orderId;
            if (window.navigateTo) window.navigateTo('workspace');
            await this._loadOrder(orderId);
            this._subscribeMessages(orderId);
        },

        async _loadOrder(orderId) {
            if (!window.db) return;
            try {
                const doc = await window.db.collection(window.COLLECTIONS?.ORDERS || 'orders')
                    .doc(orderId).get();
                if (!doc.exists) return;
                this._order = { id: doc.id, ...doc.data() };
                this._renderWorkspaceHeader();
                this._renderOrderInfo();
                this._renderActionButtons();
            } catch (e) {
                console.error('[Delivery] _loadOrder error:', e.message);
            }
        },

        _renderWorkspaceHeader() {
            const o = this._order;
            if (!o) return;
            const title   = document.getElementById('workspaceTitle');
            const avatar  = document.getElementById('workspaceAvatar');
            const status  = document.getElementById('workspaceStatus');
            const orderId = document.getElementById('workspaceOrderId');
            if (title)   title.textContent   = o.serviceTitle || o.title || '—';
            if (avatar)  avatar.src           = o.sellerAvatar || o.buyerAvatar || 'https://i.pravatar.cc/80';
            if (status)  status.innerHTML     = `<span class="w-2 h-2 rounded-full ${this._statusColor(o.status)} inline-block"></span> ${this._statusLabel(o.status)}`;
            if (orderId) orderId.textContent  = `#${this._orderId?.substring(0,8)?.toUpperCase()}`;
        },

        _renderOrderInfo() {
            const o = this._order;
            if (!o) return;
            const el = document.getElementById('workspaceOrderInfo');
            if (!el) return;
            const user   = window.AppState?.currentUser;
            const isRole = user?.uid === o.sellerId ? 'seller' : 'buyer';
            const escrow = o.escrowAmount || o.amount || 0;
            el.innerHTML = `
                <div class="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-500">${window.t('orderNumber')}</span>
                        <span class="font-black text-indigo-700">#${this._orderId?.substring(0,8)?.toUpperCase()}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">${window.t('totalAmount')}</span>
                        <span class="font-bold">${window.fmt ? window.fmt(escrow) : escrow + ' ج.م'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">الحالة</span>
                        <span class="font-bold">${this._statusLabel(o.status)}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-2 bg-green-50 border border-green-200 rounded-xl p-3">
                        <i class="fa-solid fa-shield-check text-green-600"></i>
                        <span class="text-green-700 font-semibold text-xs">${window.t('escrowHeld')} — ${window.t('escrowInfo')}</span>
                    </div>
                </div>`;
        },

        _renderActionButtons() {
            const o    = this._order;
            const user = window.AppState?.currentUser;
            if (!o || !user) return;
            const el = document.getElementById('workspaceActions');
            if (!el) return;

            const isSeller = user.uid === o.sellerId;
            const isBuyer  = user.uid === o.buyerId;
            let btns = '';

            if (isSeller && (o.status === 'in-progress' || o.status === 'revision')) {
                btns += `<button onclick="window.DeliverySystem.showDeliverModal()" class="w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                    <i class="fa-solid fa-paper-plane"></i>${window.t('deliverWork')}
                </button>`;
            }
            if (isBuyer && o.status === 'delivered') {
                btns += `
                <button onclick="window.DeliverySystem.confirmDelivery()" class="w-full py-3 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition flex items-center justify-center gap-2">
                    <i class="fa-solid fa-circle-check"></i>${window.t('confirmDelivery')}
                </button>
                <button onclick="window.DeliverySystem.showRevisionModal()" class="w-full py-3 border-2 border-orange-400 text-orange-600 rounded-2xl font-bold hover:bg-orange-50 transition flex items-center justify-center gap-2 mt-2">
                    <i class="fa-solid fa-rotate-left"></i>${window.t('requestRevision')}
                </button>
                <button onclick="window.EscrowSystem && window.EscrowSystem.showDisputeModal('${this._orderId}','${user.uid}')" class="w-full py-3 border-2 border-red-400 text-red-600 rounded-2xl font-bold hover:bg-red-50 transition flex items-center justify-center gap-2 mt-2">
                    <i class="fa-solid fa-flag"></i>${window.t('openDispute')}
                </button>`;
            }
            if (o.status === 'completed') {
                btns = `<div class="text-center p-4 bg-green-50 border border-green-200 rounded-2xl">
                    <i class="fa-solid fa-circle-check text-green-600 text-2xl mb-2 block"></i>
                    <p class="font-bold text-green-700">${window.t('completed')}</p>
                </div>`;
            }
            el.innerHTML = btns || `<p class="text-center text-gray-400 text-sm py-4">${window.t('loading')}</p>`;
        },

        // ── SUBSCRIBE TO MESSAGES ─────────────────────────────────────────────
        _subscribeMessages(orderId) {
            if (this._unsub) { this._unsub(); this._unsub = null; }
            if (!window.db) return;
            this._unsub = window.db.collection('order_messages')
                .where('orderId', '==', orderId)
                .orderBy('createdAt', 'asc')
                .onSnapshot(snap => {
                    this._renderMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                }, err => {
                    console.warn('[Delivery] messages listener error:', err.message);
                });
        },

        _renderMessages(messages) {
            const container = document.getElementById('workspaceMessages');
            if (!container) return;
            const userId = window.AppState?.currentUser?.uid;
            if (!messages.length) {
                container.innerHTML = `<div class="text-center py-12 text-gray-400">
                    <i class="fa-solid fa-comments text-4xl mb-3 block opacity-40"></i>
                    <p class="font-medium">لا توجد رسائل بعد — ابدأ المحادثة</p>
                </div>`;
                return;
            }
            container.innerHTML = messages.map(msg => {
                const isMe   = msg.senderId === userId;
                const time   = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString(window.TR?.[localStorage.getItem('mall_lang')]?.locale || 'ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
                const bubble = `bg-${isMe ? 'indigo' : 'gray'}-${isMe ? '600 text-white' : '100 text-gray-800'}`;

                let fileHtml = '';
                if (msg.files && msg.files.length) {
                    fileHtml = `<div class="mt-2 space-y-1">` +
                        msg.files.map(f => `
                        <a href="${f.url}" target="_blank" download="${f.name}"
                           class="flex items-center gap-2 text-xs ${isMe ? 'text-indigo-200 hover:text-white' : 'text-indigo-600 hover:text-indigo-800'} transition">
                            <i class="fa-solid ${this._fileIcon(f.name)}"></i>
                            <span class="underline truncate max-w-xs">${f.name}</span>
                            <i class="fa-solid fa-download text-xs opacity-60"></i>
                        </a>`).join('') + `</div>`;
                }

                let typeTag = '';
                if (msg.type === 'delivery') typeTag = `<span class="text-xs font-bold ${isMe ? 'text-indigo-200' : 'text-indigo-600'} flex items-center gap-1 mb-1"><i class="fa-solid fa-paper-plane text-xs"></i> تسليم عمل</span>`;
                if (msg.type === 'revision')  typeTag = `<span class="text-xs font-bold ${isMe ? 'text-orange-200' : 'text-orange-600'} flex items-center gap-1 mb-1"><i class="fa-solid fa-rotate-left text-xs"></i> طلب مراجعة</span>`;

                return `
                <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-4">
                    <div class="max-w-sm lg:max-w-md">
                        ${typeTag}
                        <div class="px-4 py-3 rounded-2xl ${isMe ? 'rounded-tr-sm bg-indigo-600 text-white' : 'rounded-tl-sm bg-gray-100 text-gray-800'} shadow-sm">
                            <p class="text-sm leading-relaxed">${this._escapeHtml(msg.text || '')}</p>
                            ${fileHtml}
                        </div>
                        <p class="text-xs text-gray-400 mt-1 ${isMe ? 'text-right' : 'text-left'}">${time}</p>
                    </div>
                </div>`;
            }).join('');
            container.scrollTop = container.scrollHeight;
        },

        // ── SEND MESSAGE ──────────────────────────────────────────────────────
        async sendMessage(text, files = [], type = 'message') {
            if (this._sending) return;
            if (!text.trim() && !files.length) return;
            if (!window.db) return;
            const user = window.AppState?.currentUser;
            if (!user) { window.showToast && window.showToast(window.t('loginRequired'), 'warning'); return; }

            this._sending = true;
            try {
                const uploadedFiles = [];
                for (const file of files) {
                    const url = await this._uploadFile(file);
                    if (url) uploadedFiles.push({ name: file.name, url, size: file.size, type: file.type });
                }

                await window.db.collection('order_messages').add({
                    orderId:    this._orderId,
                    senderId:   user.uid,
                    senderName: user.displayName || user.name || 'مستخدم',
                    senderAvatar: user.photoURL || user.avatar || '',
                    text:       text.trim(),
                    files:      uploadedFiles,
                    type,
                    createdAt:  window.serverTimestamp ? window.serverTimestamp() : new Date(),
                });

                // Update order lastMessage
                await window.db.collection(window.COLLECTIONS?.ORDERS || 'orders')
                    .doc(this._orderId).update({
                        lastMessage:   text.trim().substring(0, 100),
                        lastMessageAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });
            } catch (e) {
                console.error('[Delivery] sendMessage error:', e.message);
                window.showToast && window.showToast('حدث خطأ أثناء الإرسال', 'error');
            } finally {
                this._sending = false;
            }
        },

        // ── DELIVER WORK (seller) ─────────────────────────────────────────────
        showDeliverModal() {
            document.getElementById('_deliverModal')?.remove();
            const modal = document.createElement('div');
            modal.id = '_deliverModal';
            modal.className = 'fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                            <i class="fa-solid fa-paper-plane text-indigo-600 text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-gray-900">${window.t('deliverWork')}</h3>
                            <p class="text-sm text-gray-500">أرفق ملفاتك ورسالة التسليم</p>
                        </div>
                    </div>
                    <textarea id="_deliverText" placeholder="${window.t('deliveryNote')}..." rows="4"
                        class="w-full p-4 border-2 border-gray-200 rounded-xl text-sm resize-none focus:border-indigo-500 focus:outline-none mb-4"></textarea>
                    <div id="_deliverDropzone" class="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center cursor-pointer hover:border-indigo-400 transition mb-4"
                         onclick="document.getElementById('_deliverFileInput').click()">
                        <i class="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2 block"></i>
                        <p class="text-sm text-gray-500">اسحب الملفات هنا أو <span class="text-indigo-600 font-bold">اضغط للرفع</span></p>
                        <p class="text-xs text-gray-400 mt-1">حتى 50MB — PDF, ZIP, Images, Docs, Video</p>
                    </div>
                    <input id="_deliverFileInput" type="file" multiple accept="*/*" class="hidden"
                           onchange="window.DeliverySystem._previewFiles(this.files)">
                    <div id="_deliverFilePreviews" class="space-y-2 mb-4"></div>
                    <div class="flex gap-3">
                        <button onclick="document.getElementById('_deliverModal').remove()"
                            class="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50">
                            ${window.t('cancel')}
                        </button>
                        <button onclick="window.DeliverySystem._submitDelivery()"
                            class="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                            <i class="fa-solid fa-paper-plane"></i>${window.t('deliverWork')}
                        </button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        },

        _previewFiles(files) {
            const container = document.getElementById('_deliverFilePreviews');
            if (!container || !files) return;
            container.innerHTML = '';
            Array.from(files).forEach(file => {
                container.innerHTML += `
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <i class="fa-solid ${this._fileIcon(file.name)} text-indigo-600"></i>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold truncate">${file.name}</p>
                        <p class="text-xs text-gray-400">${(file.size/1024/1024).toFixed(2)} MB</p>
                    </div>
                    <i class="fa-solid fa-check-circle text-green-500"></i>
                </div>`;
            });
        },

        async _submitDelivery() {
            const text  = document.getElementById('_deliverText')?.value || '';
            const input = document.getElementById('_deliverFileInput');
            const files = input?.files ? Array.from(input.files) : [];
            if (!text.trim() && !files.length) {
                window.showToast && window.showToast('أضف رسالة أو ملفات للتسليم', 'warning');
                return;
            }
            const btn = document.querySelector('#_deliverModal button:last-child');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-2"></i>جاري الرفع...'; }

            // Validate files
            for (const f of files) {
                if (f.size > MAX_SIZE_MB * 1024 * 1024) {
                    window.showToast && window.showToast(`الملف ${f.name} أكبر من ${MAX_SIZE_MB}MB`, 'error');
                    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane ml-2"></i>${window.t('deliverWork')}`; }
                    return;
                }
            }

            await this.sendMessage(text, files, 'delivery');

            // Update order status to delivered
            if (window.db && this._orderId) {
                await window.db.collection(window.COLLECTIONS?.ORDERS || 'orders')
                    .doc(this._orderId).update({
                        status:      'delivered',
                        deliveredAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                        updatedAt:   window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    }).catch(() => {});
            }

            window.showToast && window.showToast('تم تسليم العمل! ✅', 'success');
            document.getElementById('_deliverModal')?.remove();
            await this._loadOrder(this._orderId);
        },

        // ── CONFIRM DELIVERY (buyer) ──────────────────────────────────────────
        async confirmDelivery() {
            const confirmed = confirm(window.t('confirmDelivery') + '؟\n\nسيتم تحويل الأموال لمقدم الخدمة فوراً.');
            if (!confirmed) return;
            if (window.showLoading) window.showLoading(window.t('processing'));
            const ok = await window.EscrowSystem?.releasePayment(this._orderId);
            if (window.hideLoading) window.hideLoading();
            if (ok) {
                await this._loadOrder(this._orderId);
                window.showToast && window.showToast(window.t('escrowReleased'), 'success');
            }
        },

        // ── REQUEST REVISION (buyer) ──────────────────────────────────────────
        showRevisionModal() {
            document.getElementById('_revisionModal')?.remove();
            const modal = document.createElement('div');
            modal.id = '_revisionModal';
            modal.className = 'fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                            <i class="fa-solid fa-rotate-left text-orange-600 text-xl"></i>
                        </div>
                        <h3 class="text-xl font-black text-gray-900">${window.t('requestRevision')}</h3>
                    </div>
                    <textarea id="_revText" placeholder="${window.t('revisionNote')}..." rows="4"
                        class="w-full p-4 border-2 border-gray-200 rounded-xl text-sm resize-none focus:border-orange-400 focus:outline-none mb-4"></textarea>
                    <div class="flex gap-3">
                        <button onclick="document.getElementById('_revisionModal').remove()"
                            class="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50">${window.t('cancel')}</button>
                        <button onclick="window.DeliverySystem._submitRevision()"
                            class="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition">
                            ${window.t('requestRevision')}
                        </button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        },

        async _submitRevision() {
            const text = document.getElementById('_revText')?.value || '';
            if (!text.trim()) { window.showToast && window.showToast('اكتب سبب المراجعة', 'warning'); return; }
            await this.sendMessage(text, [], 'revision');
            if (window.db && this._orderId) {
                await window.db.collection(window.COLLECTIONS?.ORDERS || 'orders')
                    .doc(this._orderId).update({
                        status:     'revision',
                        updatedAt:  window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    }).catch(() => {});
            }
            window.showToast && window.showToast('تم إرسال طلب المراجعة', 'success');
            document.getElementById('_revisionModal')?.remove();
            await this._loadOrder(this._orderId);
        },

        // ── SEND CHAT MSG from UI ─────────────────────────────────────────────
        async sendChatMessage() {
            const input = document.getElementById('workspaceMsgInput');
            const fileInput = document.getElementById('workspaceMsgFile');
            const text  = input?.value || '';
            const files = fileInput?.files ? Array.from(fileInput.files) : [];
            if (!text.trim() && !files.length) return;
            if (input) input.value = '';
            if (fileInput) fileInput.value = '';
            await this.sendMessage(text, files, 'message');
        },

        // ── FILE UPLOAD ───────────────────────────────────────────────────────
        async _uploadFile(file) {
            if (!window.storage) return null;
            try {
                const ext  = file.name.split('.').pop();
                const path = `order_files/${this._orderId}/${Date.now()}_${Math.random().toString(36).substr(2,6)}.${ext}`;
                const ref  = window.storage.ref(path);
                await ref.put(file);
                return await ref.getDownloadURL();
            } catch (e) {
                console.error('[Delivery] upload error:', e.message);
                return null;
            }
        },

        // ── HELPERS ───────────────────────────────────────────────────────────
        _statusLabel(status) {
            const labels = {
                pending:     window.t('pending'),
                'in-progress': window.t('inProgress'),
                delivered:   window.t('delivered'),
                completed:   window.t('completed'),
                cancelled:   window.t('cancelled'),
                disputed:    window.t('disputed'),
                revision:    window.t('revision'),
                refunded:    window.t('refunded'),
            };
            return labels[status] || status;
        },
        _statusColor(status) {
            const colors = {
                pending: 'bg-yellow-400', 'in-progress': 'bg-blue-400',
                delivered: 'bg-purple-400', completed: 'bg-green-400',
                cancelled: 'bg-red-400', disputed: 'bg-orange-400',
            };
            return colors[status] || 'bg-gray-400';
        },
        _fileIcon(name) {
            const ext = name.split('.').pop().toLowerCase();
            if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'fa-image';
            if (ext === 'pdf') return 'fa-file-pdf';
            if (['zip','rar','7z','tar'].includes(ext)) return 'fa-file-zipper';
            if (['doc','docx'].includes(ext)) return 'fa-file-word';
            if (['xls','xlsx','csv'].includes(ext)) return 'fa-file-excel';
            if (['mp4','avi','mov','webm'].includes(ext)) return 'fa-file-video';
            if (['mp3','wav','aac'].includes(ext)) return 'fa-file-audio';
            if (['js','ts','html','css','py','php'].includes(ext)) return 'fa-file-code';
            return 'fa-file';
        },
        _escapeHtml(text) {
            const d = document.createElement('div');
            d.textContent = text;
            return d.innerHTML;
        },
    };

    window.DeliverySystem = DeliverySystem;

    // Global helper for Enter key in message input
    window.workspaceEnterKey = function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            window.DeliverySystem.sendChatMessage();
        }
    };

    console.log('✅ Delivery System v4.0 ready');
})();
