// Database Connection Service (services/dbConnection.js)
// --------------------------------------------------
// This file manages the connection to the PostgreSQL database, providing a reusable pool instance for other services and controllers.

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Create a pool instance with environment variables for configuration
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export const getDbConnection = async () => {
  try {
    const client = await pool.connect();
    return client;
  } catch (err) {
    console.error("Error connecting to the database", err);
    throw err;
  }
};

export default pool;