const admin = require('firebase-admin');

const verifyToken = async (req, res, next) => {
  try {
    const sessionCookie = req.cookies?.session;
    if (!sessionCookie) {
      return res.status(401).json({ success: false, message: 'No session cookie found' });
    }

    // ✅ Verify session cookie
    const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true); 
    req.userId = decodedClaims.uid;
    req.userClaims = decodedClaims;

    next();
  } catch (error) {
    console.error('Session verification failed:', error);
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
};

module.exports = { verifyToken };
