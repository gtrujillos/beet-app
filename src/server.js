import express from "express";
import { decryptRequest, encryptResponse, FlowEndpointException } from "./services/encryption.js";
import { getNextScreen } from "./services/flow.js";
import crypto from "crypto";
import dotenv from 'dotenv';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(
  express.json({
    // store the raw request body to use it for signature verification
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf?.toString(encoding || "utf8");
    },
  }),
);

const { 
  APP_SECRET, 
  PRIVATE_KEY, 
  PASSPHRASE = "", 
  GOOGLE_CLIENT_ID, 
  GOOGLE_CLIENT_SECRET, 
  GOOGLE_REDIRECT_URI, 
  PORT = "3001" 
} = process.env;

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Load OAuth2 credentials from .env
const oAuth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Helper function to update token.json when tokens are refreshed
oAuth2Client.on('tokens', (tokens) => {

  console.log("ON tokens", tokens);

  if (tokens.refresh_token) {
    // Save both access and refresh tokens in token.json
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  } else {
    // Only update the access token
    const currentToken = JSON.parse(fs.readFileSync(TOKEN_PATH));
    currentToken.access_token = tokens.access_token;
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(currentToken));
  }
});

// Middleware to check if the token is still valid and refresh if necessary
async function ensureTokenIsValid(req, res, next) {
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

    // console.log(TOKEN_PATH);
    console.log('ensureTokenIsValid', token);

    oAuth2Client.setCredentials(token);

    // console.log(oAuth2Client);

    // Use `getAccessToken` to ensure the token is still valid
    await oAuth2Client.getAccessToken();
    next();  // Proceed to the next middleware or route handler
  } catch (err) {
    console.log('Error with token, please authenticate again via /auth:', err);
    res.status(401).send('Please authenticate via /auth.');
  }
}

// Endpoint to trigger Google OAuth 2.0 flow
app.get('/auth', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this URL:', authUrl);
  res.redirect(authUrl);
});

// Endpoint to handle OAuth2 callback and exchange code for token
app.get('/oauth2callback', (req, res) => {
  const code = req.query.code;

  oAuth2Client.getToken(code, (err, token) => {
    if (err) {
      console.error('Error retrieving access token', err);
      return res.status(500).send('Authentication failed');
    }

    // Save the token to disk for future use
    fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
      if (err) return console.error(err);
      console.log('Token stored to', TOKEN_PATH);
    });

    oAuth2Client.setCredentials(token);
    res.send('Authentication successful! You can close this window.');
  });
});

// Function to list events from Google Calendar
async function listEvents(auth) {

  console.log('listEvents auth', auth);

  const calendar = google.calendar({ version: 'v3', auth });
  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    return res.data.items;
  } catch (err) {
    console.error('The API returned an error:', err);
    throw new Error('Error loading events');
  }
}

// Function to add an event to Google Calendar
async function addEvent(auth, eventDetails) {
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    const event = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventDetails,
    });
    return event.data;
  } catch (err) {
    console.error('Error adding event to Google Calendar:', err);
    throw err;
  }
}

// Endpoint to fetch events
app.get('/events', ensureTokenIsValid, async (req, res) => {
  try {
    const events = await listEvents(oAuth2Client);
    res.json(events);
  } catch (error) {
    console.error('Error retrieving events', error);
    res.status(500).send('Error retrieving events');
  }
});

// Endpoint to add a new event to the calendar
app.post('/add-event', ensureTokenIsValid, async (req, res) => {
  const eventDetails = {
    summary: req.body.summary,
    description: req.body.description,
    start: {
      dateTime: req.body.startDateTime,
      timeZone: req.body.timeZone || 'America/Los_Angeles',
    },
    end: {
      dateTime: req.body.endDateTime,
      timeZone: req.body.timeZone || 'America/Los_Angeles',
    },
    attendees: req.body.attendees || [],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 10 },
      ],
    },
  };

  try {
    const event = await addEvent(oAuth2Client, eventDetails);
    res.json({ message: 'Event created successfully', event });
  } catch (error) {
    console.error('Error creating event', error);
    res.status(500).send('Error creating event');
  }
});

// POST Endpoint for WhatsApp Flow
app.post("/whatsapp", async (req, res) => {
  // console.log(PRIVATE_KEY);

  // Step 1: Check signature validation
  if (!isRequestSignatureValid(req)) {
    return res.status(432).send(); // Invalid signature, return 432 status code
  }

  // Step 2: Decrypt request
  let decryptedRequest;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Decryption failed:", err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).send();
    }
    return res.status(500).send("Decryption error");
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("Decrypted WhatsApp Flow Request:", decryptedBody);

  // Step 3: Process the flow and get the next screen (business logic)
  const screenResponse = await getNextScreen(decryptedBody);

  // Step 4: Encrypt the response using the received AES key and IV
  const encryptedResponse = encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer);

  // Convert the encrypted response to Base64
  const base64Response = encryptedResponse.toString("base64");

  // Step 5: Send the Base64-encoded response
  res.send(base64Response);
});

// WhatsApp Token Signature Validation
function isRequestSignatureValid(req) {
  if (!APP_SECRET) {
    console.warn("App Secret is not set up. Please Add your app secret in /.env file to check for request validation");
    return true;
  }

  const signatureHeader = req.get("x-hub-signature-256");
  const signatureBuffer = Buffer.from(signatureHeader.replace("sha256=", ""), "utf-8");

  const hmac = crypto.createHmac("sha256", APP_SECRET);
  const digestString = hmac.update(req.rawBody).digest('hex');
  const digestBuffer = Buffer.from(digestString, "utf-8");

  if (!crypto.timingSafeEqual(digestBuffer, signatureBuffer)) {
    console.error("Error: Request Signature did not match");
    return false;
  }
  return true;
}

// Listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});
