// Events service (services/flow.js)

import { findAvailableMentor } from "../services/googleCalendar.js";
import { addEvent } from "../services/googleCalendar.js";
import { MentorAgendaRepository } from "../repositories/mentorAgendaRepository.js";
import moment from 'moment-timezone';

// this object is generated from Flow Builder under "..." > Endpoint > Snippets > Responses
let SCREEN_RESPONSES = {};

export const fillData = () => {
  SCREEN_RESPONSES = {
    APPOINTMENT: {
      screen: "APPOINTMENT",
      data: {
        date: (() => {
          const result = [];
          const bogotaTimeZone = 'America/Bogota';

          // Get the current date and time in the Bogotá time zone
          const today = moment.tz(bogotaTimeZone);

          // Include today if it's not Sunday
          if (today.day() !== 0) { // 0 represents Sunday
            result.push({
              id: today.format('YYYY-MM-DD'), // Get the date in ISO format
              title: today.format('dddd, D [de] MMMM [de] YYYY'), // Format in Spanish
            });
          }

          // Collect dates for the next 13 days, excluding Sundays
          for (let i = 1; i <= 13; i++) {
            const date = today.clone().add(i, 'days'); // Clone today and add i days

            if (date.day() !== 0) { // Exclude Sundays (0 represents Sunday)
              result.push({
                id: date.format('YYYY-MM-DD'), // Get the date in ISO format
                title: date.format('dddd, D [de] MMMM [de] YYYY'), // Format in Spanish
              });
            }
          }

          // console.log('days: ', result)

          return result.slice(0, 4); // Return the first 4 dates
        })(),
        is_date_enabled: true,
        time: Array.from({ length: 13 }, (_, i) => {
          const hour = 8 + i;
          const amPmHour = hour <= 12 ? hour : hour - 12;
          const period = hour < 12 ? 'AM' : 'PM';
          const hourId = hour < 10 ? `0${hour}:00` : `${hour}:00`; 
          return {
            id: hourId,
            title: `${amPmHour}:00 ${period}`,
            enabled: true,
          };
        }),
        appointment: "Mon Jan 13 2024 at 11:30.",
        is_time_enabled: false,
      },
    },
    DETAILS: {
      screen: "DETAILS",
      data: {
        date: "2024-01-01",
        time: "11:30",
      },
    },
    SUMMARY: {
      screen: "SUMMARY",
      data: {
        appointment: "Mon Jan 11 2024 at 11:30.",
        details: "Name: John Doe\nEmail: john@example.com\nPhone: 123456789\n\nA free skin care consultation, please",
        date: "2024-01-01",
        time: "11:30",
        name: "John Doe",
        email: "john@example.com",
        phone: "123456789",
        more_details: "A free skin care consultation, please",
      },
    },
    TERMS: {
      screen: "TERMS",
      data: {},
    },
    SUCCESS: {
      screen: "SUCCESS",
      data: {
        extension_message_response: {
          params: {
            flow_token: "REPLACE_FLOW_TOKEN",
            some_param_name: "PASS_CUSTOM_VALUE",
          },
        },
      },
    },
  };
}

export const getNextScreen = async (decryptedBody, companyId) => {
  const { screen, data, version, action, flow_token } = decryptedBody;
  
  // console.log('action', action); 
  
  // handle health check request
  if (action === "ping") {
    return {
      data: {
        status: "active",
      },
    };
  }

  // handle error notification
  if (data?.error) {
    console.warn("Received client error:", data);
    return {
      data: {
        acknowledged: true,
      },
    };
  }

  // handle initial request when opening the flow and display APPOINTMENT screen
  if (action === "INIT") {
    
    fillData(); 
    
    return {
      ...SCREEN_RESPONSES.APPOINTMENT,
      data: {
        ...SCREEN_RESPONSES.APPOINTMENT.data,
        // these fields are disabled initially. Each field is enabled when previous fields are selected
        is_date_enabled: true,
        is_time_enabled: false,
      },
    };
  }

  if (action === "data_exchange") {
    // handle the request based on the current screen
    switch (screen) {
      // handles when user interacts with APPOINTMENT screen
      case "APPOINTMENT":
        // update the appointment fields based on current user selection
        return {
          ...SCREEN_RESPONSES.APPOINTMENT,
          data: {
            // copy initial screen data then override specific fields
            ...SCREEN_RESPONSES.APPOINTMENT.data,
            // each field is enabled only when previous fields are selected
            is_date_enabled: Boolean(data.date),
            is_time_enabled: Boolean(data.date),

            // filter each field options based on current selection
            date: await Promise.all(SCREEN_RESPONSES.APPOINTMENT.data.date),
            time: await Promise.all(SCREEN_RESPONSES.APPOINTMENT.data.time.map(async (timeSlot, index) => {
              let enabled = true;
              if (data.date) {

                const dateTime = `${data.date}T${timeSlot.id}:00-05:00`;

                // Use moment-timezone to correctly parse and handle the timezone
                const dateTimeMoment = moment.tz(dateTime, 'America/Bogota'); // Specify the correct timezone
                const availableMentor = await findAvailableMentor(companyId, dateTime);
                const [hours, minutes] = timeSlot.id.split(':').map(Number);

                // Get the correct day of the week using moment-timezone
                const dayOfWeek = dateTimeMoment.day(); // This will be correct in the specified timezone

                // Calculate one hour earlier using moment
                const oneHourLater = dateTimeMoment.clone().subtract(2, 'hours');

                if (dateTime === '2024-11-08T17:00:00-05:00') {
                  console.log("availableMentor", availableMentor);
                  console.log("dateTime", dateTime);
                  console.log("oneHourLater < new Date()", oneHourLater.isBefore(moment()));
                  console.log("dayOfWeek", dayOfWeek);
                  console.log("hours", hours);
                  console.log("(dayOfWeek === 6 && hours >= 12)", (dayOfWeek === 6 && hours >= 12));
                }

                if (availableMentor === null || oneHourLater.isBefore(moment()) || (dayOfWeek === 6 && hours >= 12)) {
                  enabled = false; // Disable time slot if no available mentor
                }
              }
              return {
                ...timeSlot,
                enabled,
              };
            })),
            appointment: "Mon Jan 02 2024 at 11:30.",
          },
        };
      // handles when user completes DETAILS screen
      case "DETAILS":
        const dateName = SCREEN_RESPONSES.APPOINTMENT.data.date.find(
          (date) => date.id === data.date
        ).title;

        const appointment = `${dateName} at ${data.time}`;

        return {
          ...SCREEN_RESPONSES.SUMMARY,
          data: { 
            appointment,
            // details,
            // return the same fields sent from client back to submit in the next step
            ...data,
          },
        };

      // handles when user completes SUMMARY screen
      case "SUMMARY":
        try {

          // const dateTimeMoment = moment.tz(data.date, 'America/Bogota'); // Specify the correct timezone
          
          const startDateTime = `${data.date}T${data.time}:00-05:00`;

          // console.log("screen", screen);
          // console.log("data.date", data.date);
          // console.log("startDateTime", startDateTime);

          const availableMentor = await findAvailableMentor(companyId, startDateTime);

          // console.log("availableMentor", availableMentor);

          if (!availableMentor) {
            console.error("No available mentor found for the selected date.");
            throw new Error("No available mentor");
          }
          
          // console.log("availableMentor", JSON.stringify(availableMentor));
          // console.log("flow_token", flow_token);

          const mentorAgendaRepository = new MentorAgendaRepository();
          const appointmentsByPhone = await mentorAgendaRepository.getAppointmentsByPhone(flow_token);
          
          // console.log("appointmentsByPhone", JSON.stringify(appointmentsByPhone));

          // const startDateTime = `${data.date}T${data.time}:00-05:00`;
          const eventDetails = {
            summary: `Capacitación ${appointmentsByPhone[0].title}`,
            description: `Capacitación ${appointmentsByPhone[0].title} con mentor ${availableMentor.Nombre}`,
            startDateTime: startDateTime,
            endDateTime: `${data.date}T${parseInt(data.time.split(":")[0]) + 1}:00:00-05:00`,
            timeZone: "America/Bogota",
            attendees: [
              { email: availableMentor.Correo_electronico },
              { email: appointmentsByPhone[0].correo_electronico}
            ],
          };

          const eventData = await addEvent(companyId, eventDetails, appointmentsByPhone[0].id, availableMentor.id);

        } catch (err) {
          console.error("Error creating event:", err);
          throw new Error("Error scheduling the appointment");
        }

        // send success response to complete and close the flow
        return {
          ...SCREEN_RESPONSES.SUCCESS,
          data: {
            extension_message_response: {
              params: {
                flow_token,
              },
            },
          },
        };

      default:
        break;
    }
  }

  console.error("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};