import { google } from "googleapis";

export async function listEvents(auth) {
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

// export async function listEvents(auth) {

//   // console.log('listEvents auth', auth);

//   const calendar = google.calendar({ version: 'v3', auth });
//   try {
//     const res = await calendar.events.list({
//       calendarId: 'primary',
//       timeMin: (new Date()).toISOString(),
//       maxResults: 10,
//       singleEvents: true,
//       orderBy: 'startTime',
//     });
//     return res.data.items;
//   } catch (err) {
//     console.error('The API returned an error:', err);
//     throw new Error('Error loading events');
//   }
// }

export async function addEvent(auth, eventDetails) {
  const calendar = google.calendar({ version: "v3", auth });
  try {
    const event = await calendar.events.insert({
      calendarId: "primary",
      resource: {
        summary: eventDetails.summary,
        description: eventDetails.description,
        start: {
          dateTime: eventDetails.startDateTime,
          timeZone: eventDetails.timeZone || "America/Los_Angeles",
        },
        end: {
          dateTime: eventDetails.endDateTime,
          timeZone: eventDetails.timeZone || "America/Los_Angeles",
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