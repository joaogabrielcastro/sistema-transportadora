// backend/src/utils/logger.js
import { config } from "../config/index.js";

class Logger {
  constructor() {
    this.enableConsole = config.logging.enableConsole;
  }

  info(message, meta = {}) {
    if (this.enableConsole) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta);
    }
  }

  error(message, error = null) {
    if (this.enableConsole) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
    }
  }

  warn(message, meta = {}) {
    if (this.enableConsole) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta);
    }
  }

  debug(message, meta = {}) {
    if (this.enableConsole && config.app.env === "development") {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta);
    }
  }
}

export const logger = new Logger();
