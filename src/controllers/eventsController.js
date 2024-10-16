// 8. Events Controller (controllers/eventsController.js)
// --------------------------------------------------
// Handles logic related to Google Calendar events.

import { listEvents, addEvent, findAvailableMentor } from "../services/googleCalendar.js";
// import { createOAuth2Client, handleTokenRefresh } from "../services/googleOAuth.js";
import { decrypt } from "../services/beet_encryption.js";

export async function getEvents(req, res) {
  try {
    const encryptedCompanyId = req.params.companyId;
    const companyId = decrypt(encryptedCompanyId);
    // const oAuth2Client = await createOAuth2Client(companyId);
    // await handleTokenRefresh(oAuth2Client, companyId);
    const events = await listEvents(companyId);
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
    // const oAuth2Client = await createOAuth2Client(companyId);
    const event = await addEvent(companyId, req.body);
    res.json({ message: "Event created successfully", event });
  } catch (error) {
    console.error("Error creating event", error);
    res.status(500).send("Error creating event");
  }
}

export async function getAvailableMentor(req, res) {
  try {
    const encryptedCompanyId = req.params.companyId;
    const companyId = decrypt(encryptedCompanyId);
    const { date } = req.body;
    const availableMentor = await findAvailableMentor(companyId, date);
    if (availableMentor) {
      res.json({ mentor: availableMentor });
    } else {
      // res.status(404).send("No available mentor found for the given date");
      res.json({ mentor: null });
    }
  } catch (error) {
    console.error("Error finding available mentor", error);
    res.status(500).send("Error finding available mentor");
  }
}
