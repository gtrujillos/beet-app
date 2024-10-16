import { decryptRequest, encryptResponse, FlowEndpointException } from "../utils/encryption.js";
import { getNextScreen } from "../services/flow.js";
import { isRequestSignatureValid } from "../utils/validateSignature.js";
import { decrypt } from "../services/beet_encryption.js";
import { WhatsAppRepository } from "../repositories/whatsappRepository.js";
import dotenv from "dotenv";

dotenv.config();

const whatsAppRepository = new WhatsAppRepository();

export async function handleWhatsAppFlow(req, res) {
  if (!isRequestSignatureValid(req)) {
    return res.status(432).send();
  }

  try {
    const encryptedCompanyId = req.params.companyId;
    if (!encryptedCompanyId) {
      console.log("Company ID is missing in the request.");
      return res.status(400).send("Company ID is required.");
    }

    const companyId = decrypt(encryptedCompanyId);
    const { privateKey, passphrase } = await whatsAppRepository.getCredentialsByCompanyId(companyId);

    // console.log('privateKey1', privateKey);
    // console.log('passphrase1', passphrase);

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptRequest(req.body, privateKey, passphrase);
    const screenResponse = await getNextScreen(decryptedBody, companyId);
    const encryptedResponse = encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer);
    res.send(encryptedResponse.toString("base64"));
  } catch (err) {
    console.error("Error processing WhatsApp Flow", err);
    res.status(500).send("Processing error");
  }
}