// models/flatmateUser.js

// ------------------------------------------
// 🎯 Model for Step 1: Initial Signup
// ------------------------------------------
class FlatmateSignupModel {
    constructor(data) {
        // --- Required Fields for Step 1 ---
        if (!data.email) throw new Error("Email is required for signup.");
        if (!data.password) throw new Error("Password is required for signup.");
        if (!data.username) throw new Error("Full Name (username) is required for signup.");

        this.email = data.email;
        this.password = data.password;
        this.name = data.username;

        this.primaryIntent = data.primaryIntent || null;
        this.secondaryIntent = data.secondaryIntent || null;

        // --- Default/Initial RTDB fields ---
        this.uid = null; // Will be set by Firebase Auth
        this.approved = false;
        this.createdAt = new Date().toISOString();
        this.role = validRoles.includes(this.primaryIntent) 
            ? this.primaryIntent 
            : 'Tenant';
        this.planName = `${this.primaryIntent}: ${this.secondaryIntent}`;
        this.city = null;
        this.phoneNumber = null;
        this.signupStage =3; 
    }

    // Method to return RTDB-ready data for initial save (excluding password)
    toInitialRTDBData(uid) {
        return {
            uid: uid,
            email: this.email,
            name: this.name,
            role: this.role,
            planName: this.planName, 
            primaryIntent: this.primaryIntent,
            secondaryIntent: this.secondaryIntent,
            approved: this.approved,
            createdAt: this.createdAt,
            city: this.city,
            phoneNumber: this.phoneNumber,
        };
    }
}

// ------------------------------------------
// 🎯 Model for Step 2: Profile Completion
// ------------------------------------------
class FlatmateProfileModel {
    constructor(data) {
        // --- Required Fields for Step 2 ---
        if (!data.city) throw new Error("City is required to complete the profile.");
        if (!data.phoneNumber) throw new Error("Phone Number is required to complete the profile.");
        if (!data.primaryIntent) throw new Error("Primary Intent is required to complete the profile.");
        if (!data.secondaryIntent) throw new Error("Secondary Intent is required to complete the profile.");

        this.city = data.city;
        this.phoneNumber = data.phoneNumber;
        this.primaryIntent = data.primaryIntent;
        this.secondaryIntent = data.secondaryIntent;
        
        // --- Optional Fields for Step 2 ---
        this.ipAddress = data.ipAddress || null;
        this.latitude = data.latitude || null;
        this.longitude = data.longitude || null;
        
        // --- Derived/Updated Fields ---
        this.planName = `${this.primaryIntent}: ${this.secondaryIntent}`;
        this.role = ['Tenant', 'Owner', 'Buyer', 'Seller'].includes(this.primaryIntent) 
            ? this.primaryIntent 
            : 'Tenant';
        this.approved = true;
        this.lastProfileUpdate = new Date().toISOString();
        this.signupStage = 2;
    }

    // Method to return RTDB-ready data for profile update
    toRTDBUpdateData() {
        return {
            city: this.city,
            phoneNumber: this.phoneNumber,
            role: this.role,
            planName: this.planName,
            ipAddress: this.ipAddress,
            latitude: this.latitude,
            longitude: this.longitude,
            approved: this.approved,
            signupStage: this.signupStage,
            lastProfileUpdate: this.lastProfileUpdate,
        };
    }

    // Method to return Custom Claims update data
    toCustomClaimsUpdate() {
        return {
            role: this.role,
            signupStage: this.signupStage,
            latitude: this.latitude,
            longitude: this.longitude,
        };
    }
}

// ------------------------------------------
class FlatmateUserModel {
    constructor(dbData) {
        // --- Core Validation ---
        if (!dbData || !dbData.uid || !dbData.email) {
            throw new Error("Invalid user data received from database.");
        }

        // --- Core Fields ---
        this.uid = dbData.uid;
        this.email = dbData.email;
        this.name = dbData.name || '';
        this.role = dbData.role || 'Tenant';
        this.approved = !!dbData.approved;
        this.createdAt = dbData.createdAt;

        // --- Profile Fields ---
        this.city = dbData.city || null;
        this.phoneNumber = dbData.phoneNumber || null;
        this.planName = dbData.planName || null;
        
        // --- Location/Audit Fields ---
        this.ipAddress = dbData.ipAddress || null;
        this.latitude = dbData.latitude || null;
        this.longitude = dbData.longitude || null;
        this.lastLogin = dbData.lastLogin || null;
    }

    // Method to return data ready for session storage
    toSessionData() {
        // Return all fields relevant for session
        return {
            uid: this.uid,
            email: this.email,
            name: this.name,
            role: this.role,
            city: this.city,
            phoneNumber: this.phoneNumber,
            planName: this.planName,
            approved: this.approved,
            ipAddress: this.ipAddress,
            latitude: this.latitude,
            longitude: this.longitude,
            createdAt: this.createdAt,
            lastLogin: this.lastLogin,
        };
    }

    // Method to return Custom Claims data (only security/auth relevant)
    toCustomClaims() {
        return {
            uid: this.uid,
            email: this.email,
            name: this.name,
            role: this.role,
            // Assuming signupStage is derived or fetched if needed
            signupStage: this.city ? 2 : 1, // Simple derivation based on profile completion
            latitude: this.latitude,
            longitude: this.longitude,
        };
    }
}

class ForgotPasswordModel {
    constructor(data) {
        // --- Required Field ---
        if (!data.email) throw new Error("Email is required for password reset.");
        
        // Simple regex check (optional but recommended)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
             throw new Error("Invalid email format.");
        }

        this.email = data.email;
    }
}
module.exports = {
    FlatmateSignupModel,
    FlatmateProfileModel,
    FlatmateUserModel,
    ForgotPasswordModel
};