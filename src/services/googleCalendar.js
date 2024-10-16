import { google } from "googleapis";
import { MentorAgendaRepository } from "../repositories/mentorAgendaRepository.js";
import { createOAuth2Client, handleTokenRefresh } from "../services/googleOAuth.js";

export async function listEvents(companyId) {
  const auth = await createOAuth2Client(companyId);
  const calendar = google.calendar({ version: "v3", auth });
  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });
    return res.data.items;
  } catch (err) {
    console.error("The API returned an error:", err);
    throw new Error("Error loading events");
  }
}

export async function addEvent(companyId) {
  const auth = await createOAuth2Client(companyId);
  const calendar = google.calendar({ version: "v3", auth });
  try {
    const event = await calendar.events.insert({
      calendarId: "primary",
      resource: {
        summary: eventDetails.summary,
        description: eventDetails.description,
        start: {
          dateTime: eventDetails.startDateTime,
          timeZone: eventDetails.timeZone || "America/Bogota",
        },
        end: {
          dateTime: eventDetails.endDateTime,
          timeZone: eventDetails.timeZone || "America/Bogota",
        },
        attendees: eventDetails.attendees || [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 10 },
          ],
        },
      },
    });
    return event.data;
  } catch (err) {
    console.error("Error adding event to Google Calendar:", err);
    throw err;
  }
}

export async function findAvailableMentor(companyId, date) {
  const auth = await createOAuth2Client(companyId);
  const calendar = google.calendar({ version: "v3", auth });
  const mentorAgendaRepository = new MentorAgendaRepository();

  try {
    // Get list of events for the given date
    const events = await listEvents(companyId);
    const eventsOnDate = events.filter(event =>
      new Date(event.start.dateTime).toISOString().split('T')[0] === date
    );

    // Get all mentors
    const mentors = await mentorAgendaRepository.getAllMentors();

    // Find the first mentor without an appointment on the given date
    for (const mentor of mentors) {
      const hasAppointment = eventsOnDate.some(event =>
        event.attendees && event.attendees.some(attendee => attendee.email === mentor.Correo_electronico)
      );
      if (!hasAppointment) {
        return mentor.Correo_electronico;
      }
    }

    // If all mentors have appointments on the given date, return null
    return null;
  } catch (err) {
    console.error("Error finding available mentor", err);
    throw new Error("Error finding available mentor");
  }
}