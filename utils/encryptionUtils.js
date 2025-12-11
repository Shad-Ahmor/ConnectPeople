//JUST FOR ENCRYPT SECRET ACCOUNT KEY

const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');

// Your secret key for AES encryption
const secretKey = '1QUa97x7+RK30ydey7OINl+oFNPZASMvfn40bmRB/Zw='

// Path to your original service account JSON
const inputPath = path.join(__dirname, '../FILENAM.json');

// Path to output the encrypted JSON
const outputPath = path.join(__dirname, 'serviceAccountKey_encrypted.json');

// Read original service account JSON
const serviceAccount = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Function to encrypt all values in an object recursively
function encryptObject(obj) {
  const encryptedObj = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'object' && value !== null) {
        // Recursively encrypt nested objects
        encryptedObj[key] = encryptObject(value);
      } else if (typeof value === 'string') {
        // Encrypt string value
        encryptedObj[key] = CryptoJS.AES.encrypt(value, secretKey).toString();
      } else {
        // If value is not a string or object (e.g., number, boolean), convert to string and encrypt
        encryptedObj[key] = CryptoJS.AES.encrypt(String(value), secretKey).toString();
      }
    }
  }
  return encryptedObj;
}

// Encrypt the service account JSON values
const encryptedServiceAccount = encryptObject(serviceAccount);

// Write the encrypted JSON to a new file
fs.writeFileSync(outputPath, JSON.stringify(encryptedServiceAccount, null, 2));

console.log('Encrypted service account saved to:', outputPath);
