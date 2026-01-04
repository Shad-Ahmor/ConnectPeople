const admin = require('firebase-admin');
const { getFirebaseInstance } = require('../config/firebaseConfig.js');

const verifyToken = async (req, res, next) => {
  try {
    // 💡 Logic: Login controller 'flatmate_session' set kar raha hai
    const appName = req.query.appName || req.body.appName || 'flatmate';
    const dynamicCookieName = appName === 'flatmate' ? 'flatmate_session' : `${appName}_session`;
    
    const sessionCookie = req.cookies?.[dynamicCookieName];

    if (!sessionCookie) {
      console.log(`❌ Auth Failed: ${dynamicCookieName} not found in cookies.`);
      return res.status(401).json({ success: false, message: 'No session cookie found' });
    }

    const { auth } = getFirebaseInstance(appName);

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
    console.error('Session verification failed:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
};

module.exports = { verifyToken };