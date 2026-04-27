/**
 * ============================================================================
 * FIREBASE CONFIG — MALL SERVICES PLATFORM v3.0.0
 * ============================================================================
 */
(function () {
    'use strict';

    const FIREBASE_CONFIG = {
        apiKey:            "AIzaSyAYb-gZoqWJThi6rGq95xS3u1rwNwpDBDs",
        authDomain:        "mall-services.firebaseapp.com",
        projectId:         "mall-services",
        storageBucket:     "mall-services.firebasestorage.app",
        messagingSenderId: "280984677297",
        appId:             "1:280984677297:web:d30012363c6a627147ab90",
        measurementId:     "G-0MVBGG1VFW"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
    }

    const auth           = firebase.auth();
    const db             = firebase.firestore();
    const storage        = firebase.storage();
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    let   analytics      = null;

    try { analytics = firebase.analytics(); }
    catch (e) { console.warn('[Firebase] Analytics:', e.message); }

    // Modern Firestore cache — replaces deprecated enablePersistence
    const _enableCache = () => {
        db.enableMultiTabIndexedDbPersistence()
          .catch(err => {
              if (err.code === 'failed-precondition') {
                  db.enablePersistence({ synchronizeTabs: false }).catch(() => {});
              }
              // 'unimplemented' = browser doesn't support it, silent ignore
          });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _enableCache);
    } else {
        _enableCache();
    }

    window.auth           = auth;
    window.db             = db;
    window.storage        = storage;
    window.firebase       = firebase;
    window.googleProvider = googleProvider;
    window.analytics      = analytics;

    console.log('✅ Firebase v3.0.0 initialized');
})();
