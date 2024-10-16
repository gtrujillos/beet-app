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
      await googleAuthRepository.updateTokensByCompanyId(companyId, tokens);
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
    }
  } catch (err) {
    console.error("Error setting client credentials", err);
    throw err;
  }
}