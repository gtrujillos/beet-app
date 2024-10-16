import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const { APP_SECRET } = process.env;

// The exact payload being sent in the cURL request
const payload = `{
  "encrypted_flow_data": "xU7/LtGvdUmamEzR17NjOXA/B7xXkBw1WaGsTwbsiiJ13aQXh41uIviY25EunWYGMTv0BPdVfVvqgYC1HrxzxLmkYSfulSiPRJk+wnFCVWjvZEWvynuQSUIl2YaFFzhFPimCz3RLjhVjR8xLxw4=",
  "encrypted_aes_key": "EWDgFAyRQN6KcbWxUm4H99bfJRBpgwSm0x2KhvIHfUZYtlWvK89OXOaJpCnQxXnwIahfKRP/sDqfBqyEYALvuQgK1a8OU1jsUq8jWV0+sDy1OeK/4pshZhm8X9xAedQfB5inB9wfwGMSb2/ligRh+77HAGlk3HwQDf8qt9n/2gTgc7RAGZBp431AImlQ27ezI/9uadWp0qF6GuNqCdzF5XFptwa/0k3w/6LnYJEl8jGLWGIkmDRe6vQXN3pMrqTjGlmsiMOqE2wHfq6JNxVa0/XGM0OUaGcbSB1DFxM39gFMO66cUfXPzsyTlLbYgvmLCkVvIYi37ly7gqibctVQ6g==",
  "initial_vector": "gBHokfBRXGjLkg/u"
}`;

// Function to generate the HMAC-SHA256 signature
function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const signature = hmac.digest('hex');
  return `sha256=${signature}`;
}

// Generate the signature using the APP_SECRET and the exact payload
const signature = generateSignature(payload, APP_SECRET);

// Log the generated signature
console.log("Generated Signature:", signature);
