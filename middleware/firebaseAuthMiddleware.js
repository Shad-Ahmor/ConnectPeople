const admin = require('firebase-admin');
const { getFirebaseInstance } = require('../config/firebaseConfig.js');

const verifyToken = async (req, res, next) => {
  try {
    // 💡 IMPROVED: appName ko Headers se bhi check karein (Frontend safety ke liye)
    const appName = 
      req.query.appName || 
      req.body.appName || 
      req.headers['x-app-name'] || // Custom header backup
      'flatmate';

    const dynamicCookieName = appName === 'flatmate' ? 'flatmate_session' : `${appName}_session`;
    
    const sessionCookie = req.cookies?.[dynamicCookieName];

    if (!sessionCookie) {
      // ⚠️ LOGGING: Production mein IP aur Path bhi dikhayein taaki debugging asaan ho
      console.log(`❌ Auth Failed: ${dynamicCookieName} missing for path: ${req.path}`);
      return res.status(401).json({ 
        success: false, 
        message: 'No session cookie found. Please log in again.' 
      });
    }

    const { auth } = getFirebaseInstance(appName);

    // Verify session cookie
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);    
    
    req.user = {
      uid: decodedClaims.uid,
      email: decodedClaims.email,
      ...decodedClaims
    };
    
    req.userId = decodedClaims.uid;
    req.userClaims = decodedClaims;
    req.appName = appName;

    next();
  } catch (error) {
    console.error('Session verification failed:', error.message);
    
    // Agar cookie expire ho gayi hai toh clear kar dena behtar hai
    return res.status(401).json({ 
      success: false, 
      message: error.code === 'auth/session-cookie-expired' ? 'Session expired' : 'Invalid session' 
    });
  }
};

module.exports = { verifyToken };