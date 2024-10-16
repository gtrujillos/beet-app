// 9. WhatsApp Routes - Handle WhatsApp Flow Logic (routes/whatsapp.js)
// --------------------------------------------------

import express from "express";
import { handleWhatsAppFlow } from "../controllers/whatsappController.js";

const router = express.Router();

// Receive companyId as a route parameter
router.post('/:companyId', handleWhatsAppFlow);

export default router;