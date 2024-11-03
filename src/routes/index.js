// 4. Routes - Directory for All Routes (routes/index.js)
// --------------------------------------------------
// Separate each route into its own file. Import these into a main router file.

import authRoutes from "./auth.js";
import eventsRoutes from "./events.js";
import whatsappRoutes from "./whatsapp.js";
import express from "express";
import axios from "axios";

export function setupRoutes(app) {
  app.use("/auth", authRoutes);
  app.use("/events", eventsRoutes);
  app.use("/whatsapp", whatsappRoutes);

  // Route to determine network information, such as the public IP address
  app.get("/network-info", async (req, res) => {
    try {
      const response = await axios.get("https://api.ipify.org?format=json");
      res.json({ publicIp: response.data.ip });
    } catch (error) {
      console.error("Error fetching network information", error);
      res.status(500).send("Error fetching network information");
    }
  });
} 
