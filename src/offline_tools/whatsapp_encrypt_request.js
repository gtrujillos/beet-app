import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

// Read the public key from the PEM file
const publicKey = fs.readFileSync('keys/public.pem', 'utf8');
const { PRIVATE_KEY, PASSPHRASE = "" } = process.env;

// Step 1: Generate AES-128 key (AES-128-GCM)
const aesKey = crypto.randomBytes(16); // AES-128 key (16 bytes)
const iv = crypto.randomBytes(12); // Initialization vector (12 bytes for AES-GCM)

// Example request payload
const flowData = {
  "version": "3.0",
  "action": "INIT",
  "screen": "APPOINTMENT",
  "data": {},
  "flow_token": "abc123xyz456"
};

const flowData2 = {
  "version": "1.0",
  "action": "data_exchange",
  "screen": "APPOINTMENT",
  "data": {
    "department": "beauty",  
    "location": "1", 
    "date": "2024-01-01", 
    "time": "11:30" 
  },
  "flow_token": "abc123xyz456"
};


const flowData4 = {
  "version": "3.0",
  "action": "ping"
};

// Step 2: Encrypt the flow data using AES-128-GCM
const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, iv);
let encryptedFlowData = cipher.update(JSON.stringify(flowData), 'utf8');
encryptedFlowData = Buffer.concat([encryptedFlowData, cipher.final()]);
const authTag = cipher.getAuthTag(); // Get authentication tag for GCM

// Combine encrypted flow data and auth tag
const encryptedFlowDataWithTag = Buffer.concat([encryptedFlowData, authTag]).toString('base64');

// Step 3: Encrypt AES key using RSA public key with OAEP padding and SHA-256
const encryptedAesKey = crypto.publicEncrypt(
  {
    key: publicKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256', // Match the OAEP hash algorithm to SHA-256
  },
  aesKey
).toString('base64');

// Step 4: Create the encrypted request payload
const encryptedRequest = {
  encrypted_flow_data: encryptedFlowDataWithTag, // Encrypted flow data with GCM auth tag
  encrypted_aes_key: encryptedAesKey, // RSA encrypted AES key
  initial_vector: iv.toString('base64'), // Initialization vector
};

console.log(JSON.stringify(encryptedRequest, null, 2));
