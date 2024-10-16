// 3. Ensure Token Middleware (middleware/ensureTokenIsValid.js)
// --------------------------------------------------
// Middleware to check if the token is still valid and refresh if necessary.

import { createOAuth2Client, setClientCredentials } from "../services/googleOAuth.js";
import { decrypt } from "../services/beet_encryption.js";

export async function ensureTokenIsValid(req, res, next) {
  try {
    const encryptedCompanyId = req.params.companyId;
    if (!encryptedCompanyId) {
      console.log("Company ID is missing in the request.");
      return res.status(400).send("Company ID is required.");
    }

    const companyId = decrypt(encryptedCompanyId);
    const oAuth2Client = await createOAuth2Client(companyId);

    // Attempt to refresh the access token if needed
    const newToken = await oAuth2Client.getAccessToken();

    if (!newToken.token) {
      console.log("Failed to refresh the token. Please authenticate again.");
      return res.status(401).send("Please authenticate via /auth.");
    }

    next();  // Proceed to the next middleware or route handler
  } catch (err) {
    console.log('Error with token, please authenticate again via /auth:', err);
    res.status(401).send('Please authenticate via /auth.');
  }
}