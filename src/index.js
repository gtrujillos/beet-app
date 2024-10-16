// 1. Index.js - Main Entry Point
// --------------------------------------------------
// This file should initialize the express app and set up middleware. Import all routes from separate modules to keep everything organized.

import express from "express";
import dotenv from "dotenv";
import { setupMiddleware } from "./middlewares/index.js";
import { setupRoutes } from "./routes/index.js";

dotenv.config();

const app = express();

// Set up middlewares
setupMiddleware(app);

// Set up routes
setupRoutes(app);

// Listen on the specified port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});