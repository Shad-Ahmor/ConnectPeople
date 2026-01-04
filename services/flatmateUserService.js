// services/flatmateUserService.js

// 🚨 MODIFIED: Direct imports removed to support multi-app instances
const { getFirebaseInstance } = require('../config/firebaseConfig.js');
const sendEmail = require("../mailer.js");
const { resetPasswordTemplate } = require("../templates/resetPasswordTemplate.js");

const { 
    FlatmateSignupModel, 
    FlatmateProfileModel, 
    FlatmateUserModel, 
    ForgotPasswordModel 
} = require('../models/flatmateUser.js'); 

const sanitizeString = (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim(); 
};

// ----------------------------------------------------
// Helper: Update Custom Claims
// ----------------------------------------------------
// 🚨 MODIFIED: Now accepts 'auth' instance as first parameter
const updateCustomClaims = async (auth, uid, claims) => {
    try {
        const user = await auth.getUser(uid);
        const existingClaims = user.customClaims || {};
        const mergedClaims = { ...existingClaims, ...claims };
        await auth.setCustomUserClaims(uid, mergedClaims);
        // console.log(`Custom claims updated for UID: ${uid}. New claims: ${JSON.stringify(claims)}`);
    } catch (error) {
        console.error("Error setting custom claims:", error);
        throw error;
    }
};


// ----------------------------------------------------
// 🟢 SERVICE FUNCTION 1: Create User (Signup)
// ----------------------------------------------------
exports.createFlatmateUser = async (signupData) => {
    // 🚀 NEW: Dynamic Instance Fetching
    const appName = signupData.appName || 'flatmate';
    const { auth, db } = getFirebaseInstance(appName);
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;

    signupData.email = sanitizeString(signupData.email);
    signupData.name = sanitizeString(signupData.name);
    const userModel = new FlatmateSignupModel(signupData); 

    const userRecord = await auth.createUser({
        email: userModel.email,
        password: userModel.password,
        displayName: userModel.name,
    });
    const uid = userRecord.uid;
    
    const rtdbData = userModel.toInitialRTDBData(uid);
    // 🚨 MODIFIED: Dynamic Root Path
    await db.ref(`/${rootNode}/users/${uid}`).set(rtdbData);

    const initialClaims = {
        uid: uid,
        email: userModel.email,
        role: userModel.role,
        planName: userModel.planName,
        name: userModel.name,
        signupStage: userModel.signupStage, 
    };
    // 🚨 MODIFIED: Passing auth instance
    await updateCustomClaims(auth, uid, initialClaims);

    // C. 🚨 FIX: ID Token generate karein (REST API use karke)
    const FIREBASE_API_KEY = process.env.FLATMATE_API_KEY;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            email: userModel.email,
            password: userModel.password,
            returnSecureToken: true
        }),
        headers: { 'Content-Type': 'application/json' }
    });

    const authData = await response.json();

    if (!authData.idToken) {
        throw new Error("Failed to generate ID Token: " + (authData.error?.message || "Unknown error"));
    }

    return { uid, userData: rtdbData, idToken: authData.idToken };
};

/** Generates a 6-digit numeric OTP. */
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

/** Sanitizes email for RTDB key. */
const getEmailKey = (email) => {
    return Buffer.from(email).toString('base64').replace(/=/g, ''); 
};

/** Stores the OTP in RTDB with a 60-second expiry. */
// 🚨 MODIFIED: Added appName support
exports.storeOtp = async (email, otp, appName = 'flatmate') => {
    const { db } = getFirebaseInstance(appName);
    const expiryTime = Date.now() + 600000;
    const emailKey = getEmailKey(email);

    await db.ref(`temp/otps/${emailKey}`).set({
        otp,
        expiry: expiryTime,
        email,
    });
};

/** Validates the provided OTP against the stored one. */
// 🚨 MODIFIED: Added appName support
exports.validateOtp = async (email, otp, appName = 'flatmate') => {
    const { db } = getFirebaseInstance(appName);
    const emailKey = getEmailKey(email);
    const otpRef = db.ref(`temp/otps/${emailKey}`);
    const snapshot = await otpRef.once('value');
    const storedData = snapshot.val();

    if (!storedData) {
        return { success: false, message: "OTP not found or expired. Please resend." };
    }

    if (storedData.expiry < Date.now()) {
        await otpRef.remove(); 
        return { success: false, message: "OTP has expired. Please resend." };
    }

    if (storedData.otp !== otp) {
        return { success: false, message: "Invalid OTP provided." };
    }

    await otpRef.remove();
    return { success: true, message: "OTP verified successfully." };
};

/** Sends the OTP via email using the mailer utility. */
// 🚨 MODIFIED: Added appName support
exports.sendOtpEmail = async (email, appName = 'flatmate') => {
    const otp = generateOtp();
    const otpArray = otp.toString().split("");
    const subject = `FYF: ${otp} is your verification code`;
    const html = `${otp}`;

    const emailSent = await sendEmail({ to: email, subject, html , otp });
    
    if (emailSent) {
        // 🚨 MODIFIED: Passing appName to storeOtp
        await exports.storeOtp(email, otp, appName);
        return { success: true, otp };
    }
    return { success: false };
};

    // const html = `
    // <div style="background-color: #f0f4f8; padding: 40px 10px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    //     <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); border: 1px solid #e1e8f0;">
    //         <tr>
    //             <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
    //                 <div style="background: rgba(255, 255, 255, 0.2); width: 60px; height: 60px; line-height: 60px; border-radius: 18px; margin: 0 auto 15px; font-size: 30px; box-shadow: inset 0 2px 5px rgba(255,255,255,0.4);">🏠</div>
    //                 <h1 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">FindYourFlatMates</h1>
    //             </td>
    //         </tr>
    //         <tr>
    //             <td style="padding: 40px 30px; text-align: center;">
    //                 <h2 style="color: #1a202c; margin-bottom: 10px; font-size: 20px;">Verify Your Identity</h2>
    //                 <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">Hello! Use the secure code below to complete your registration. It's valid for <b>10 minutes</b>.</p>
                    
    //                 <div style="margin: 30px 0;">
    //                     <table align="center" border="0" cellpadding="0" cellspacing="8">
    //                         <tr>
    //                             ${otpArray.map(num => `
    //                                 <td style="width: 45px; height: 55px; background: #ffffff; border: 2px solid #edf2f7; border-bottom: 4px solid #cbd5e0; border-radius: 12px; font-size: 28px; font-weight: bold; color: #4c51bf; text-align: center; line-height: 55px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">${num}</td>
    //                             `).join('')}
    //                         </tr>
    //                     </table>
    //                 </div>

    //                 <p style="color: #718096; font-size: 13px; margin-top: 25px;">
    //                     If you didn't request this code, you can safely ignore this email.
    //                 </p>
    //             </td>
    //         </tr>
    //         <tr>
    //             <td style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #edf2f7;">
    //                 <p style="margin: 0; color: #a0aec0; font-size: 12px;">&copy; 2025 FindYourFlatMates. All rights reserved.</p>
    //                 <div style="margin-top: 10px;">
    //                     <span style="color: #cbd5e0;">📍 Secure Cloud Verification</span>
    //                 </div>
    //             </td>
    //         </tr>
    //     </table>
    // </div>
    // `;

// ----------------------------------------------------
// 🟢 SERVICE FUNCTION 2: Complete Profile
// ----------------------------------------------------
exports.completeFlatmateProfile = async (uid, profileData) => {
    // 🚀 NEW: Dynamic Instance Fetching
    const appName = profileData.appName || 'flatmate';
    const { auth, db } = getFirebaseInstance(appName);
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;

    if (profileData.city) {
        profileData.city = sanitizeString(profileData.city);
    }
    if (profileData.phoneNumber) {
        profileData.phoneNumber = sanitizeString(profileData.phoneNumber);
    }
    if (profileData.primaryIntent) {
        profileData.primaryIntent = sanitizeString(profileData.primaryIntent);
    }
    if (profileData.secondaryIntent) {
        profileData.secondaryIntent = sanitizeString(profileData.secondaryIntent);
    }
    const profileModel = new FlatmateProfileModel(profileData);

    const updateData = profileModel.toRTDBUpdateData();
    // 🚨 MODIFIED: Dynamic Root Path
    await db.ref(`/${rootNode}/users/${uid}`).update(updateData);
    
    const finalClaims = profileModel.toCustomClaimsUpdate();
    // 🚨 MODIFIED: Passing auth instance
    await updateCustomClaims(auth, uid, finalClaims);
    
    return updateData;
};


// ----------------------------------------------------
// 🟢 SERVICE FUNCTION 3: Handle User Login
// ----------------------------------------------------
exports.handleFlatmateLogin = async (email, locationData) => {
    // 🚀 NEW: Dynamic Instance Fetching
    const appName = locationData.appName || 'flatmate';
    const { auth, db } = getFirebaseInstance(appName);
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;

    const sanitizedEmail = sanitizeString(email);
    const searchEmail = sanitizedEmail.trim().toLowerCase();

    // 🚨 MODIFIED: Dynamic Root Path
    const usersRef = db.ref(`/${rootNode}/users`);
    const snapshot = await usersRef.once("value");

    if (!snapshot.exists()) throw new Error("Database is empty or error fetching users.");

    const users = snapshot.val();
    let userRecord = null;

    for (const uid in users) {
        const userData = users[uid];
        if (userData.email && userData.email.trim().toLowerCase() === searchEmail) {
            userRecord = { uid, data: userData };
            break;
        }
    }

    if (!userRecord) throw new Error("User not found with this email.");

    const { uid, data: userData } = userRecord;
    const userModel = new FlatmateUserModel(userData); 

    const { ipAddress, latitude, longitude } = locationData;
    const updateData = {};
    if (ipAddress) updateData.ipAddress = ipAddress;
    if (latitude && longitude) {
        updateData.latitude = latitude;
        updateData.longitude = longitude;
        updateData.lastLogin = new Date().toISOString();
    }

    if (Object.keys(updateData).length > 0) {
        // 🚨 MODIFIED: Dynamic Root Path
        await db.ref(`/${rootNode}/users/${uid}`).update(updateData);
        userModel.ipAddress = updateData.ipAddress || userModel.ipAddress;
        userModel.latitude = updateData.latitude || userModel.latitude;
        userModel.longitude = updateData.longitude || userModel.longitude;
        userModel.lastLogin = updateData.lastLogin || userModel.lastLogin;
    }

    const claimsData = userModel.toCustomClaims(); 
    // 🚨 MODIFIED: Passing auth instance
    await updateCustomClaims(auth, uid, claimsData);

    const customToken = await auth.createCustomToken(uid);

    return { 
        uid, 
        customToken, 
        sessionData: userModel.toSessionData(), 
        locationTracked: !!(latitude && longitude)
    };
};


// ----------------------------------------------------
// 🟢 SERVICE FUNCTION 4: Send Forgot Password Email
// ----------------------------------------------------
exports.sendPasswordResetEmail = async (resetData) => {
    // 🚀 NEW: Dynamic Instance Fetching
    const appName = resetData.appName || 'flatmate';
    const { db } = getFirebaseInstance(appName);
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;

    resetData.email = sanitizeString(resetData.email);
    const resetModel = new ForgotPasswordModel(resetData);
    const email = resetModel.email;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailKey = email.replace(/\./g, '_'); 

    // 🚨 MODIFIED: Dynamic Root Path
    await db.ref(`/${rootNode}/password_resets/${emailKey}`).set({
        otp: otp,
        expiresAt: Date.now() + 600000, 
        verified: false
    });

    const html = resetPasswordTemplate(otp); 
    const sent = await sendEmail({
        to: email,
        subject: `${otp} is your Reset Code - Find Your Flatmate`,
        html,
    });

    if (!sent) {
        throw new Error("Failed to send reset email.");
    }
    
    return true; 
};