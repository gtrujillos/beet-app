// WhatsApp Repository (repositories/whatsappRepository.js)
// --------------------------------------------------
// This file handles database operations related to WhatsApp credentials.

import { getDbConnection } from "../services/dbConnection.js";

export class WhatsAppRepository {
  async getCredentialsByCompanyId(companyId) {
    try {
      const client = await getDbConnection();
      const res = await client.query(
        "SELECT private_key, passphrase, app_secret FROM whatsapp WHERE company_id = $1",
        [companyId]
      );
      client.release();

      if (res.rows.length === 0) {
        throw new Error(`No WhatsApp credentials found for company ID: ${companyId}`);
      }

      return {
        privateKey: res.rows[0].private_key,
        passphrase: res.rows[0].passphrase,
        appSecret: res.rows[0].app_secret,
      };
    } catch (err) {
      console.error("Error fetching WhatsApp credentials", err);
      throw err;
    }
  }
}