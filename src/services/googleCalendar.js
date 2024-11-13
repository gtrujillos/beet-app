// services/googleCalendar.js

import { google } from "googleapis";
import { MentorAgendaRepository } from "../repositories/mentorAgendaRepository.js";
import { createOAuth2Client, handleTokenRefresh, renewTokenWithRefreshToken } from "../services/googleOAuth.js";
import crypto from "crypto";

async function retryWithRenewToken(callback, companyId, ...args) {
  try {
    return await callback(...args);
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.error("Access token expired, attempting to renew");
      const auth = await renewTokenWithRefreshToken(companyId);
      args[0] = auth; // Replace auth in arguments
      return await callback(...args);
    } else {
      throw err;
    }
  }
}

export async function listEvents(companyId) {
  let auth = await createOAuth2Client(companyId);
  const calendar = google.calendar({ version: "v3", auth });
  const listEventsCallback = async (auth) => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 8);
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      timeMax: maxDate.toISOString(),
      maxResults: 1000,
      singleEvents: true,
      orderBy: "startTime",
    });
    return res.data.items;
  };

  return retryWithRenewToken(listEventsCallback, companyId, auth);
}

export async function addEvent(companyId, eventDetails, appointmentsId, mentorId) {
  let auth = await createOAuth2Client(companyId);
  const calendar = google.calendar({ version: "v3", auth });
  const addEventCallback = async (auth) => {
    const requestId = crypto.randomUUID();
    const event = await calendar.events.insert({
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
    });

    const meetLink = event.data.conferenceData?.entryPoints?.find(entry => entry.entryPointType === "video")?.uri;
    const mentorAgendaRepository = new MentorAgendaRepository();
    const startDateTimeUtc = new Date(eventDetails.startDateTime).toISOString();
    await mentorAgendaRepository.updateAppointment(appointmentsId, 'Agendado', mentorId, meetLink, startDateTimeUtc);

    return event.data;
  };

  return retryWithRenewToken(addEventCallback, companyId, auth);
}

export async function findAvailableMentor(companyId, dateTime, durationMinutes = 60) {
  let auth = await createOAuth2Client(companyId);
  const calendar = google.calendar({ version: "v3", auth });
  const mentorAgendaRepository = new MentorAgendaRepository();

  const findAvailableMentorCallback = async (auth) => {
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
          return event.attendees && event.attendees.some(attendee => attendee.email.toLowerCase() === mentor.Correo_electronico.toLowerCase());
        });

        if (!hasAppointment) {
          return mentor;
        }
      }
    }
    return null;
  };

  return retryWithRenewToken(findAvailableMentorCallback, companyId, auth);
}
