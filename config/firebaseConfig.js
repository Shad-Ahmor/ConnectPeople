const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Your Firebase service account JSON
const retry = require('retry');
const operation = retry.operation();
const {decryptedData} = require('../utils/decryptUtils')
// Initialize Firebase Admin SDK
operation.attempt(function(currentAttempt) {
  try {
   
      const decryptedServiceAccount = {};
  
      // Loop through the encrypted service account and decrypt each field
      for (const key in serviceAccount) {
        if (serviceAccount.hasOwnProperty(key)) {
          const encryptedValue = serviceAccount[key];
          let decryptedValue;

            if (encryptedValue === process.env.SECRET_KEY) {

              // Case 1 → Exact match → No decrypt
              decryptedValue = encryptedValue;

            } else if (typeof encryptedValue === "string" && encryptedValue.includes("-----BEGIN PRIVATE KEY-----")) {

              // Case 2 → Private Key → No decrypt
              decryptedValue = encryptedValue;

            } else {

              // Case 3 → Normal encryption → decrypt
              decryptedValue = decryptedData(encryptedValue);

            }

          
          // Store the decrypted value in the decryptedServiceAccount object
          decryptedServiceAccount[key] = decryptedValue;
        }
      }
  
admin.initializeApp({
  credential: admin.credential.cert(decryptedServiceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,  // Replace with your Firebase Realtime Database URL
});
console.log('Firebase Admin SDK initialized successfully.');
    
} catch (err) {
if (operation.retry(err)) {
  return;
}
   // If retries are exhausted, log the error
   console.error('Error initializing Firebase:', err);
  }
});
// Export Firebase services you need
const db = admin.database();  // Firebase Realtime Database instance
const auth = admin.auth();     // Firebase Authentication instance

// Function to set custom user claims (role assignment)
// const setUserRole = async (uid, role,subrole) => {
//   try {
//     // Set custom claims (e.g., role: admin)
//     await admin.auth().setCustomUserClaims(uid, { role },{subrole});
//     console.log(`Custom claims set for user UID: ${uid} with role: ${role} with ${subrole}`);
//   } catch (error) {
//     console.error('Error setting custom claims:', error);
//   }
// };

const setUserRole = async (uid, role, subrole,referredBy) => {
  try {
    // Set custom claims (role, subrole) for the user
    await admin.auth().setCustomUserClaims(uid, { role, subrole ,referredBy});
    console.log(`Role ${role} and subrole ${subrole} set for user with UID: ${uid}`);
  } catch (error) {
    console.error("Error setting custom claims:", error);
  }
};



const getFlatmateUserByEmail = async (email) => {
  if (!email) return null;

  const searchEmail = email.trim().toLowerCase();
  const usersRef = db.ref('/flatmate/users');
  const snapshot = await usersRef.once('value'); // get all users

  if (!snapshot.exists()) return null;

  const users = snapshot.val();

  for (const uid in users) {
    if (users[uid].email && users[uid].email.trim().toLowerCase() === searchEmail) {
      return { uid, data: users[uid] };
    }
  }

  return null;
};


module.exports = { db, auth, setUserRole,getFlatmateUserByEmail };
