// controllers/trustSessionController.js
const { auth, db } = require('../config/firebaseConfig');

/**
 * 🔐 TRUST SESSION CONTROLLER
 * Purpose:
 * - Verify Firebase ID token
 * - Establish server-side trust
 * - Optional: set secure cookie / audit log
 */
exports.trustSession = async (req, res) => {
  try {
    // 1️⃣ Read Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Missing or invalid Authorization header',
      });
    }

    // 2️⃣ Extract Firebase ID token
    const idToken = authHeader.split(' ')[1];

    // 3️⃣ Verify token with Firebase Admin (FAST)
    const decodedToken = await auth.verifyIdToken(idToken);

    const uid = decodedToken.uid;
    const email = decodedToken.email || null;

    // 4️⃣ (OPTIONAL) Fetch role from DB (lightweight read)
    let role = decodedToken.role || 'Tenant';

    try {
      const snapshot = await db
        .ref(`/flatmate/users/${uid}/role`)
        .once('value');

      if (snapshot.exists()) {
        role = snapshot.val();
      }
    } catch (_) {
      // ❌ DB error should NOT break login
    }

    // 5️⃣ (OPTIONAL) Set secure httpOnly cookie
    res.setCookie('flatmate_session', uid, {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    // 6️⃣ Respond FAST
    return res.status(200).json({
      success: true,
      trusted: true,
      uid,
      role,
    });

  } catch (error) {
    console.error('Trust session failed:', error.message);

    return res.status(401).json({
      success: false,
      trusted: false,
      message: 'Invalid or expired token',
    });
  }
};
