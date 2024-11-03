// 11. Google OAuth Service with Repository Pattern (services/googleOAuth.js)
// --------------------------------------------------
// This file manages Google OAuth related configuration using PostgreSQL database through a repository.

import { google } from "googleapis";
import dotenv from "dotenv";
import { GoogleAuthRepository } from "../repositories/googleAuthRepository.js";

dotenv.config();

const googleAuthRepository = new GoogleAuthRepository();

export async function createOAuth2Client(companyId) {
  try {
    const clientId = await googleAuthRepository.getClientIdByCompanyId(companyId);
    const clientSecret = await googleAuthRepository.getClientSecretByCompanyId(companyId);
    const redirectUri = await googleAuthRepository.getRedirectUriByCompanyId(companyId);

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    await setClientCredentials(oAuth2Client, companyId);

    handleTokenRefresh(oAuth2Client, companyId); // Link token refresh handler

    return oAuth2Client;
  } catch (err) {
    console.error("Error creating OAuth2 client", err);
    throw err;
  }
}

// Example usage of updating tokens in the database when tokens are refreshed
export async function handleTokenRefresh(oAuth2Client, companyId) {
  oAuth2Client.on("tokens", async (tokens) => {
    console.log("tokens", tokens);
    try {
      if (tokens.refresh_token) {
        // Save both access and refresh tokens
        await googleAuthRepository.updateTokensByCompanyId(companyId, tokens);
      } else {
        // Only update the access token
        await googleAuthRepository.updateTokensByCompanyId(companyId, {
          access_token: tokens.access_token,
          expiry_date: tokens.expiry_date,
        });
      }
    } catch (err) {
      console.error("Error updating tokens in the database", err);
    }
  });
}

// Set credentials for OAuth2Client
export async function setClientCredentials(oAuth2Client, companyId) {
  try {
    const token = await googleAuthRepository.getTokensByCompanyId(companyId);
    if (token && token.google_access_token) {
      oAuth2Client.setCredentials({
        access_token: token.google_access_token,
        refresh_token: token.google_refresh_token || undefined,
        scope: token.google_scope || undefined,
        token_type: token.google_token_type || undefined,
        expiry_date: token.google_expiry_date || undefined,
      });

      // Attempt to refresh the token if it's expired or close to expiring
      if (Date.now() > token.google_expiry_date - 60000) { // Refresh if expiry is within 1 minute
        try {
          const response = await oAuth2Client.refreshAccessToken();
          const { credentials } = response;
          console.log("Access token refreshed successfully", credentials);
          await googleAuthRepository.updateTokensByCompanyId(companyId, credentials);
          oAuth2Client.setCredentials(credentials); // Update OAuth client with new credentials
        } catch (refreshError) {
          console.error("Error refreshing access token", refreshError);
          throw new Error("Authentication required. Please re-authenticate.");
        }
      }
    }
  } catch (err) {
    console.error("Error setting client credentials", err);
    throw err;
  }
}

