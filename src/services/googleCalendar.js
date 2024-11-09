// services/googleCalendar.js

import { google } from "googleapis";
import { MentorAgendaRepository } from "../repositories/mentorAgendaRepository.js";
import { createOAuth2Client, handleTokenRefresh, renewTokenWithRefreshToken } from "../services/googleOAuth.js";
import crypto from "crypto";

export async function listEvents(companyId) {
  let auth = await createOAuth2Client(companyId);
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
    if (err.response && err.response.status === 401) {
      // Token expired, renew using refresh token
      console.error("Access token expired, attempting to renew");
      auth = await renewTokenWithRefreshToken(companyId);
      const calendar = google.calendar({ version: "v3", auth });

      // Retry the request
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
    } else {
      console.error("The API returned an error:", err);
      throw new Error("Error loading events");
    }
  }
}

export async function addEvent(companyId, eventDetails, appointmentsId, mentorId) {
  let auth = await createOAuth2Client(companyId);
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

    const meetLink = event.data.conferenceData?.entryPoints?.find(entry => entry.entryPointType === "video")?.uri;
    const mentorAgendaRepository = new MentorAgendaRepository();
    const startDateTimeUtc = new Date(eventDetails.startDateTime).toISOString();
    await mentorAgendaRepository.updateAppointment(appointmentsId, 'Agendado', mentorId, meetLink, startDateTimeUtc);

    return event.data;
  } catch (err) {
    if (err.response && err.response.status === 401) {
      // Token expired, renew using refresh token
      console.error("Access token expired, attempting to renew");
      auth = await renewTokenWithRefreshToken(companyId);
      const calendar = google.calendar({ version: "v3", auth });

      // Retry adding the event
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

      const meetLink = event.data.conferenceData?.entryPoints?.find(entry => entry.entryPointType === "video")?.uri;
      const mentorAgendaRepository = new MentorAgendaRepository();
      const startDateTimeUtc = new Date(eventDetails.startDateTime).toISOString();
      await mentorAgendaRepository.updateAppointment(appointmentsId, 'Agendado', mentorId, meetLink, startDateTimeUtc);

      return event.data;
    } else {
      console.error("Error adding event to Google Calendar:", err);
      throw err;
    }
  }
}

export async function findAvailableMentor(companyId, dateTime, durationMinutes = 60) {
  let auth = await createOAuth2Client(companyId);
  const calendar = google.calendar({ version: "v3", auth });
  const mentorAgendaRepository = new MentorAgendaRepository();

  try {
    // Get list of events for the given date and time
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
    

    

    // Get all mentors
    const mentors = await mentorAgendaRepository.getAllMentors();
    
    if(dateTime === '2024-11-08T19:00:00-05:00'){
      //console.log('dateTime', dateTime);
      //console.log('eventsOnDateTime', eventsOnDateTime);
      //console.log('mentors', mentors);
    }
    
    // console.log('eventsOnDateTime', eventsOnDateTime);

    // Find the first mentor without an appointment overlapping the given date and time
    for (const mentor of mentors) {
      if (mentor.Correo_electronico) {        
        const hasAppointment = eventsOnDateTime.some((event) => {
           console.log('event.attendees', event.attendees);
          return event.attendees && event.attendees.some(attendee => attendee.email.toLowerCase() === mentor.Correo_electronico.toLowerCase());
        });
        
        // console.log('mentor.Correo_electronico', mentor.Correo_electronico);
        
        // console.log('hasAppointment', eventsOnDateTime);
        // console.log('hasAppointment', hasAppointment); 
        
        if(dateTime === '2024-11-08T19:00:00-05:00'){
          //console.log('dateTime', dateTime);
          //console.log('hasAppointment', hasAppointment);
          //console.log('mentor', mentor);
        }

        if (!hasAppointment) {
          //console.log('mentor', mentor); 
          return mentor;
        }
      }
    }

    // If all mentors have appointments on the given date and time, return null
    return null;
  } catch (err) {
    if (err.response && err.response.status === 401) {
      // Token expired, renew using refresh token
      console.error("Access token expired, attempting to renew");
      auth = await renewTokenWithRefreshToken(companyId);
      const calendar = google.calendar({ version: "v3", auth });

      // Retry finding the available mentor
      return findAvailableMentor(companyId, dateTime, durationMinutes);
    } else {
      console.error("Error finding available mentor", err);
      throw new Error("Error finding available mentor");
    }
  }
}