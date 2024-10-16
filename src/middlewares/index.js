// 2. Middleware - Directory for All Middlewares (middleware/index.js)
// --------------------------------------------------
// Contains all middleware logic, making it easy to manage and reuse.

import express from "express";
import { ensureTokenIsValid } from "./ensureTokenIsValid.js";

export function setupMiddleware(app) {
  app.use(
    express.json({
      verify: (req, res, buf, encoding) => {
        req.rawBody = buf?.toString(encoding || "utf8");
      },
    })
  );

  // Apply token validation only to specific endpoints
  app.use("/events/:companyId", ensureTokenIsValid);
  app.use("/events/:companyId/add", ensureTokenIsValid);
}