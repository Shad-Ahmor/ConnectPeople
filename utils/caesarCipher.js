// caesarCipher.js
const CaesarCipher = {
    encrypt: (text, shift) => {
      return text.split('')
        .map(char => {
          if (/[a-zA-Z]/.test(char)) {
            const code = char.charCodeAt(0);
            const base = code >= 97 ? 97 : 65; // 'a' or 'A'
            return String.fromCharCode(((code - base + shift) % 26) + base);
          }
          return char; // Non-alphabetic characters are not changed
        })
        .join('');
    },
    decrypt: (text, shift) => {
      return CaesarCipher.encrypt(text, 26 - shift); // Reverse shift for decryption
    }
  };
  
  module.exports = CaesarCipher;
  