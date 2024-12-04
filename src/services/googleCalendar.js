import { google } from "googleapis";
import { createOAuth2Client, renewTokenWithRefreshToken } from "../services/googleOAuth.js";
import { MentorAgendaRepository } from "../repositories/mentorAgendaRepository.js";
import crypto from "crypto";

async function retryWithRenewToken(callback, companyId, ...args) {
  console.log("retryWithRenewToken");

  try {
    return await callback(...args); // Initial attempt
  } catch (err) {
    console.log("retryWithRenewToken error:", err.message);

    // Check for 401 Unauthorized errors
    if (err.response && err.response.status === 401) {
      console.error("Access token expired or invalid. Attempting to renew...");

      try {
        // Refresh the token
        const refreshedAuth = await renewTokenWithRefreshToken(companyId);

        console.log("Token refreshed. Retrying the request...");

        // Retry the callback with the refreshed `OAuth2Client`
        return await callback(refreshedAuth, ...args.slice(1));
      } catch (refreshErr) {
        console.error("Error refreshing token during retry:", refreshErr.message);
        throw new Error("Failed to refresh token. Re-authentication required.");
      }
    } else {
      console.error("Unhandled error in retryWithRenewToken:", err.message);
      throw err;
    }
  }
}

export async function listEvents(companyId) {
  console.log("listEvents");

  let auth = await createOAuth2Client(companyId);

  return retryWithRenewToken(async (auth) => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 8);

    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      timeMax: maxDate.toISOString(),
      maxResults: 1000,
      singleEvents: true,
      orderBy: "startTime",
    });

    return res.data.items;
  }, companyId, auth);
}

export async function addEvent(companyId, eventDetails, appointmentsId, mentorId) {
  let auth = await createOAuth2Client(companyId);

  return retryWithRenewToken(async (auth) => {
    const calendar = google.calendar({ version: "v3", auth });
    const requestId = crypto.randomUUID();

    var eventData = {
      calendarId: "primary",
      conferenceDataVersion: 1,
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
        conferenceData: {
          createRequest: {
            requestId: requestId,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
            status: {
              statusCode: "success",
            },
          },
        },
        visibility: "public",
        anyoneCanAddSelf: true,
      },
    };

    console.log("eventData");

    const event = await calendar.events.insert(eventData);

    const meetLink = event.data.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === "video"
    )?.uri;

    const mentorAgendaRepository = new MentorAgendaRepository();
    const startDateTimeUtc = new Date(eventDetails.startDateTime).toISOString();
    await mentorAgendaRepository.updateAppointment(
      appointmentsId,
      "Agendado",
      mentorId,
      meetLink,
      startDateTimeUtc
    );

    return event.data;
  }, companyId, auth);
}

export async function findAvailableMentor(companyId, dateTime, durationMinutes = 60) {
  let auth = await createOAuth2Client(companyId);

  return retryWithRenewToken(async (auth) => {
    const calendar = google.calendar({ version: "v3", auth });
    const mentorAgendaRepository = new MentorAgendaRepository();

    const events = await listEvents(companyId);
    const eventStartDateTime = new Date(dateTime);
    const eventEndDateTime = new Date(eventStartDateTime.getTime() + durationMinutes * 60000);

    const eventsOnDateTime = events.filter((event) => {
      if (event.start && event.start.dateTime && event.end && event.end.dateTime) {
        const existingEventStart = new Date(event.start.dateTime);
        const existingEventEnd = new Date(event.end.dateTime);

        // Check if the new event overlaps with any existing events
        return (
          (eventStartDateTime >= existingEventStart && eventStartDateTime < existingEventEnd) ||
          (eventEndDateTime > existingEventStart && eventEndDateTime <= existingEventEnd) ||
          (eventStartDateTime <= existingEventStart && eventEndDateTime >= existingEventEnd)
        );
      }
      return false;
    });

    const mentors = await mentorAgendaRepository.getAllMentors();

    // Find the first mentor without an appointment overlapping the given date and time
    for (const mentor of mentors) {
      if (mentor.Correo_electronico) {
        const hasAppointment = eventsOnDateTime.some((event) => {
          return (
            event.attendees &&
            event.attendees.some(
              (attendee) =>
                attendee.email.toLowerCase() === mentor.Correo_electronico.toLowerCase()
            )
          );
        });

        if (!hasAppointment) {
          return mentor;
        }
      }
    }

    return null;
  }, companyId, auth);
}
