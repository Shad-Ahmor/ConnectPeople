const CAESAR_SHIFT = 13;  // or define wherever needed
const CryptoJS = require('crypto-js');
const secretKey = process.env.ENCRYPTION_SECRET_KEY
// =====================
// 🔐 ENCRYPT FUNCTION
// =====================
exports.encryptedData = (data) => {
  try {
    // Convert object → string if needed
    const stringData = typeof data === "string" ? data : JSON.stringify(data);

    // Encrypt using AES
    const encrypted = CryptoJS.AES.encrypt(stringData, secretKey).toString();
    return encrypted;
  } catch (err) {
    console.error("Encryption failed:", err);
    return null;
  }
};

// =====================
// 🔓 DECRYPT FUNCTION
// =====================
exports.decryptedData = (encryptedData) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);

    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedString) {
      return null; // Wrong key or corrupt data
    }

    // Try parsing JSON
    try {
      return JSON.parse(decryptedString);
    } catch {
      return decryptedString; // Return as plain string
    }
  } catch (err) {
    console.error("Decryption failed:", err);
    return null;
  }
};
