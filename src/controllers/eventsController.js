// 8. Events Controller (controllers/eventsController.js)
// --------------------------------------------------
// Handles logic related to Google Calendar events.

import { listEvents, addEvent } from "../services/googleCalendar.js";
import { createOAuth2Client, handleTokenRefresh } from "../services/googleOAuth.js";
import { decrypt } from "../services/beet_encryption.js";

export async function getEvents(req, res) {
  try {
    const encryptedCompanyId = req.params.companyId;
    const companyId = decrypt(encryptedCompanyId);
    const oAuth2Client = await createOAuth2Client(companyId);
    // await handleTokenRefresh(oAuth2Client, companyId);
    const events = await listEvents(oAuth2Client);
    res.json(events);
  } catch (error) {
    console.error("Error retrieving events", error);
    res.status(500).send("Error retrieving events");
  }
}

export async function createEvent(req, res) {
  try {
    const encryptedCompanyId = req.params.companyId;
    const companyId = decrypt(encryptedCompanyId);
    const oAuth2Client = await createOAuth2Client(companyId);
    const event = await addEvent(oAuth2Client, req.body);
    res.json({ message: "Event created successfully", event });
  } catch (error) {
    console.error("Error creating event", error);
    res.status(500).send("Error creating event");
  }
}
