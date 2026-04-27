/**
 * ============================================================================
 * ESCROW SYSTEM v4.0.0 — Payment Hold & Buyer Protection
 * نظام الحجز — حماية المشتري والبائع
 * ============================================================================
 * ✅ Payment Hold until delivery
 * ✅ Dispute Management
 * ✅ Refund System
 * ✅ Production Ready
 * ============================================================================
 */
(function () {
    'use strict';

    const EscrowSystem = {
        // Payment hold states
        STATES: {
            HELD:      'held',
            RELEASED:  'released',
            DISPUTED:  'disputed',
            REFUNDED:  'refunded',
        },

        /**
         * Hold payment until buyer confirms delivery
         */
        async holdPayment(orderId, amount, buyerId, sellerId, paymentId, metadata = {}) {
            try {
                if (!window.db) {
                    console.warn('[Escrow] Firestore not available, skipping hold');
                    return { success: false, message: 'Database unavailable' };
                }

                const escrowData = {
                    orderId,
                    amount: parseFloat(amount) || 0,
                    buyerId,
                    sellerId,
                    paymentId,
                    status: this.STATES.HELD,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    metadata: metadata || {},
                    releasedAt: null,
                    refundedAt: null,
                };

                const result = await window.db.collection('escrow').add(escrowData);
                console.log(`✅ Payment held: ${orderId}`);
                return { success: true, escrowId: result.id };
            } catch (e) {
                console.error('[Escrow] Hold error:', e);
                return { success: false, message: e.message };
            }
        },

        /**
         * Release payment to seller after buyer confirms
         */
        async releasePayment(orderId, notes = '') {
            try {
                if (!window.db) return { success: false, message: 'Database unavailable' };

                const query = await window.db.collection('escrow')
                    .where('orderId', '==', orderId)
                    .where('status', '==', this.STATES.HELD)
                    .get();

                if (query.empty) {
                    return { success: false, message: 'No held payment found' };
                }

                const doc = query.docs[0];
                const escrowData = doc.data();

                // Release to seller
                await doc.ref.update({
                    status: this.STATES.RELEASED,
                    releasedAt: new Date(),
                    updatedAt: new Date(),
                    releaseNotes: notes,
                });

                // Add to seller balance
                if (escrowData.sellerId) {
                    await this._addSellerBalance(escrowData.sellerId, escrowData.amount);
                }

                console.log(`✅ Payment released: ${orderId} → ${escrowData.sellerId}`);
                return { success: true, amount: escrowData.amount };
            } catch (e) {
                console.error('[Escrow] Release error:', e);
                return { success: false, message: e.message };
            }
        },

        /**
         * Dispute a payment
         */
        async raiseDispute(orderId, reason, evidence = {}) {
            try {
                if (!window.db) return { success: false, message: 'Database unavailable' };

                const query = await window.db.collection('escrow')
                    .where('orderId', '==', orderId)
                    .where('status', 'in', [this.STATES.HELD, this.STATES.RELEASED])
                    .get();

                if (query.empty) {
                    return { success: false, message: 'Payment not found' };
                }

                const doc = query.docs[0];
                const escrowData = doc.data();

                // Create dispute
                const disputeRef = await window.db.collection('disputes').add({
                    escrowId: doc.id,
                    orderId,
                    buyerId: escrowData.buyerId,
                    sellerId: escrowData.sellerId,
                    reason,
                    evidence: evidence || {},
                    status: 'open',
                    amount: escrowData.amount,
                    createdAt: new Date(),
                    resolvedAt: null,
                    resolution: null,
                });

                // Update escrow status
                await doc.ref.update({
                    status: this.STATES.DISPUTED,
                    updatedAt: new Date(),
                    disputeId: disputeRef.id,
                });

                console.log(`⚠️ Dispute raised: ${orderId}`);
                return { success: true, disputeId: disputeRef.id };
            } catch (e) {
                console.error('[Escrow] Dispute error:', e);
                return { success: false, message: e.message };
            }
        },

        /**
         * Refund to buyer
         */
        async refund(orderId, reason = '') {
            try {
                if (!window.db) return { success: false, message: 'Database unavailable' };

                const query = await window.db.collection('escrow')
                    .where('orderId', '==', orderId)
                    .get();

                if (query.empty) {
                    return { success: false, message: 'Payment not found' };
                }

                const doc = query.docs[0];
                const escrowData = doc.data();

                // Refund to buyer wallet
                if (escrowData.buyerId) {
                    await this._addBuyerBalance(escrowData.buyerId, escrowData.amount);
                }

                // Update escrow
                await doc.ref.update({
                    status: this.STATES.REFUNDED,
                    refundedAt: new Date(),
                    updatedAt: new Date(),
                    refundReason: reason,
                });

                console.log(`♻️ Refund processed: ${orderId} → ${escrowData.buyerId}`);
                return { success: true, amount: escrowData.amount };
            } catch (e) {
                console.error('[Escrow] Refund error:', e);
                return { success: false, message: e.message };
            }
        },

        /**
         * Get escrow status
         */
        async getStatus(orderId) {
            try {
                if (!window.db) return null;

                const query = await window.db.collection('escrow')
                    .where('orderId', '==', orderId)
                    .get();

                if (query.empty) return null;
                return query.docs[0].data();
            } catch (e) {
                console.error('[Escrow] Status error:', e);
                return null;
            }
        },

        // ── PRIVATE HELPERS ──────────────────────────────────────────────────
        async _addSellerBalance(sellerId, amount) {
            try {
                if (!window.db) return;
                const ref = window.db.collection('users').doc(sellerId);
                await ref.update({
                    'wallet.earnings': window.firebase.firestore.FieldValue.increment(parseFloat(amount)),
                    'wallet.balance': window.firebase.firestore.FieldValue.increment(parseFloat(amount)),
                });
            } catch (e) {
                console.warn('[Escrow] Balance update failed:', e.message);
            }
        },

        async _addBuyerBalance(buyerId, amount) {
            try {
                if (!window.db) return;
                const ref = window.db.collection('users').doc(buyerId);
                await ref.update({
                    'wallet.balance': window.firebase.firestore.FieldValue.increment(parseFloat(amount)),
                });
            } catch (e) {
                console.warn('[Escrow] Balance update failed:', e.message);
            }
        },
    };

    window.EscrowSystem = EscrowSystem;
    console.log('✅ Escrow System v4.0.0 ready');
})();
