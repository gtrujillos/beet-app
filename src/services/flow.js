// 8. Events Controller (services/flow.js)

// this object is generated from Flow Builder under "..." > Endpoint > Snippets > Responses
const SCREEN_RESPONSES = {
  APPOINTMENT: {
    screen: "APPOINTMENT",
    data: {
      date: Array.from({ length: 8 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i - 1);
        return {
          id: date.toISOString().split("T")[0],
          title: date.toDateString(),
        };
      }),
      is_date_enabled: true,
      time: Array.from({ length: 13 }, (_, i) => {
        const hour = 8 + i;
        const amPmHour = hour <= 12 ? hour : hour - 12;
        const period = hour < 12 ? 'AM' : 'PM';
        return {
          id: `${hour}:00`,
          title: `${amPmHour}:00 ${period}`,
          enabled: true,
        };
      }),
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
      appointment: "Mon Jan 01 2024 at 11:30.",
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

export const getNextScreen = async (decryptedBody) => {
  const { screen, data, version, action, flow_token } = decryptedBody;
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
            date: SCREEN_RESPONSES.APPOINTMENT.data.date,
            time: SCREEN_RESPONSES.APPOINTMENT.data.time.map((timeSlot, index) => {
              let enabled = true;
              if (data.date) {
                const selectedDateIndex = SCREEN_RESPONSES.APPOINTMENT.data.date.findIndex(
                  (date) => date.id === data.date
                );
                if (selectedDateIndex === 0 && index === 1) {
                  enabled = false; // Disable second hour for the first day
                } else if (selectedDateIndex === 1 && (index === 2 || index === 3)) {
                  enabled = false; // Disable third and fourth hour for the second day
                }
              }
              return {
                ...timeSlot,
                enabled,
              };
            }),
          },
        };

      // handles when user completes DETAILS screen
      case "DETAILS":
        const dateName = SCREEN_RESPONSES.APPOINTMENT.data.date.find(
          (date) => date.id === data.date
        ).title;

        const appointment = `${dateName} at ${data.time}`;

        const details = `Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone}
"${data.more_details}"`;

        return {
          ...SCREEN_RESPONSES.SUMMARY,
          data: { 
            appointment,
            details,
            // return the same fields sent from client back to submit in the next step
            ...data,
          },
        };

      // handles when user completes SUMMARY screen
      case "SUMMARY":
        // TODO: save appointment to your database
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