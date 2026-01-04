const express = require('express');
const router = express.Router();

const {
  flatmateSignup,
  sendOtp,
  verifyOtp,
  flatmateLogin,
  flatmateForgotPassword,
  flatmateVerifyAndResetPassword,
  flatmateCompleteProfile,
  flatmateLogout,
  getCurrentUser,
  updateFlatmateProfile,
  getFlatmateProfile,
  googleSSOCallback
} = require("../controllers/flatmateAuthController.js");


const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware.js');
const rateLimit = require("express-rate-limit"); //To stop brute-force or account-creation bots at Login/Signup/OTP endpoints 

const firewall = require("../middleware/firewall.js");
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
router.post("/send-otp", authLimiter, firewall, sendOtp);
router.post("/verify-otp",authLimiter, verifyOtp);
router.post("/complete-profile",authLimiter, flatmateCompleteProfile);
router.post("/login",authLimiter, flatmateLogin);
router.get("/google/callback", googleSSOCallback);
router.post("/logout",authLimiter, flatmateLogout);
router.post("/forgot-password", authLimiter, firewall, flatmateForgotPassword);
router.post(
    "/verify-reset-password", 
    firewall, 
    flatmateVerifyAndResetPassword
);
router.get("/me", firebaseAuthMiddleware.verifyToken, getCurrentUser);
router.get("/profile/:uid", firebaseAuthMiddleware.verifyToken, getFlatmateProfile);
router.patch("/profile/update", firebaseAuthMiddleware.verifyToken, updateFlatmateProfile);

module.exports = router;