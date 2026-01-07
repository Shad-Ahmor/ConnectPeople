// flatmateAuthController.js

const { getFlatmateUserByEmail, getFirebaseInstance } = require('../config/firebaseConfig.js');
const sendEmail = require("../mailer.js");
const { resetPasswordTemplate } = require("../templates/resetPasswordTemplate.js");
const flatmateUserService = require('../services/flatmateUserService.js'); 
const axios = require('axios');
const { sendOtpEmail, validateOtp } = require('../services/flatmateUserService.js'); // New imports
const sanitizeString = (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim(); 
};
const isProduction = process.env.NODE_ENV === 'production';
const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = process.env.OAUTH_CLIENT_ID; 
const GOOGLE_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const FIREBASE_API_KEY = process.env.FLATMATE_API_KEY;
const REDIRECT_URI = process.env.REDIRECT_URI; 
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

// ----------------------------------------------------------
// 🟢 flatmateSignup (CONTROLLER)
// ----------------------------------------------------------
exports.sendOtp = async (req, res) => {
    const appName = req.body.appName || 'flatmate';
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required." });
    }

    try {
        // 1. Check if user already exists using the RTDB function.
        // 💡 This function returns null if the user is not found, avoiding the 'auth/user-not-found' error.
        const sanitizedEmail=sanitizeString(email)
        const existingUser = await getFlatmateUserByEmail(sanitizedEmail,appName); 

        if (existingUser) {
             // User found in RTDB -> return 409 Conflict
             return res.status(409).json({ message: 'User already exists with this email. Please login.' });
        }
        
        // 2. Generate, Store, and Send OTP Email (Flow continues only if user is new)
        const result = await sendOtpEmail(sanitizedEmail,appName);

        if (result.success) {
            return res.status(200).json({ message: 'Verification code sent to email successfully.', sanitizedEmail });
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
    const appName = req.body.appName || 'flatmate';
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required." });
    }

    try {
        const validationResult = await validateOtp(email, otp,appName);

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
exports.flatmateSignup = async (req, res) => {
    const appName = req.body.appName || 'flatmate';
    const {auth, db } = getFirebaseInstance(appName);
    const signupData = req.body;

    if (!signupData.isEmailVerified) {
        return res.status(403).json({ message: 'Email must be verified first.' });
    }
    
    try {
        // 1. Service call - ab idToken yahan se aayega
        const { uid, userData, idToken } = await flatmateUserService.createFlatmateUser(signupData);

        // 2. Firebase Session Cookie banayein
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 Din
        const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
        // 3. Cookie set karein - Refresh fix ke liye 'session' naam rakhein
        const dynamicCookieName = appName === 'flatmate' ? 'flatmate_session' : `${appName}_session`;
        res.setCookie(dynamicCookieName, sessionCookie, { 
            maxAge: SESSION_EXPIRES // Ensure maxAge is passed
        });

        // 4. Response bhejien
        res.status(201).json({
            message: 'Registration successful.', 
            uid: uid,
            user: { 
                uid: uid,
                email: userData.email, 
                name: userData.name,
                role: userData.role || signupData.primaryIntent,
                primaryIntent: userData.primaryIntent,
                secondaryIntent: userData.secondaryIntent
            },
        });

    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
};
// ----------------------------------------------------------
// 🟢 flatmateCompleteProfile (CONTROLLER)
// ----------------------------------------------------------
exports.flatmateCompleteProfile = async (req, res) => {
    const appName = req.body.appName || 'flatmate';
    const { auth } = getFirebaseInstance(appName);
    
    // 1. टोकन प्राप्त करें (Cookie या Header से)
    const token = req.cookies.session || req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    // 💡 Priority check: Agar middleware ne pehle hi verify kar diya hai (req.userId), 
    // toh wahi use karein, warna token decode karein.
    let uid = req.userId || req.user?.uid; 

    if (!uid && !token) {
        return res.status(401).json({ message: "Unauthorized. No token or session found." });
    }

    // Agar UID middleware se nahi mila, tabhi manually verify/decode karein
    if (!uid) {
        try {
            // 2. Firebase Session Cookie वेरीफाई करने की कोशिश करें
            const decodedClaims = await auth.verifySessionCookie(token, false);
            uid = decodedClaims.uid;
        } catch (err) {
            /* 💡 अगर verifySessionCookie फेल होता है (Custom/ID Token के केस में), 
               JWT डिकोड करके UID निकालें 
            */
            try {
                const base64Url = token.split('.')[1];
                if (!base64Url) throw new Error("Invalid JWT format");
                const decodedCustom = JSON.parse(Buffer.from(base64Url, 'base64').toString());
                
                uid = decodedCustom.uid || decodedCustom.sub;
                
                if (!uid) throw new Error("No UID in token");
            } catch (innerErr) {
                console.error("Token decoding failed:", innerErr.message);
                return res.status(401).json({ message: "Invalid or expired token. Please login again." });
            }
        }
    }

    // 3. प्रोफाइल डेटा अपडेट करें
    const profileData = req.body;
    // Sanitization for safety
    const sanitizedCity = sanitizeString(profileData.city);
    const sanitizedPhone = sanitizeString(profileData.phoneNumber);

    if (!sanitizedCity || !sanitizedPhone) {
        return res.status(400).json({ message: "City and Phone number are required." });
    }

    try {
        // Data format set karein as per Service requirement
        const finalProfileData = {
            ...profileData,
            city: sanitizedCity,
            phoneNumber: sanitizedPhone,
            profileCompleted: true,
            updatedAt: Date.now()
        };

        // Service handles dynamic app instances and models
        const updatedProfile = await flatmateUserService.completeFlatmateProfile(uid, finalProfileData);
        
        res.status(200).json({
            message: 'Profile completed successfully!',
            user: updatedProfile,
        });
    } catch (error) {
        console.error("Error completing profile:", error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
// ----------------------------------------------------------
// 🟢 flatmateLogin (CONTROLLER)
// // ----------------------------------------------------------

const COOKIE_NAME = 'session';
const SESSION_EXPIRES = 60 * 60 * 24 * 7 * 1000; // 7 days
exports.flatmateLogin = async (req, res) => {
   const appName = req.body.appName || 'flatmate'; 
    const { auth, db } = getFirebaseInstance(appName);
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;
  const { email, password, latitude, longitude ,captchaToken} = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Firebase REST API sign-in
    const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

    const signInResponse = await axios.post(signInUrl, {
      email,
      password,
      returnSecureToken: true
    });

    const idToken = signInResponse.data.idToken;
    
    const uid = signInResponse.data.localId;
    const userSnapshot = await db.ref(`${rootNode}/users/${uid}`).once('value');
    const userData = userSnapshot.val();
    if (!userData) {
        return res.status(404).json({ message: "User data not found in database." });
    }
    const userRole = userData?.role || 'Tenant';

    // Create session cookie
    
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES });

    // Set HttpOnly cookie
    const dynamicCookieName = appName === 'flatmate' ? 'flatmate_session' : `${appName}_session`;
res.setCookie(dynamicCookieName, sessionCookie, { 
    maxAge: SESSION_EXPIRES // Ensure maxAge is passed
});

    // Save last login location in RTDB
    await db.ref(`${rootNode}/users/${uid}/lastLogin`).set({
          latitude: latitude || null,
      longitude: longitude || null,
      timestamp: Date.now(),
    });

    res.status(200).json({
      user: { 
          uid, 
          email, 
          name: signInResponse.data.displayName || '',
          role: userRole,
      }
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
exports.getCurrentUser = async (req, res) => {
  const appName = req.query.appName || 'flatmate';
  const { auth, db } = getFirebaseInstance(appName);
  


  const dynamicCookieName = appName === 'flatmate' ? 'flatmate_session' : `${appName}_session`;
  const sessionCookie = req.cookies?.[dynamicCookieName];


  if (!sessionCookie) return res.status(401).json({ message: "Unauthorized. No session found." });

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, false);
    const uid = decodedClaims.uid;

    // RTDB se user data fetch
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;
    const userSnapshot = await db.ref(`/${rootNode}/users/${uid}`).once('value');
    if (!userSnapshot.exists()) return res.status(404).json({ message: "User not found." });

    const userData = userSnapshot.val();


    // 🚀 MAGIC: Firebase Client ke liye token banayein
    const firebaseToken = await auth.createCustomToken(uid);
   res.status(200).json({ 
      user: { uid, ...userData,role: userData.role || 'Tenant' }, 
      firebaseToken // Ye token frontend ko bhejein
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(401).json({ message: "Invalid or expired session." });
  }
};

exports.getFlatmateProfile = async (req, res) => {
    const { uid } = req.params;
    const appName = req.query.appName || 'flatmate';
    const { db } = getFirebaseInstance(appName);
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;

    try {
        const userSnapshot = await db.ref(`${rootNode}/users/${uid}`).once('value');
        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: "User not found." });
        }

        const rawData = userSnapshot.val();
        
        // --- Frontend Stats Logic Implementation ---
        const userProperties = rawData.property || {};
        const propertyEntries = Object.values(userProperties);

        let stats = {
            totalProperties: propertyEntries.length,
            totalRent: 0,
            totalFlatmate: 0,
            totalSell: 0
        };

        propertyEntries.forEach(item => {
            const goal = item.listing_goal?.toLowerCase();
            if (goal === 'rent') stats.totalRent++;
            else if (goal === 'flatmate') stats.totalFlatmate++;
            else if (goal === 'sell' || goal === 'sale') stats.totalSell++;
        });

        // Exact response matching your frontend expectation
        res.status(200).json({
            uid: uid,
            name: rawData.name || '',
            email: rawData.email || '',
            phoneNumber: rawData.phoneNumber || rawData.phone || '',
            city: rawData.city || '',
            role: rawData.role || 'User',
            approved: rawData.approved || false,
            createdAt: rawData.createdAt || null,
            totalProperties: stats.totalProperties,
            totalRent: stats.totalRent,
            totalFlatmate: stats.totalFlatmate,
            myProperties: propertyEntries // Array of properties
        });

    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// ----------------------------------------------------------
// 🟢 updateFlatmateProfile (NEW) - Optimized update
// ----------------------------------------------------------
exports.updateFlatmateProfile = async (req, res) => {
    // Middleware adds user to req (from session)
    const uid = req.user.uid; 
    const appName = req.body.appName || 'flatmate';
    const { db } = getFirebaseInstance(appName);
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;
    
    const { name, phoneNumber, city } = req.body;

    try {
        const userRef = db.ref(`${rootNode}/users/${uid}`);
        
        const filteredData = {
            name: sanitizeString(name) || "",
            phoneNumber: sanitizeString(phoneNumber) || "",
            city: sanitizeString(city) || "",
            lastProfileUpdate: Date.now()
        };

        // Update specific fields without overwriting 'property' node
        await userRef.update(filteredData);
        
        res.status(200).json({ success: true, message: "Profile updated successfully" });
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ message: "Update failed", error: error.message });
    }
};

// 🟢 flatmateLogout (CONTROLLER)
// ----------------------------------------------------------
exports.flatmateLogout = async (req, res) => {
    try {
        const sessionCookie = req.cookies?.session;
        if (sessionCookie) {
            const appName = req.body.appName || 'flatmate';
            const { auth,db } = getFirebaseInstance(appName);
            const decoded = await auth.verifySessionCookie(sessionCookie, false);
            await auth.revokeRefreshTokens(decoded.uid);
        }
  

       res.clearCookie(COOKIE_NAME, {
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/",
        });

        return res.status(200).json({ message: "Logged out successfully." });

    } catch (error) {
        console.error("Logout error:", error);
        res.clearCookie(COOKIE_NAME, {
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/",
        });
        return res.status(500).json({ message: "Server error during logout.", error: error.message });
    }
};


// ----------------------------------------------------------
// 🟢 Step 1: Send Reset OTP
exports.flatmateForgotPassword = async (req, res) => {
   const appName = req.body.appName || 'flatmate';
    const resetData = req.body;
    try {
        const success = await flatmateUserService.sendPasswordResetEmail(resetData,appName);
        if (success) {
            res.status(200).json({ message: "Reset OTP sent successfully to your email!" });
        }
    } catch (error) {
        console.error("Forgot Password Error:", error);
        if (error.message.includes("is required") || error.message.includes("Invalid email")) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Something went wrong.", error: error.message });
    }
};

// 🟢 Step 2: NEW CONTROLLER - Verify OTP & Change Password
exports.flatmateVerifyAndResetPassword = async (req, res) => {
    const appName = req.body.appName || 'flatmate';
    const { auth, db } = getFirebaseInstance(appName);
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;
    // 1. input se 'onlyVerify' flag nikalein jo humne frontend se bheja hai
    const { email, otp, newPassword, onlyVerify } = req.body;

    // 2. Modified Validation: Agar onlyVerify hai toh newPassword zaroori nahi hai
    if (!email || !otp || (!onlyVerify && !newPassword)) {
        return res.status(400).json({ 
            message: onlyVerify ? "Email and OTP are required." : "Email, OTP, and New Password are required." 
        });
    }

    try {
       const emailKey = email.replace(/\./g, '_');
        const otpRef = db.ref(`/${rootNode}/password_resets/${emailKey}`);
        const snapshot = await otpRef.once('value');
        const data = snapshot.val();

        if (!data || data.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP code." });
        }
        // 2. Check if expired
        if (Date.now() > data.expiresAt) {
            await otpRef.remove();
            return res.status(400).json({ message: "OTP has expired." });
        }

        if (onlyVerify) {
            return res.status(200).json({ message: "OTP Verified!", success: true });
        }

        // 🚀 Password Update logic check
        const userRecord = await auth.getUserByEmail(email);
        await auth.updateUser(userRecord.uid, { password: newPassword });
        await otpRef.remove();

        res.status(200).json({ message: "Password updated successfully! Please login." });

    } catch (error) {
        console.error("Reset Final Error:", error);
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ message: "User not found." });
        }
        res.status(500).json({ message: "Failed to reset password.", error: error.message });
    }
};


// Function signature mein appName add karein
const findOrCreateFlatmateUser = async (googleProfile, appName = 'flatmate') => {
    // req.body use nahi karna, direct appName use karna hai
    
    const { auth, db } = getFirebaseInstance(appName); 
    const rootPath = appName === 'flatmate' ? 'flatmate' : appName;
    let firebaseUser;
    
    try {
        firebaseUser = await auth.getUserByEmail(googleProfile.email);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            firebaseUser = await auth.createUser({
                email: googleProfile.email,
                displayName: googleProfile.name,
                emailVerified: googleProfile.email_verified,
            });
            const initialRole = appName === 'flatmate' ? 'Tenant' : 'Member';
            // Path ko bhi dynamic rakhein: appName === 'flatmate' ? 'flatmate' : 'dating'
            await db.ref(`${rootPath}/users/${firebaseUser.uid}`).set({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: firebaseUser.displayName || googleProfile.name,
                role: initialRole,
                city: '', 
                phoneNumber: '', 
            });
        } else {
            throw error;
        }
    }

    const userSnapshot = await db.ref(`${rootPath}/users/${firebaseUser.uid}`).once('value');
    
    return { ...userSnapshot.val(), uid: firebaseUser.uid, email: firebaseUser.email };
};


// ----------------------------------------------------------
// 🟢 googleSSOCallback (CONTROLLER)
// Route: GET /auth/google/callback
// ----------------------------------------------------------
exports.googleSSOCallback = async (req, res) => {
    const appName = req.query.state || 'flatmate';
    const { auth, db } = getFirebaseInstance(appName);
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
        const user = await findOrCreateFlatmateUser(googleProfile, appName);
        const uid = user.uid;

        // 5. Create a Custom Token and exchange it for a Firebase ID Token (required for session cookies)
        const customToken = await auth.createCustomToken(user.uid);
        
        const tokenResponse = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
            {
                token: customToken,
                returnSecureToken: true
            }
        );
        const idToken = tokenResponse.data.idToken;

        // 6. Create session cookie
        const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES });

        // 7. Set HttpOnly cookie
        const activeCookieName = appName === 'flatmate' ? 'session' : `${appName}_session`; 
        res.setCookie(activeCookieName, sessionCookie);

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