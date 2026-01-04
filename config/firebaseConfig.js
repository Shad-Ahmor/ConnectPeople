const admin = require('firebase-admin');
const { decryptedData } = require('../utils/decryptUtils');

// Cache for initialized apps to prevent re-initialization
const apps = {};

// =================================================================
// 🚀 Dynamic Decryption & Config Fetcher
// =================================================================
const getDecryptedConfig = (envPrefix) => {
    // Agar prefix empty hai toh purani naming convention use hogi
    const prefix = envPrefix ? `${envPrefix.toUpperCase()}_` : "FLATMATE_";
    
    const serviceAccount = {
        type: process.env[`${prefix}FIREBASE_TYPE`] || process.env[`${prefix}TYPE`],
        project_id: process.env[`${prefix}FIREBASE_PROJECT_ID`] || process.env[`${prefix}PROJECT_ID`],
        private_key_id: process.env[`${prefix}FIREBASE_PRIVATE_KEY_ID`] || process.env[`${prefix}PRIVATE_KEY_ID`],
        private_key: process.env[`${prefix}FIREBASE_PRIVATE_KEY`] || process.env[`${prefix}PRIVATE_KEY`],
        client_email: process.env[`${prefix}FIREBASE_CLIENT_EMAIL`] || process.env[`${prefix}CLIENT_EMAIL`],
        client_id: process.env[`${prefix}FIREBASE_CLIENT_ID`] || process.env[`${prefix}CLIENT_ID`],
        auth_uri: process.env[`${prefix}FIREBASE_AUTH_URI`] || process.env[`${prefix}AUTH_URI`],
        token_uri: process.env[`${prefix}FIREBASE_TOKEN_URI`] || process.env[`${prefix}TOKEN_URI`],
        auth_provider_x509_cert_url: process.env[`${prefix}FIREBASE_AUTH_PROVIDER_X509_CERT_URL`] || process.env[`${prefix}AUTH_PROVIDER_X509_CERT_URL`],
        client_x509_cert_url: process.env[`${prefix}FIREBASE_CLIENT_X509_CERT_URL`] || process.env[`${prefix}CLIENT_X509_CERT_URL`],
        universe_domain: process.env[`${prefix}FIREBASE_UNIVERSE_DOMAIN`] || process.env[`${prefix}UNIVERSE_DOMAIN`],
    };

    const decryptedServiceAccount = {};

    for (const key in serviceAccount) {
        if (serviceAccount.hasOwnProperty(key)) {
            const val = serviceAccount[key];
            
            if (!val) {
                decryptedServiceAccount[key] = val;
            } else if (val === process.env.SECRET_KEY || val.includes("-----BEGIN PRIVATE KEY-----")) {
                // No decryption for raw keys
                decryptedServiceAccount[key] = val.replace(/\\n/g, '\n');
            } else {
                // Try decryption
                try {
                    decryptedServiceAccount[key] = decryptedData(val).replace(/\\n/g, '\n');
                } catch (err) {
                    // Fallback if already decrypted or malformed
                    decryptedServiceAccount[key] = val.replace(/\\n/g, '\n');
                }
            }
        }
    }
    return decryptedServiceAccount;
};

// =================================================================
// 🚀 Multi-App Instance Getter
// =================================================================
const getFirebaseInstance = (appName = 'flatmate') => {
    const name = appName.toLowerCase();

    // 1. Return existing instance if available
    if (apps[name]) return apps[name];

    try {
        // Dating app ke liye prefix DATING_ rakhein, Flatmate ke liye empty/FLATMATE_
        const prefix = name === 'flatmate' ? 'FLATMATE' : name.toUpperCase();
        const config = getDecryptedConfig(prefix);
        
        if (!config.project_id) {
            throw new Error(`Project ID missing for app: ${name}. Check ${prefix}_PROJECT_ID in .env`);
        }

        const dbURL = process.env[`${prefix}_DATABASE_URL`] || process.env.FIREBASE_DATABASE_URL;

        const app = admin.initializeApp({
            credential: admin.credential.cert(config),
            databaseURL: dbURL,
        }, name); // Unique name for each app instance

        apps[name] = {
            db: app.database(),
            auth: app.auth(),
            admin: admin
        };

        console.log(`🔥 Firebase Admin [${name}] initialized successfully.`);
        return apps[name];
    } catch (err) {
        console.error(`❌ Firebase Initialization Failed for [${name}]:`, err.message);
        throw err;
    }
};

// =================================================================
// 🚀 Helper Functions (Updated for Multi-App)
// =================================================================

const setUserRole = async (uid, role, subrole, referredBy, appName = 'flatmate') => {
    try {
        const { auth } = getFirebaseInstance(appName);
        await auth.setCustomUserClaims(uid, { role, subrole, referredBy });
        console.log(`Role ${role} set in ${appName} for UID: ${uid}`);
    } catch (error) {
        console.error(`Error setting custom claims in ${appName}:`, error);
    }
};

const getFlatmateUserByEmail = async (email, appName = 'flatmate') => {
    if (!email) return null;
    const { db } = getFirebaseInstance(appName);

    const searchEmail = email.trim().toLowerCase();
    // Path dynamic rakha hai, dating app ke liye '/dating/users' bhi ho sakta hai
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;
    const usersRef = db.ref(`/${rootNode}/users`);
    
    const snapshot = await usersRef.once('value');
    if (!snapshot.exists()) return null;

    const users = snapshot.val();
    for (const uid in users) {
        if (users[uid].email && users[uid].email.trim().toLowerCase() === searchEmail) {
            return { uid, data: users[uid] };
        }
    }
    return null;
};

// =================================================================
// 🚀 Exports (Backward Compatibility Maintained)
// =================================================================

// Initialize default app (flatmate) instantly for legacy code
const defaultInstance = getFirebaseInstance('flatmate');

module.exports = { 
    getFirebaseInstance, 
    db: defaultInstance.db, 
    auth: defaultInstance.auth, 
    setUserRole, 
    getFlatmateUserByEmail 
};