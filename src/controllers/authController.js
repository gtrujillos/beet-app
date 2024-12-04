// 6. Auth Controller (controllers/authController.js)
// --------------------------------------------------
// Handles logic related to Google OAuth.

import { createOAuth2Client, handleTokenRefresh } from "../services/googleOAuth.js";
import { GoogleAuthRepository } from "../repositories/googleAuthRepository.js";
import { decrypt } from "../services/beet_encryption.js";
import { google } from "googleapis";

const googleAuthRepository = new GoogleAuthRepository();

export async function getAuthUrl(req, res) {
  req.bypassTokenValidation = true;
  const encryptedCompanyId = req.params.companyId;

  try {
    const companyId = decrypt(encryptedCompanyId);

    // Set isFirstTime to true for initial authentication
    const oAuth2Client = await createOAuth2Client(companyId, true);

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline", // Request offline access for refresh token
      prompt: "consent", // Ensure consent screen appears for first-time login
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
  req.bypassTokenValidation = true; // Skip token validation middleware for this endpoint
  const encryptedCompanyId = req.params.companyId;
  const code = req.query.code;

  try {
    const companyId = decrypt(encryptedCompanyId);

    // Fetch client details for this company
    const clientId = await googleAuthRepository.getClientIdByCompanyId(companyId);
    const clientSecret = await googleAuthRepository.getClientSecretByCompanyId(companyId);
    const redirectUri = await googleAuthRepository.getRedirectUriByCompanyId(companyId);

    // Create a new OAuth2 client (no tokens set yet)
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Exchange the authorization code for tokens
    const { tokens } = await oAuth2Client.getToken(code);
    console.log("Tokens received:", tokens);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to retrieve valid tokens from Google.");
    }

    // Save the tokens in the database
    await googleAuthRepository.updateTokensByCompanyId(companyId, tokens);
    console.log("Tokens stored successfully for company_id:", companyId);

    res.redirect("/"); // Redirect to a relevant success page
  } catch (err) {
    console.error("Error during OAuth callback", err.message);
    res.status(500).send(`Authentication failed: ${err.message}`);
  }
}

