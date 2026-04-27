/**
 * escrow.js — Escrow & Dispute System — Mall Services v4.0
 * نظام حجز الأموال والنزاعات الاحترافي
 * Flow: Payment → HOLD → Delivery → Confirm → RELEASE to Seller
 */
(function () {
    'use strict';

    const STATUS = {
        HOLDING:   'holding',
        RELEASED:  'released',
        DISPUTED:  'disputed',
        REFUNDED:  'refunded',
        CANCELLED: 'cancelled',
    };

    const EscrowSystem = {

        // ── HOLD: called when payment is confirmed ───────────────────────────
        async holdPayment(orderId, amount, buyerId, sellerId, paymentRef) {
            if (!window.db) return false;
            try {
                const col = window.COLLECTIONS?.PAYMENTS || 'payments';
                await window.db.collection(col).add({
                    orderId, amount, buyerId, sellerId,
                    paymentRef: paymentRef || null,
                    status:     STATUS.HOLDING,
                    heldAt:     window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    releasedAt: null,
                    refundedAt: null,
                    notes:      '',
                });

                // Update order status
                await window.db.collection(window.COLLECTIONS?.ORDERS || 'orders')
                    .doc(orderId).update({
                        status:      'in-progress',
                        escrowStatus: STATUS.HOLDING,
                        escrowAmount: amount,
                        updatedAt:   window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });

                // Notify seller
                this._notify(sellerId, 'newOrder', `طلب جديد — رقم ${orderId}. يمكنك البدء الآن.`);
                console.log('[Escrow] Payment held for order:', orderId);
                return true;
            } catch (e) {
                console.error('[Escrow] holdPayment error:', e.message);
                return false;
            }
        },

        // ── RELEASE: buyer confirms delivery ────────────────────────────────
        async releasePayment(orderId) {
            if (!window.db) return false;
            try {
                // Get escrow record
                const snap = await window.db.collection(window.COLLECTIONS?.PAYMENTS || 'payments')
                    .where('orderId', '==', orderId)
                    .where('status', '==', STATUS.HOLDING)
                    .limit(1).get();

                if (snap.empty) throw new Error('No escrow record found');
                const escrow     = snap.docs[0];
                const escrowData = escrow.data();
                const platform   = window.PLATFORM || {};
                const feeRate    = (platform.FEE_PERCENT || 5) / 100;
                const fee        = parseFloat((escrowData.amount * feeRate).toFixed(2));
                const sellerNet  = parseFloat((escrowData.amount - fee).toFixed(2));

                // Update escrow record
                await escrow.ref.update({
                    status:      STATUS.RELEASED,
                    releasedAt:  window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    platformFee: fee,
                    sellerNet,
                });

                // Credit seller wallet
                const walletRef = window.db.collection(window.COLLECTIONS?.WALLET || 'wallets').doc(escrowData.sellerId);
                const walletSnap = await walletRef.get();
                if (walletSnap.exists) {
                    await walletRef.update({
                        balance:     window.increment ? window.increment(sellerNet) : sellerNet,
                        totalEarned: window.increment ? window.increment(sellerNet) : sellerNet,
                        updatedAt:   window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });
                } else {
                    await walletRef.set({
                        userId:      escrowData.sellerId,
                        balance:     sellerNet,
                        pending:     0,
                        totalEarned: sellerNet,
                        createdAt:   window.serverTimestamp ? window.serverTimestamp() : new Date(),
                        updatedAt:   window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });
                }

                // Record transaction
                await window.db.collection(window.COLLECTIONS?.TRANSACTIONS || 'transactions').add({
                    userId:    escrowData.sellerId,
                    type:      'credit',
                    amount:    sellerNet,
                    fee,
                    orderId,
                    note:      'إطلاق دفع بعد تأكيد الاستلام',
                    createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                });

                // Record platform commission
                if (window.db && window.COLLECTIONS?.PLATFORM_REVENUE) {
                    await window.db.collection(window.COLLECTIONS.PLATFORM_REVENUE).add({
                        source:    'commission',
                        orderId,
                        sellerId:  escrowData.sellerId,
                        buyerId:   escrowData.buyerId,
                        amount:    fee,
                        orderTotal: escrowData.amount,
                        createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });
                }

                // Update order to completed
                await window.db.collection(window.COLLECTIONS?.ORDERS || 'orders')
                    .doc(orderId).update({
                        status:       'completed',
                        escrowStatus:  STATUS.RELEASED,
                        completedAt:   window.serverTimestamp ? window.serverTimestamp() : new Date(),
                        updatedAt:     window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });

                this._notify(escrowData.sellerId, 'paymentReceived',
                    `تم استلام مدفوعاتك! الصافي: ${sellerNet} ج.م`);
                window.showToast && window.showToast(window.t('escrowReleased'), 'success');
                return true;
            } catch (e) {
                console.error('[Escrow] releasePayment error:', e.message);
                window.showToast && window.showToast('حدث خطأ أثناء إطلاق الدفع', 'error');
                return false;
            }
        },

        // ── DISPUTE: buyer or seller opens a dispute ─────────────────────────
        async openDispute(orderId, userId, reason, description) {
            if (!window.db) return false;
            try {
                await window.db.collection('disputes').add({
                    orderId, userId, reason, description,
                    status:    'open',
                    createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    resolvedAt: null,
                    resolution: null,
                    adminNotes: '',
                });

                await window.db.collection(window.COLLECTIONS?.ORDERS || 'orders')
                    .doc(orderId).update({
                        status:       'disputed',
                        escrowStatus:  STATUS.DISPUTED,
                        disputeAt:     window.serverTimestamp ? window.serverTimestamp() : new Date(),
                        updatedAt:     window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });

                // Update escrow record
                const snap = await window.db.collection(window.COLLECTIONS?.PAYMENTS || 'payments')
                    .where('orderId', '==', orderId).limit(1).get();
                if (!snap.empty) {
                    await snap.docs[0].ref.update({ status: STATUS.DISPUTED });
                }

                window.showToast && window.showToast(window.t('disputeOpened'), 'warning');
                return true;
            } catch (e) {
                console.error('[Escrow] openDispute error:', e.message);
                return false;
            }
        },

        // ── REFUND: admin or auto-refund to buyer ────────────────────────────
        async refundBuyer(orderId, adminNote = '') {
            if (!window.db) return false;
            try {
                const snap = await window.db.collection(window.COLLECTIONS?.PAYMENTS || 'payments')
                    .where('orderId', '==', orderId).limit(1).get();
                if (snap.empty) throw new Error('No escrow record');

                const escrowData = snap.docs[0].data();
                await snap.docs[0].ref.update({
                    status:     STATUS.REFUNDED,
                    refundedAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    adminNote,
                });

                await window.db.collection(window.COLLECTIONS?.ORDERS || 'orders')
                    .doc(orderId).update({
                        status:       'refunded',
                        escrowStatus:  STATUS.REFUNDED,
                        updatedAt:     window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });

                // Credit buyer wallet for refund
                const buyerWalletRef = window.db.collection(window.COLLECTIONS?.WALLET || 'wallets')
                    .doc(escrowData.buyerId);
                const buyerWallet = await buyerWalletRef.get();
                if (buyerWallet.exists) {
                    await buyerWalletRef.update({
                        balance:  window.increment ? window.increment(escrowData.amount) : escrowData.amount,
                        updatedAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });
                } else {
                    await buyerWalletRef.set({
                        userId:  escrowData.buyerId, balance: escrowData.amount,
                        pending: 0, totalEarned: 0,
                        createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                        updatedAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
                    });
                }

                this._notify(escrowData.buyerId, 'paymentReceived',
                    `تم استرجاع ${escrowData.amount} ج.م لمحفظتك`);
                window.showToast && window.showToast(window.t('escrowRefunded'), 'success');
                return true;
            } catch (e) {
                console.error('[Escrow] refundBuyer error:', e.message);
                return false;
            }
        },

        // ── AUTO-RELEASE: 7 days after delivery with no action ───────────────
        async checkAutoRelease() {
            if (!window.db) return;
            try {
                const cutoff = new Date(Date.now() - 7 * 86400000);
                const snap = await window.db.collection(window.COLLECTIONS?.ORDERS || 'orders')
                    .where('status', '==', 'delivered')
                    .where('deliveredAt', '<=', cutoff)
                    .get();
                for (const doc of snap.docs) {
                    console.log('[Escrow] Auto-releasing order:', doc.id);
                    await this.releasePayment(doc.id);
                }
            } catch (e) {
                console.warn('[Escrow] checkAutoRelease error:', e.message);
            }
        },

        // ── SHOW DISPUTE MODAL ────────────────────────────────────────────────
        showDisputeModal(orderId, userId) {
            document.getElementById('_disputeModal')?.remove();
            const reasons = [
                { key: 'NOT_DELIVERED',    ar: 'لم يتم التسليم',  en: 'Not Delivered' },
                { key: 'POOR_QUALITY',     ar: 'جودة سيئة',       en: 'Poor Quality' },
                { key: 'NOT_AS_DESCRIBED', ar: 'لا يطابق الوصف', en: 'Not As Described' },
                { key: 'LATE_DELIVERY',    ar: 'تأخر التسليم',   en: 'Late Delivery' },
                { key: 'FRAUD',            ar: 'احتيال',          en: 'Fraud' },
            ];
            const modal = document.createElement('div');
            modal.id = '_disputeModal';
            modal.className = 'fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
                            <i class="fa-solid fa-flag text-red-600 text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-gray-900">${window.t('openDispute')}</h3>
                            <p class="text-sm text-gray-500">طلب #${orderId.substring(0,8).toUpperCase()}</p>
                        </div>
                    </div>
                    <div class="space-y-3 mb-4">
                        ${reasons.map(r => `
                        <label class="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-red-400 transition">
                            <input type="radio" name="_disputeReason" value="${r.key}" class="w-4 h-4 text-red-600">
                            <span class="font-semibold text-gray-800">${r.ar}</span>
                        </label>`).join('')}
                    </div>
                    <textarea id="_disputeDesc" placeholder="أضف تفاصيل إضافية..." rows="3"
                        class="w-full p-4 border-2 border-gray-200 rounded-xl text-sm resize-none focus:border-red-400 focus:outline-none mb-4"></textarea>
                    <div class="flex gap-3">
                        <button onclick="document.getElementById('_disputeModal').remove()"
                            class="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50">
                            ${window.t('cancel')}
                        </button>
                        <button onclick="window.EscrowSystem._submitDispute('${orderId}','${userId}')"
                            class="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition">
                            ${window.t('openDispute')}
                        </button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        },

        _submitDispute(orderId, userId) {
            const reason = document.querySelector('input[name="_disputeReason"]:checked')?.value;
            const desc   = document.getElementById('_disputeDesc')?.value || '';
            if (!reason) { window.showToast && window.showToast('اختر سبب النزاع', 'warning'); return; }
            this.openDispute(orderId, userId, reason, desc).then(() => {
                document.getElementById('_disputeModal')?.remove();
            });
        },

        _notify(userId, type, message) {
            if (!window.db || !userId) return;
            window.db.collection(window.COLLECTIONS?.NOTIFICATIONS || 'notifications').add({
                userId, type, message, read: false,
                createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
            }).catch(() => {});
        },
    };

    window.EscrowSystem = EscrowSystem;
    console.log('✅ Escrow System v4.0 ready');
})();
