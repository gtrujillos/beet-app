// GoogleAuthRepository (repositories/googleAuthRepository.js)
// --------------------------------------------------
// This file handles database operations related to Google OAuth configuration and tokens.

import { getDbConnection } from "../services/dbConnection.js";

export class GoogleAuthRepository {
  async getClientIdByCompanyId(companyId) {
    try {
      const client = await getDbConnection();
      const res = await client.query(
        "SELECT google_client_id FROM google_access_data WHERE company_id = $1",
        [companyId]
      );
      client.release();
      return res.rows[0]?.google_client_id;
    } catch (err) {
      console.error("Error fetching client ID", err);
      throw err;
    }
  }

  async getClientSecretByCompanyId(companyId) {
    try {
      const client = await getDbConnection();
      const res = await client.query(
        "SELECT google_client_secret FROM google_access_data WHERE company_id = $1",
        [companyId]
      );
      client.release();
      return res.rows[0]?.google_client_secret;
    } catch (err) {
      console.error("Error fetching client secret", err);
      throw err;
    }
  }

  async getRedirectUriByCompanyId(companyId) {
    try {
      const client = await getDbConnection();
      const res = await client.query(
        "SELECT google_redirect_uri FROM google_access_data WHERE company_id = $1",
        [companyId]
      );
      client.release();
      return res.rows[0]?.google_redirect_uri;
    } catch (err) {
      console.error("Error fetching redirect URI", err);
      throw err;
    }
  }

  async updateTokensByCompanyId(companyId, tokens) {
    try {
      const client = await getDbConnection();
      const query = {
        text: `UPDATE google_access_data SET google_access_token = $1, google_refresh_token = COALESCE($2, google_refresh_token), google_expiry_date = $3, google_token_type = $4, google_scope = $5 WHERE company_id = $6`,
        values: [
          tokens.access_token,
          tokens.refresh_token || null,
          tokens.expiry_date,
          tokens.token_type,
          tokens.scope,
          companyId,
        ],
      };
      await client.query(query);
      client.release();
    } catch (err) {
      console.error("Error updating tokens in the database", err);
      throw err;
    }
  }

  async getTokensByCompanyId(companyId) {
    try {
      const client = await getDbConnection();
      const res = await client.query(
        "SELECT google_access_token, google_refresh_token, google_expiry_date, google_token_type, google_scope FROM google_access_data WHERE company_id = $1",
        [companyId]
      );
      client.release();
      return res.rows[0] || null;
    } catch (err) {
      console.error("Error fetching tokens", err);
      throw err;
    }
  }

}
