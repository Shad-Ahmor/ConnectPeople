// authMiddleware.js

exports.requireLogin = (req, res, next) => {
  // 🚩 MODIFIED: Logging both potential keys for better debugging
  console.log("Checking session.userId:", req.session.userId);
  console.log("Checking session.flatmateUid:", req.session.flatmateUid);
  
  // 🚩 MODIFIED: Check for the Firebase UID in the primary key (userId) 
  // or the secondary key (flatmateUid) as a fallback.
  // The goal is to get the actual UID of the logged-in user.
  const userId = req.session.userId || req.session.flatmateUid;

  if (userId) {
    // 🚩 OPTIONAL: For convenience in downstream controllers, you can ensure 
    // that req.userId is set to the validated UID.
    req.userId = userId; 
    
    // Log success and continue
    console.log(`Authentication success. User ID: ${userId}`);
    return next();
  }

  // Log failure
  console.log("Authentication failed. No valid UID found in session.");
  return res.status(401).json({
    message: "Authentication required. Please log in.",
    code: "UNAUTHORIZED"
  });
};