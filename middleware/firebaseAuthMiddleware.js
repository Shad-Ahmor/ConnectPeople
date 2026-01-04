const admin = require('firebase-admin');
const { getFirebaseInstance } = require('../config/firebaseConfig.js'); // Aapki config file jahan getFirebaseInstance hai

const verifyToken = async (req, res, next) => {
  try {
    // 💡 DYNAMIC COOKIE NAME FIX
    const appName = req.query.appName || req.body.appName || 'flatmate';
    const dynamicCookieName = appName === 'flatmate' ? 'flatmate_session' : `${appName}_session`;
    
    const sessionCookie = req.cookies?.[dynamicCookieName]; // Hardcoded 'session' ki jagah dynamic use kiya

    if (!sessionCookie) {
      return res.status(401).json({ success: false, message: 'No session cookie found' });
    }

    const { auth } = getFirebaseInstance(appName);

    // ✅ Verify session cookie
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);    
    req.user = {
      uid: decodedClaims.uid,
      ...decodedClaims
    };
    
    req.userId = decodedClaims.uid;
    req.userClaims = decodedClaims;
    req.appName = appName;

    next();
  } catch (error) {
    console.error('Session verification failed:', error);
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
};

module.exports = { verifyToken };