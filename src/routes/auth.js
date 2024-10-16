// 5. Auth Routes - Handle OAuth Logic (routes/auth.js)
// --------------------------------------------------
// This file should include all endpoints related to Google OAuth authentication.

import express from "express";
import { getAuthUrl, handleOAuthCallback } from "../controllers/authController.js";

const router = express.Router();

// No token validation middleware for these routes
router.get("/:companyId", getAuthUrl);
router.get("/:companyId/oauth2callback", handleOAuthCallback);

export default router;