// services/flatmateUserService.js

const { db, auth } = require('../config/firebaseConfig.js');
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
const updateCustomClaims = async (uid, claims) => {
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
    await db.ref(`/flatmate/users/${uid}`).set(rtdbData);

    const initialClaims = {
        uid: uid,
        email: userModel.email,
        name: userModel.name,
        signupStage: userModel.signupStage, 
    };
    await updateCustomClaims(uid, initialClaims);

    const customToken = await auth.createCustomToken(uid);

    return { uid, userData: rtdbData, customToken };
};
/** Generates a 6-digit numeric OTP. */
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

/** Sanitizes email for RTDB key. */
const getEmailKey = (email) => {
    // Base64 encoding to sanitize email for RTDB key
    return Buffer.from(email).toString('base64').replace(/=/g, ''); 
};

/** Stores the OTP in RTDB with a 60-second expiry. */
exports.storeOtp = async (email, otp) => {
    const expiryTime = Date.now() + 60000; // 60 seconds expiry
    const emailKey = getEmailKey(email);

    // Using a temporary location for unverified emails
    await db.ref(`temp/otps/${emailKey}`).set({
        otp,
        expiry: expiryTime,
        email,
    });
};

/** Validates the provided OTP against the stored one. */
exports.validateOtp = async (email, otp) => {
    const emailKey = getEmailKey(email);
    const otpRef = db.ref(`temp/otps/${emailKey}`);
    const snapshot = await otpRef.once('value');
    const storedData = snapshot.val();

    if (!storedData) {
        return { success: false, message: "OTP not found or expired. Please resend." };
    }

    if (storedData.expiry < Date.now()) {
        await otpRef.remove(); // Clean up expired OTP
        return { success: false, message: "OTP has expired. Please resend." };
    }

    if (storedData.otp !== otp) {
        return { success: false, message: "Invalid OTP provided." };
    }

    // Success: Remove OTP after successful validation
    await otpRef.remove();
    return { success: true, message: "OTP verified successfully." };
};
/** Sends the OTP via email using the mailer utility. */
exports.sendOtpEmail = async (email) => {
    const otp = generateOtp();
    const subject = "Your FindYourFlatMates  Verification Code";
    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #FF3366;">FindYourFlatMates: Email Verification</h2>
            <p>Hi there,</p>
            <p>Thank you for signing up. Please use the following One-Time Password (OTP) to verify your email address. This code is valid for 60 seconds.</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
                <h1 style="color: #000; margin: 0; font-size: 30px;">${otp}</h1>
            </div>
            <p>If you did not request this, please ignore this email.</p>
            <p>FindYourFlatMates Team</p>
        </div>
    `;
    
    const emailSent = await sendEmail({ to: email, subject, html });
    
    if (emailSent) {
        await exports.storeOtp(email, otp); // Store only if email sent successfully
        return { success: true, otp };
    }
    return { success: false };
};

// ----------------------------------------------------
// 🟢 SERVICE FUNCTION 2: Complete Profile
// ----------------------------------------------------
exports.completeFlatmateProfile = async (uid, profileData) => {
    if (profileData.city) {
        profileData.city = sanitizeString(profileData.city);
    }
    // 💡 FIX: phone number sanitization (if stored as string)
    if (profileData.phoneNumber) {
        // Validation (e.g., regex) is best, but sanitization as a fallback is good practice
        profileData.phoneNumber = sanitizeString(profileData.phoneNumber);
    }
    // 💡 FIX: Intents must be sanitized to prevent injection in derived fields
    if (profileData.primaryIntent) {
        profileData.primaryIntent = sanitizeString(profileData.primaryIntent);
    }
    if (profileData.secondaryIntent) {
        profileData.secondaryIntent = sanitizeString(profileData.secondaryIntent);
    }
    const profileModel = new FlatmateProfileModel(profileData);

    const updateData = profileModel.toRTDBUpdateData();
    await db.ref(`/flatmate/users/${uid}`).update(updateData);
    
    const finalClaims = profileModel.toCustomClaimsUpdate();
    await updateCustomClaims(uid, finalClaims);
    
    return updateData;
};


// ----------------------------------------------------
// 🟢 SERVICE FUNCTION 3: Handle User Login
// ----------------------------------------------------
exports.handleFlatmateLogin = async (email, locationData) => {
    const sanitizedEmail = sanitizeString(email);
    const searchEmail = sanitizedEmail.trim().toLowerCase();

    // Find user by email from /flatmate/users
    const usersRef = db.ref("/flatmate/users");
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
    const userModel = new FlatmateUserModel(userData); // Model use 1: Validate fetched data

    // Update Location & IP
    const { ipAddress, latitude, longitude } = locationData;
    const updateData = {};
    if (ipAddress) updateData.ipAddress = ipAddress;
    if (latitude && longitude) {
        updateData.latitude = latitude;
        updateData.longitude = longitude;
        updateData.lastLogin = new Date().toISOString();
    }

    if (Object.keys(updateData).length > 0) {
        await db.ref(`/flatmate/users/${uid}`).update(updateData);
        // Update model properties for consistency
        userModel.ipAddress = updateData.ipAddress || userModel.ipAddress;
        userModel.latitude = updateData.latitude || userModel.latitude;
        userModel.longitude = updateData.longitude || userModel.longitude;
        userModel.lastLogin = updateData.lastLogin || userModel.lastLogin;
    }

    // Update Firebase Custom Claims
    const claimsData = userModel.toCustomClaims(); // Model use 2: Get Custom Claims data
    await updateCustomClaims(uid, claimsData);

    const customToken = await auth.createCustomToken(uid);

    return { 
        uid, 
        customToken, 
        sessionData: userModel.toSessionData(), // Model use 3: Data ready for Session
        locationTracked: !!(latitude && longitude)
    };
};


// ----------------------------------------------------
// 🟢 SERVICE FUNCTION 4: Send Forgot Password Email
// ----------------------------------------------------
exports.sendPasswordResetEmail = async (resetData) => {
    resetData.email = sanitizeString(resetData.email);
    const resetModel = new ForgotPasswordModel(resetData); // Model use 1: Validate email
    const email = resetModel.email;

    const resetLink = await auth.generatePasswordResetLink(email, {
      url: "http://localhost:8081/login",   
      handleCodeInApp: true
    });

    const html = resetPasswordTemplate(resetLink);

    const sent = await sendEmail({
      to: email,
      subject: "Reset Your Password - Find Your Flatmate",
      html,
    });

    if (!sent) {
      throw new Error("Failed to send reset email.");
    }
    
    return true; 
};