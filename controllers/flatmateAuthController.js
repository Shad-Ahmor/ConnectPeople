// flatmateAuthController.js

const firebaseAdmin = require('firebase-admin');
const { auth, db, getFlatmateUserByEmail } = require('../config/firebaseConfig.js');
const sendEmail = require("../mailer.js");
const { resetPasswordTemplate } = require("../templates/resetPasswordTemplate.js");
const flatmateUserService = require('../services/flatmateUserService.js'); 
const axios = require('axios');
const { sendOtpEmail, validateOtp } = require('../services/flatmateUserService.js'); // New imports


const sanitizeString = (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim(); 
};
// ----------------------------------------------------------
// 🟢 flatmateSignup (CONTROLLER)
// ----------------------------------------------------------
exports.sendOtp = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required." });
    }

    try {
        // 1. Check if user already exists using the RTDB function.
        // 💡 This function returns null if the user is not found, avoiding the 'auth/user-not-found' error.
        const senetizeemail=sanitizeString(email)
        const existingUser = await getFlatmateUserByEmail(senetizeemail); 

        if (existingUser) {
             // User found in RTDB -> return 409 Conflict
             return res.status(409).json({ message: 'User already exists with this email. Please login.' });
        }
        
        // 2. Generate, Store, and Send OTP Email (Flow continues only if user is new)
        const result = await sendOtpEmail(email);

        if (result.success) {
            return res.status(200).json({ message: 'Verification code sent to email successfully.', email });
        } else {
            return res.status(500).json({ message: 'Failed to send verification email. Please check the email address and try again.' });
        }
    } catch (error) {
        console.error("❌ Error in sendOtp:", error);
        res.status(500).json({ message: 'Server error while sending OTP.', error: error.message });
    }
};

// -----------------------------------------------------------------
// 💡 ENDPOINT 2: Verify OTP (Step 2) - Unchanged, Already Correct
// -----------------------------------------------------------------
exports.verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required." });
    }

    try {
        const validationResult = await validateOtp(email, otp);

        if (validationResult.success) {
            return res.status(200).json({ message: "OTP verified successfully. Proceed to final setup." });
        } else {
            // 401 Unauthorized for invalid/expired OTP
            return res.status(401).json({ message: validationResult.message });
        }
    } catch (error) {
        console.error("❌ Error in verifyOtp:", error);
        res.status(500).json({ message: 'Server error during OTP verification.', error: error.message });
    }
};
// --- MODIFIED ENDPOINT 3: flatmateSignup (Final Step) ---
exports.flatmateSignup = async (req, res) => {
    const signupData = req.body;

    // ✅ NEW CHECK: Ensure the client state reflects that email verification passed.
    // The client should send { email, username, password, isEmailVerified: true }
    if (!signupData.isEmailVerified) {
        return res.status(403).json({ message: 'Email must be verified before finalizing registration. Please go back to Step 1.' });
    }
    
    // The rest of the logic remains the same.
    try {
        const { uid, userData, customToken } = await flatmateUserService.createFlatmateUser(signupData);
        
        // ... (existing cookie setting logic)
        res.cookie('token', customToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict', 
            maxAge: 60 * 60 * 1000, // 1 hour
        });

        res.status(201).json({
            // Changed message and next_step to reflect successful final signup
            message: 'Registration successful. Redirecting to Login.', 
            next_step: 'login', 
            user: { email: userData.email, uid, name: userData.name },
        });

    } catch (error) {
        // ... (existing error handling)
        if (error.message.includes("is required")) {
            return res.status(400).json({ message: error.message });
        }
        if (error.code === 'auth/email-already-exists') {
            return res.status(409).json({ message: 'User already exists with this email' });
        }
        if (error.code === 'auth/weak-password') {
            return res.status(400).json({ message: 'Password is too weak (min 6 characters)' });
        }
        if (error.code === 'auth/invalid-email') {
            return res.status(400).json({ message: 'Invalid email address' });
        }
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
};
// ----------------------------------------------------------
// 🟢 flatmateCompleteProfile (CONTROLLER)
// ----------------------------------------------------------
exports.flatmateCompleteProfile = async (req, res) => {
    // ✅ Get UID from token cookie instead of session
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Unauthorized. No token found." });

    let uid;
    try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(token);
        uid = decoded.uid;
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token." });
    }

    const profileData = req.body;

    try {
        const updatedProfile = await flatmateUserService.completeFlatmateProfile(uid, profileData);
        res.status(200).json({
            message: 'Profile completed successfully!',
            user: updatedProfile,
        });
    } catch (error) {
        if (error.message.includes("is required")) {
            return res.status(400).json({ message: error.message });
        }
        console.error("Error completing profile:", error);
        res.status(500).json({ message: 'Failed to complete profile due to a server error.', error: error.message });
    }
};


// ----------------------------------------------------------
// 🟢 flatmateLogin (CONTROLLER)
// // ----------------------------------------------------------

const COOKIE_NAME = 'session';
const SESSION_EXPIRES = 60 * 60 * 24 * 7 * 1000; // 7 days
exports.flatmateLogin = async (req, res) => {
  const { email, password, latitude, longitude } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Firebase REST API sign-in
    const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
    const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

    const signInResponse = await axios.post(signInUrl, {
      email,
      password,
      returnSecureToken: true
    });

    const idToken = signInResponse.data.idToken;
    const uid = signInResponse.data.localId;

    // Create session cookie
    const sessionCookie = await firebaseAdmin.auth().createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES });

    // Set HttpOnly cookie
    res.cookie(COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRES,
      path: '/',
    });

    // Save last login location in RTDB
    await db.ref(`flatmate/users/${uid}/lastLogin`).set({
      latitude: latitude || null,
      longitude: longitude || null,
      timestamp: Date.now(),
    });

    res.status(200).json({
      user: { uid, email, name: signInResponse.data.displayName || '' }
    });

  } catch (error) {
    console.error('Login error:', error.response?.data || error.message || error);
    if (error.response?.data?.error?.message === 'EMAIL_NOT_FOUND' ||
        error.response?.data?.error?.message === 'INVALID_PASSWORD') {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    res.status(500).json({ message: 'Server error.' });
  }
};

// const COOKIE_NAME = 'session';
// const SESSION_EXPIRES = 60 * 60 * 24 * 7 * 1000; // 7 days
// exports.flatmateLogin = async (req, res) => {
//   // 1. req.body से 'captchaToken' निकालें
//   const { email, password, latitude, longitude, captchaToken } = req.body;

//   if (!email || !password) {
//     return res.status(400).json({ message: 'Email and password are required.' });
//   }

//   // 🛡️ -------------------- GOOGLE RECAPTCHA VERIFICATION START -------------------- 🛡️
  
//   const GOOGLE_SECRET_KEY = process.env.GOOGLE_RECAPTCHA_SECRET_KEY;
  
//   if (!GOOGLE_SECRET_KEY) {
//       // यह केवल चेतावनी है, उत्पादन (production) में यह हमेशा सेट होना चाहिए
//       console.warn("SECURITY WARNING: GOOGLE_RECAPTCHA_SECRET_KEY is not set. Skipping reCAPTCHA verification.");
      
//   } else if (!captchaToken) {
//       // यदि सीक्रेट की (Secret Key) सेट है, लेकिन क्लाइंट से टोकन नहीं आया, तो फ़ेल करें
//       console.error('reCAPTCHA token missing from request.');
//       return res.status(401).json({ message: 'Security check failed. Please refresh and try again.' });
//   } else {
//       try {
//           const verificationUrl = `https://www.google.com/recaptcha/api/siteverify`;
          
//           // reCAPTCHA API को POST अनुरोध भेजें
//           const googleRes = await axios.post(verificationUrl, null, {
//               params: {
//                   secret: GOOGLE_SECRET_KEY,
//                   response: captchaToken,
//                   // optional: remoteip: req.ip, // IP address सत्यापन सटीकता में सुधार कर सकता है
//               }
//           });
          
//           const googleData = googleRes.data;

//           if (!googleData.success) {
//               // 🛑 सत्यापन विफल होने पर लॉगिन लॉजिक को रोकें
//               console.error('reCAPTCHA verification failed. Errors:', googleData['error-codes']);
//               // हमलावर को विफलता का सटीक कारण जानने से रोकने के लिए सामान्य त्रुटि संदेश
//               return res.status(401).json({ message: 'Login failed. Security check failed.' });
//           }

//           console.log('reCAPTCHA verification successful. Proceeding with Firebase login.');

//       } catch (captchaError) {
//           // यदि Google API से संपर्क करने में कोई समस्या आती है
//           console.error('Error contacting Google reCAPTCHA API:', captchaError.message);
//           return res.status(500).json({ message: 'Server error during security check.' });
//       }
//   }
//   // 🛡️ -------------------- GOOGLE RECAPTCHA VERIFICATION END -------------------- 🛡️

//   try {
//     // 3. (Original Logic) Firebase REST API sign-in
//     const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
//     const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

//     const signInResponse = await axios.post(signInUrl, {
//       email,
//       password,
//       returnSecureToken: true
//     });

//     const idToken = signInResponse.data.idToken;
//     const uid = signInResponse.data.localId;

//     // Create session cookie
//     const sessionCookie = await firebaseAdmin.auth().createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES });

//     // Set HttpOnly cookie
//     res.cookie(COOKIE_NAME, sessionCookie, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: 'lax',
//       maxAge: SESSION_EXPIRES,
//       path: '/',
//     });

//     // Save last login location in RTDB
//     await db.ref(`flatmate/users/${uid}/lastLogin`).set({
//       latitude: latitude || null,
//       longitude: longitude || null,
//       timestamp: Date.now(),
//     });

//     res.status(200).json({
//       user: { uid, email, name: signInResponse.data.displayName || '' }
//     });

//   } catch (error) {
//     console.error('Login error:', error.response?.data || error.message || error);
//     if (error.response?.data?.error?.message === 'EMAIL_NOT_FOUND' ||
//         error.response?.data?.error?.message === 'INVALID_PASSWORD') {
//       return res.status(401).json({ message: 'Invalid credentials.' });
//     }
//     res.status(500).json({ message: 'Server error.' });
//   }
// };

// ----------------------------------------------------------
// 🟢 getCurrentUser
// ----------------------------------------------------------
exports.getCurrentUser = async (req, res) => {
  const sessionCookie = req.cookies?.session;
  if (!sessionCookie) return res.status(401).json({ message: "Unauthorized. No session found." });

  try {
    const decodedClaims = await require('firebase-admin').auth().verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;

    // RTDB se user data fetch
    const userSnapshot = await require('../config/firebaseConfig.js').db.ref(`/flatmate/users/${uid}`).once('value');
    if (!userSnapshot.exists()) return res.status(404).json({ message: "User not found." });

    const userData = userSnapshot.val();
    res.status(200).json({ user: userData });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(401).json({ message: "Invalid or expired session." });
  }
};


// ----------------------------------------------------------
// 🟢 logout (already defined above, just ensure cookie clear)
// ----------------------------------------------------------

// ----------------------------------------------------------
// 🟢 logout (CONTROLLER)
// ----------------------------------------------------------
// ----------------------------------------------------------
// 🟢 flatmateLogout (CONTROLLER)
// ----------------------------------------------------------
exports.flatmateLogout = async (req, res) => {
    try {
        const sessionCookie = req.cookies?.session;

        if (!sessionCookie) {
            return res.status(400).json({ message: "No active session found." });
        }

        // Session cookie verify
        const decoded = await firebaseAdmin.auth().verifySessionCookie(sessionCookie, true);

        // Firebase refresh tokens revoke → ensures logout from everywhere
        await firebaseAdmin.auth().revokeRefreshTokens(decoded.uid);

        // Clear session cookie
        res.clearCookie("session", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        });

        return res.status(200).json({ message: "Logged out successfully." });

    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ message: "Server error during logout.", error: error.message });
    }
};


// ----------------------------------------------------------
// 🟢 flatmateForgotPassword (CONTROLLER)
// ----------------------------------------------------------
exports.flatmateForgotPassword = async (req, res) => {
    const resetData = req.body;

    try {
        const success = await flatmateUserService.sendPasswordResetEmail(resetData);
        if (success) {
            res.status(200).json({ message: "Password reset email sent successfully!" });
        }

    } catch (error) {
        console.error("Forgot Password Error:", error);
        if (error.message.includes("is required") || error.message.includes("Invalid email")) {
            return res.status(400).json({ message: error.message });
        }
        if (error.message.includes("Failed to send reset email")) {
            return res.status(500).json({ message: error.message });
        }
        if (error.errorInfo && error.errorInfo.code) {
            if (error.errorInfo.code === 'auth/user-not-found') {
                return res.status(404).json({ message: "User not found with this email." });
            }
        }
        res.status(500).json({ message: "Something went wrong.", error: error.message });
    }
};

const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = process.env.OAUTH_CLIENT_ID; 
const GOOGLE_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const REDIRECT_URI = process.env.REDIRECT_URI; 
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

const findOrCreateFlatmateUser = async (googleProfile) => {
    let firebaseUser;
    
    try {
        // 1. Check if user exists in Firebase Auth by email
        firebaseUser = await firebaseAdmin.auth().getUserByEmail(googleProfile.email);
        
    } catch (error) {
        // User not found (auth/user-not-found), create a new one
        if (error.code === 'auth/user-not-found') {
            console.log("Creating new Firebase user via Google SSO...");
            firebaseUser = await firebaseAdmin.auth().createUser({
                email: googleProfile.email,
                displayName: googleProfile.name,
                emailVerified: googleProfile.email_verified,
            });

            // 2. Initialize RTDB profile data (Essential for your app logic)
            await db.ref(`flatmate/users/${firebaseUser.uid}`).set({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: firebaseUser.displayName || googleProfile.name,
                city: '', // Default fields for profile completion check
                phoneNumber: '', 
            });
        } else {
            // Re-throw other errors (e.g., network, server issues)
            throw error;
        }
    }

    // 3. Fetch RTDB data to ensure we return a complete user object
    const userSnapshot = await db.ref(`flatmate/users/${firebaseUser.uid}`).once('value');
    
    return {
        ...userSnapshot.val(), 
        uid: firebaseUser.uid, 
        email: firebaseUser.email, 
    };
};


// ----------------------------------------------------------
// 🟢 googleSSOCallback (CONTROLLER)
// Route: GET /auth/google/callback
// ----------------------------------------------------------
exports.googleSSOCallback = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        // User denied access or flow was interrupted, close the popup
        return res.status(400).send('<script>window.close();</script>');
    }
    
    // 1. Initialize Google OAuth client
    const oauth2Client = new OAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        REDIRECT_URI
    );

    try {
        // 2. Exchange the authorization code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        
        // 3. Verify the ID Token and get Google Profile data
        const ticket = await oauth2Client.verifyIdToken({
            idToken: tokens.id_token,
            audience: GOOGLE_CLIENT_ID,
        });
        const googleProfile = ticket.getPayload();
        
        if (!googleProfile.email || !googleProfile.email_verified) {
             return res.status(401).send('<script>window.close();</script>');
        }
        
        // 4. Find or create the user in Firebase Auth & RTDB
        const user = await findOrCreateFlatmateUser(googleProfile);
        const uid = user.uid;

        // 5. Create a Custom Token and exchange it for a Firebase ID Token (required for session cookies)
        const customToken = await firebaseAdmin.auth().createCustomToken(uid);
        
        const tokenResponse = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
            {
                token: customToken,
                returnSecureToken: true
            }
        );
        const idToken = tokenResponse.data.idToken;

        // 6. Create session cookie
        const sessionCookie = await firebaseAdmin.auth().createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES });
        
        // 7. Set HttpOnly cookie
        res.cookie(COOKIE_NAME, sessionCookie, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SESSION_EXPIRES,
            path: '/',
        });

        // 8. Return the user data to the frontend via postMessage
        const userDataForClient = JSON.stringify({
            uid: user.uid,
            email: user.email,
            name: user.name,
            city: user.city || '', 
            phoneNumber: user.phoneNumber || '',
        });

        // This script sends the data to the main window and closes the popup.
        res.send(`
    <!DOCTYPE html>
    <html>
    <body>
        <script>
  const messageData = { 
                        ssoSuccess: true,
                        user: ${userDataForClient}
                    };             if (window.opener) {
                window.opener.postMessage(messageData, '${FRONTEND_ORIGIN}');
                window.close(); // 🎯 यह लाइन पॉपअप को बंद करती है
            } else {
                document.body.innerHTML = 'SSO successful. Please return to the main application.';
            }
        </script>
    </body>
    </html>
`);

    } catch (error) {
        console.error('Google SSO Callback Error:', error.message || error);
        
        // Send failure message and close the window
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ ssoSuccess: false, error: 'Authentication failed. Server Error.' }, '${FRONTEND_ORIGIN}');
                        window.close();
                    } else {
                        document.body.innerHTML = 'SSO failed. Please try again.';
                    }
                </script>
            </body>
            </html>
        `);
    }
};