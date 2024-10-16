// 6. Auth Controller (controllers/authController.js)
// --------------------------------------------------
// Handles logic related to Google OAuth.

import { createOAuth2Client, handleTokenRefresh } from "../services/googleOAuth.js";
import { GoogleAuthRepository } from "../repositories/googleAuthRepository.js";
import { decrypt } from "../services/beet_encryption.js";

const googleAuthRepository = new GoogleAuthRepository();

export async function getAuthUrl(req, res) {
  // Bypass ensureTokenIsValid middleware for this endpoint
  req.bypassTokenValidation = true;
  const encryptedCompanyId = req.params.companyId;

  try {
    const companyId = decrypt(encryptedCompanyId);
    const oAuth2Client = await createOAuth2Client(companyId);
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/calendar"],
    });

    console.log("Authorize this app by visiting this URL for company_id:", companyId, authUrl);
    res.redirect(authUrl);
  } catch (err) {
    console.error("Error generating auth URL", err);
    res.status(500).send("Failed to generate authentication URL.");
  }
}

export async function handleOAuthCallback(req, res) {
  // Bypass ensureTokenIsValid middleware for this endpoint
  req.bypassTokenValidation = true;
  const encryptedCompanyId = req.params.companyId;
  const code = req.query.code;

  try {
    const companyId = decrypt(encryptedCompanyId);
    const oAuth2Client = await createOAuth2Client(companyId);
    oAuth2Client.getToken(code, async (err, token) => {
      if (err) {
        console.error("Error retrieving access token", err);
        return res.status(500).send("Authentication failed");
      }

      if (!token) {
        console.error("Received empty token.");
        return res.status(500).send("Authentication failed: received empty token.");
      }

      try {
        await googleAuthRepository.updateTokensByCompanyId(companyId, token);
        console.log("Token stored in the database for company_id:", companyId);
        oAuth2Client.setCredentials(token);
        // await handleTokenRefresh(oAuth2Client, companyId);
        res.redirect("/"); // Redirect to the home page or a relevant page after successful authentication
      } catch (dbErr) {
        console.error("Error saving token to the database", dbErr);
        return res.status(500).send("Failed to save authentication token.");
      }
    });
  } catch (err) {
    console.error("Error during OAuth callback", err);
    res.status(500).send("Authentication failed.");
  }
}
