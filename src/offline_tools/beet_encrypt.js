// Encryption Script Example beet_encrypt.js
// --------------------------------------------------
// Demonstrates how to use the encryption service to encrypt and decrypt data from command line arguments.

import { encrypt, decrypt } from "../services/beet_encryption.js";

const action = process.argv[2];
const text = process.argv[3];

if (!action || !text) {
  console.error("Usage: node beet_encrypt.js <encrypt|decrypt> \"your_text_here\"");
  process.exit(1);
}

try {
  if (action === "encrypt") {
    const encryptedText = encrypt(text);
    console.log("Encrypted Text:", encryptedText);
  } else if (action === "decrypt") {
    const decryptedText = decrypt(text);
    console.log("Decrypted Text:", decryptedText);
  } else {
    console.error("Invalid action. Use 'encrypt' or 'decrypt'.");
    process.exit(1);
  }
} catch (error) {
  console.error("Error during encryption/decryption process:", error);
  process.exit(1);
}