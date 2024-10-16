// 4. Routes - Directory for All Routes (routes/index.js)
// --------------------------------------------------
// Separate each route into its own file. Import these into a main router file.

import authRoutes from "./auth.js";
import eventsRoutes from "./events.js";
import whatsappRoutes from "./whatsapp.js";

export function setupRoutes(app) {
  app.use("/auth", authRoutes);
  app.use("/events", eventsRoutes);
  app.use("/whatsapp", whatsappRoutes);
}