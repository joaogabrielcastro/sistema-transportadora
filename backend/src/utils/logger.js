// backend/src/utils/logger.js
import { config } from "../config/index.js";

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const getMinLevel = () => {
  const raw = String(config.logging.level || "info").toLowerCase();
  return LEVELS[raw] ?? LEVELS.info;
};

class Logger {
  constructor() {
    this.enableConsole = config.logging.enableConsole;
    this.minLevel = getMinLevel();
  }

  info(message, meta = {}) {
    if (this.enableConsole && this.minLevel <= LEVELS.info) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta);
    }
  }

  error(message, error = null) {
    if (this.enableConsole && this.minLevel <= LEVELS.error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
    }
  }

  warn(message, meta = {}) {
    if (this.enableConsole && this.minLevel <= LEVELS.warn) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta);
    }
  }

  debug(message, meta = {}) {
    if (this.enableConsole && this.minLevel <= LEVELS.debug) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta);
    }
  }
}

export const logger = new Logger();
