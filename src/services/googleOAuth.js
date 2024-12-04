import { google } from "googleapis";
import dotenv from "dotenv";
import { GoogleAuthRepository } from "../repositories/googleAuthRepository.js";
import { Mutex } from "async-mutex";

dotenv.config();

const googleAuthRepository = new GoogleAuthRepository();
const tokenRefreshMutex = new Mutex(); // Mutex for token refresh

// Create OAuth2 Client for a specific company
export async function createOAuth2Client(companyId, isFirstTime = false) {
  try {
    const clientId = await googleAuthRepository.getClientIdByCompanyId(companyId);
    const clientSecret = await googleAuthRepository.getClientSecretByCompanyId(companyId);
    const redirectUri = await googleAuthRepository.getRedirectUriByCompanyId(companyId);

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    if (!isFirstTime) {
      // Check for tokens if not the first-time authentication
      const token = await googleAuthRepository.getTokensByCompanyId(companyId);
      if (token) {
        await setClientCredentials(oAuth2Client, companyId);
      } else {
        throw new Error("No tokens found. Re-authentication required.");
      }
    } else {
      console.log("First-time authentication: Skipping credential setup.");
    }

    return oAuth2Client;
  } catch (err) {
    console.error("Error creating OAuth2 client", err);
    throw err;
  }
}


// Handle token refresh when new tokens are received
export async function handleTokenRefresh(oAuth2Client, companyId) {
  oAuth2Client.on("tokens", async (tokens) => {
    console.log("Tokens received:", tokens);
    try {
      if (tokens.refresh_token) {
        // Save both access and refresh tokens
        await googleAuthRepository.updateTokensByCompanyId(companyId, tokens);
      } else {
        // Only update the access token
        await googleAuthRepository.updateTokensByCompanyId(companyId, {
          access_token: tokens.access_token,
          expiry_date: tokens.expiry_date,
          scope: tokens.scope,
          token_type: tokens.token_type
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

    console.log("Retrieved token from database:", token);

    if (!token) {
      throw new Error("No tokens found in the database.");
    }

    if (!token.google_access_token && token.google_refresh_token) {
      console.log("Access token missing. Attempting to refresh using refresh token...");
      await refreshTokenWithMutex(oAuth2Client, companyId);
      return; // Exit after refreshing
    }

    if (!token.google_access_token && !token.google_refresh_token) {
      throw new Error("Neither access token nor refresh token found. Re-authentication required.");
    }

    oAuth2Client.setCredentials({
      access_token: token.google_access_token || undefined,
      refresh_token: token.google_refresh_token || undefined,
      scope: token.google_scope || undefined,
      token_type: token.google_token_type || undefined,
      expiry_date: token.google_expiry_date || undefined,
    });

    const expiryThreshold = 300000; // 5 minutes before expiry
    if (Date.now() > (token.google_expiry_date || 0) - expiryThreshold) {
      console.log(`Token about to expire, refreshing for companyId: ${companyId}`);
      await refreshTokenWithMutex(oAuth2Client, companyId);
    }
  } catch (err) {
    console.error("Error setting client credentials", err.message);
    throw err;
  }
}




// Refresh and update token in database
async function refreshAndSetToken(oAuth2Client, companyId) {
  try {
    const response = await oAuth2Client.refreshAccessToken();
    const { credentials } = response;
    console.log("Access token refreshed successfully", credentials);
    await googleAuthRepository.updateTokensByCompanyId(companyId, credentials);
    oAuth2Client.setCredentials(credentials);
  } catch (err) {
    console.error("Error refreshing token", err);
    throw new Error("Failed to refresh token. Re-authentication may be required.");
  }
}

// Use Mutex to avoid race conditions during token refresh
export async function refreshTokenWithMutex(oAuth2Client, companyId) {
  return tokenRefreshMutex.runExclusive(async () => {
    try {
      console.log("Refreshing token for companyId:", companyId);

      // Retrieve tokens from the database
      const token = await googleAuthRepository.getTokensByCompanyId(companyId);

      if (!token || !token.google_refresh_token) {
        throw new Error("No refresh token is set.");
      }

      // Set the refresh token in the OAuth2 client
      oAuth2Client.setCredentials({
        refresh_token: token.google_refresh_token,
      });

      // Attempt to refresh the access token
      const response = await oAuth2Client.refreshAccessToken();
      const { credentials } = response;

      if (!credentials || !credentials.access_token) {
        throw new Error("Failed to retrieve a new access token from Google.");
      }

      console.log("Refreshed credentials:", credentials);

      // Update the database with the new tokens
      await googleAuthRepository.updateTokensByCompanyId(companyId, credentials);

      // Set the new credentials to the OAuth2 client
      oAuth2Client.setCredentials(credentials);

      return oAuth2Client;
    } catch (err) {
      console.error("Error refreshing token:", err.message);
      throw new Error("Failed to refresh token. Re-authentication required.");
    }
  });
}



// Renew token using the refresh token
export async function renewTokenWithRefreshToken(companyId) {
  try {
    console.log("Attempting to renew token using refresh token...");

    // Fetch client and token details
    const clientId = await googleAuthRepository.getClientIdByCompanyId(companyId);
    const clientSecret = await googleAuthRepository.getClientSecretByCompanyId(companyId);
    const redirectUri = await googleAuthRepository.getRedirectUriByCompanyId(companyId);

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const token = await googleAuthRepository.getTokensByCompanyId(companyId);

    if (!token || !token.google_refresh_token) {
      throw new Error("No refresh token found. Re-authentication required.");
    }

    console.log("Using refresh token to renew access token...");
    oAuth2Client.setCredentials({
      refresh_token: token.google_refresh_token,
    });

    const response = await oAuth2Client.refreshAccessToken();
    const { credentials } = response;

    if (!credentials || !credentials.access_token) {
      throw new Error("Failed to retrieve a new access token using the refresh token.");
    }

    console.log("New access token obtained:", credentials);

    // Update the database with the new tokens
    await googleAuthRepository.updateTokensByCompanyId(companyId, credentials);

    // Set the refreshed credentials to the OAuth2 client
    oAuth2Client.setCredentials(credentials);

    return oAuth2Client; // Return the updated client
  } catch (err) {
    console.error("Error renewing token using refresh token:", err.message);
    throw err;
  }
}



