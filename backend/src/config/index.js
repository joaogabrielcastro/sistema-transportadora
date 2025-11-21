// backend/src/config/index.js
import "dotenv/config";

export const config = {
  database: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
  },
  app: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || "development",
    corsOrigins: [
      "https://sistema-transportadora-omega.vercel.app",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
    ],
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
    enableConsole: process.env.NODE_ENV === "development",
  },
};
