// 7. Events Routes - Handle Event-Related Logic (routes/events.js)
// --------------------------------------------------
// This file should include all endpoints related to Google Calendar events.

import express from "express";
import { getEvents, createEvent } from "../controllers/eventsController.js";

const router = express.Router();

// Updated routes to include the encrypted companyId parameter
router.get("/:companyId", getEvents);
router.post("/:companyId/add", createEvent);

export default router;