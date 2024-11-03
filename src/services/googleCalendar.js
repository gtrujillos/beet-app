// services/googleCalendar.js

import { google } from "googleapis";
import { MentorAgendaRepository } from "../repositories/mentorAgendaRepository.js";
import { createOAuth2Client, handleTokenRefresh } from "../services/googleOAuth.js";
import crypto from "crypto";

export async function listEvents(companyId) {
  const auth = await createOAuth2Client(companyId);
  const calendar = google.calendar({ version: "v3", auth });
  try {
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
  } catch (err) {
    console.error("The API returned an error:", err);
    throw new Error("Error loading events");
  }
}

export async function addEvent(companyId, eventDetails, appointmentsId, mentorId) {
  const auth = await createOAuth2Client(companyId);
  const calendar = google.calendar({ version: "v3", auth });
  try {
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
          },
        },
        visibility: "public"
      },
    });

    // Notify attendees with the meeting link
    const meetLink = event.data.conferenceData?.entryPoints?.find(entry => entry.entryPointType === "video")?.uri;
    if (meetLink) {
      // console.log("Google Meet link:", meetLink);
      // Here you can add code to send notification to attendees with the meeting link
    }

    const mentorAgendaRepository = new MentorAgendaRepository();
    const startDateTimeUtc = new Date(eventDetails.startDateTime).toISOString();
    await mentorAgendaRepository.updateAppointment(appointmentsId, 'Agendado', mentorId, meetLink, startDateTimeUtc);

    return event.data;
  } catch (err) {
    console.error("Error adding event to Google Calendar:", err);
    throw err;
  }
}

export async function findAvailableMentor(companyId, dateTime) {
  const auth = await createOAuth2Client(companyId);
  const calendar = google.calendar({ version: "v3", auth });
  const mentorAgendaRepository = new MentorAgendaRepository();

  // console.log('dateTime:' + dateTime);
  
  
  try {
    // Get list of events for the given date and time
    const events = await listEvents(companyId);
    
    // console.log('events:', events);
    
    const eventsOnDateTime = events.filter((event) => {
      if (event.start && event.start.dateTime) {
        
        // console.log('d1:', event.start.dateTime);
        // console.log('d2:', dateTime);
        
        
        const eventStart = new Date(event.start.dateTime).toISOString();
        const providedDateTime = new Date(dateTime).toISOString();
        
        // console.log('eventStart:', eventStart);
        // console.log('providedDateTime:', providedDateTime);
        
        
        return eventStart === providedDateTime;
      }
      return false;
    });
     
    //console.log('d2:', dateTime);
    //console.log('eventsOnDateTime:', eventsOnDateTime);
    
    // Get all mentors
    const mentors = await mentorAgendaRepository.getAllMentors();
    // console.log('mentors:', mentors);
    

    // Find the first mentor without an appointment on the given date and time
    for (const mentor of mentors) {
      if (mentor.Correo_electronico) {
        const hasAppointment = eventsOnDateTime.some(event =>
          event.attendees && event.attendees.some(attendee => attendee.email === mentor.Correo_electronico)
        );

        if (!hasAppointment) {
          return mentor;
        }
      }
    }

    // If all mentors have appointments on the given date and time, return null
    return null;
  } catch (err) {
    console.error("Error finding available mentor", err);
    throw new Error("Error finding available mentor");
  }
}