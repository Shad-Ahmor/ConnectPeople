const express = require('express');
const router = express.Router();

const {
  flatmateSignup,
  sendOtp,
  verifyOtp,
  flatmateLogin,
  flatmateForgotPassword,
  flatmateCompleteProfile,
  flatmateLogout,
  getCurrentUser,
  googleSSOCallback
} = require("../controllers/flatmateAuthController.js");

const { 
    flatmateListing,
    fetchAllListings,     
    fetchSingleListing,   
    fetchUserListings,    
    updateListing,        
    deleteListing         
} = require("../controllers/flatmateListingController.js");

const firebaseAuthMiddleware = require('../services/firebaseAuthMiddleware');
const rateLimit = require("express-rate-limit"); //To stop brute-force or account-creation bots at Login/Signup/OTP endpoints 


const {
  trustSession,
} = require('../controllers/trustSessionController');


const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 मिनट में प्रत्येक IP से अधिकतम 5 अनुरोध (requests)
    message: "Too many login/signup/OTP attempts. Try again in 5 minutes.",
});

// Parse JSON and URL-encoded payloads
router.use(express.urlencoded({ extended: true }));
router.use(express.json());


router.post('/trust-session', trustSession);

// ------------------------
// Public Auth Routes
// ------------------------
router.post("/signup",authLimiter, flatmateSignup);
router.post("/send-otp", authLimiter,sendOtp); 
router.post("/verify-otp",authLimiter, verifyOtp);
router.post("/complete-profile",authLimiter, flatmateCompleteProfile);
router.post("/login",authLimiter, flatmateLogin);
router.get("/google/callback", googleSSOCallback);
router.post("/logout",authLimiter, flatmateLogout);
router.post("/forgot-password",authLimiter, flatmateForgotPassword);

// ----------------------------------------------------
// 🔐 Protected Routes (Auth & Listing Management)
// ----------------------------------------------------

// 1. ✅ FIX: यूज़र की अपनी सभी लिस्टिंग्स फेच करें (MyListingsScreen के लिए)
// यह विशिष्ट राउट है, इसे डायनामिक राउट से पहले होना चाहिए।
router.get("/listing/my-listings", firebaseAuthMiddleware.verifyToken, fetchUserListings);

// नई लिस्टिंग पोस्ट करें
router.post("/listing", firebaseAuthMiddleware.verifyToken, flatmateListing);

// ------------------------------------
// 🏠 Public Listing Routes (Read-only)
// ------------------------------------
// सभी लिस्टिंग्स को फेच करें (होमस्क्रीन के लिए)
router.post("/listing/all", fetchAllListings);
// यह डायनामिक राउट अब my-listings के बाद आता है।
router.get("/listing/:listingId", fetchSingleListing);

// ----------------------------------------------------
// 🔐 Remaining Protected Routes
// ----------------------------------------------------
// लिस्टिंग को अपडेट करें
router.put("/listing/update/:listingId", firebaseAuthMiddleware.verifyToken, updateListing);
// लिस्टिंग को डिलीट करें
router.delete("/listing/delete/:listingId", firebaseAuthMiddleware.verifyToken, deleteListing);
// ------------------------
// Protected User Auth Routes
// ------------------------
router.get("/me", firebaseAuthMiddleware.verifyToken, getCurrentUser);


module.exports = router;