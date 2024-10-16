import crypto from "crypto";
import { WhatsAppRepository } from "../repositories/whatsappRepository.js";
import { decrypt } from "../services/beet_encryption.js";

const whatsAppRepository = new WhatsAppRepository();

export async function isRequestSignatureValid(req) {
  try {
    const encryptedCompanyId = req.params.companyId;
    if (!encryptedCompanyId) {
      console.warn("Company ID is missing in the request.");
      return false;
    }

    const companyId = decrypt(encryptedCompanyId);

    // console.log('companyId', companyId);
    // console.log('encryptedCompanyId', encryptedCompanyId);

    const { appSecret } = await whatsAppRepository.getCredentialsByCompanyId(companyId);

    // console.log('appSecret', appSecret);

    if (!appSecret) {
      console.warn("App Secret is not set up. Please add your app secret to the database to check for request validation.");
      return true;
    }

    const signatureHeader = req.get("x-hub-signature-256");
    const signatureBuffer = Buffer.from(signatureHeader.replace("sha256=", ""), "utf-8");
    const hmac = crypto.createHmac("sha256", appSecret);
    const digestString = hmac.update(req.rawBody).digest("hex");
    const digestBuffer = Buffer.from(digestString, "utf-8");

    if (!crypto.timingSafeEqual(digestBuffer, signatureBuffer)) {
      console.error("Error: Request signature did not match.");
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error validating request signature", err);
    return false;
  }
}