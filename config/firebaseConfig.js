const admin = require('firebase-admin');
// const retry = require('retry'); // ❌ Removed
// const operation = retry.operation(); // ❌ Removed
const { decryptedData } = require('../utils/decryptUtils');

let initializedApp = null;

const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
};

// =================================================================
// 🚀 Firebase Initialization Logic
// =================================================================

try {
  const decryptedServiceAccount = {};

  // Loop through the service account fields and decrypt each field
  for (const key in serviceAccount) {
    if (serviceAccount.hasOwnProperty(key)) {
      const encryptedValue = serviceAccount[key];
      let decryptedValue;

      if (!encryptedValue) {
         // यदि Env Var missing है (और डिक्रिप्शन की आवश्यकता नहीं है)
         decryptedValue = encryptedValue;

      } else if (encryptedValue === process.env.SECRET_KEY) {
        // Case 1 → Exact match → No decrypt
        decryptedValue = encryptedValue;

      } else if (typeof encryptedValue === "string" && encryptedValue.includes("-----BEGIN PRIVATE KEY-----")) {
        // Case 2 → Private Key → No decrypt (यदि आपने इसे एन्क्रिप्ट नहीं किया है)
        // यदि आपने इसे एन्क्रिप्ट किया है, तो इस क्लॉज़ को हटाएँ और इसे डिक्रिप्ट होने दें
        decryptedValue = encryptedValue;

      } else {
        // Case 3 → Normal encryption → decrypt
        // यह यहाँ विफलता का मुख्य बिंदु है (Malformed UTF-8 data)
        decryptedValue = decryptedData(encryptedValue);
      }

      // Store the decrypted value
      decryptedServiceAccount[key] = decryptedValue;
    }
  }

  // सुनिश्चित करें कि ऐप पहले से ही initialized न हो
  if (!admin.apps.length) {
    initializedApp = admin.initializeApp({
      credential: admin.credential.cert(decryptedServiceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } else {
    // यदि यह पहले से initialized है (जैसे nodemon restarts पर)
    initializedApp = admin.app(); 
  }

} catch (err) {
  console.error('FATAL ERROR: Firebase Initialization Failed due to Decryption/Missing Key.', err);
  // Initialization विफल होने पर, हम किसी भी firebase export को रोकने के लिए throw करते हैं।
  throw err; 
}


// =================================================================
// Export Firebase services (केवल Initialization सफल होने पर)
// =================================================================

// यह db और auth तभी प्राप्त करेगा जब initializedApp सफलतापूर्वक सेट हो गया हो।
const db = initializedApp.database();
const auth = initializedApp.auth();

// Function to set custom user claims
const setUserRole = async (uid, role, subrole, referredBy) => {
  try {
    await auth.setCustomUserClaims(uid, { role, subrole, referredBy });
    console.log(`Role ${role} and subrole ${subrole} set for user with UID: ${uid}`);
  } catch (error) {
    console.error("Error setting custom claims:", error);
  }
};


const getFlatmateUserByEmail = async (email) => {
  if (!email) return null;

  const searchEmail = email.trim().toLowerCase();
  const usersRef = db.ref('/flatmate/users');
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


module.exports = { db, auth, setUserRole, getFlatmateUserByEmail };