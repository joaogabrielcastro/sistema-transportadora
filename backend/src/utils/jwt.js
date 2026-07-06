import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

export function signAccessToken(payload) {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
  });
}

export function verifyAccessToken(token) {
  if (!token || !config.auth.jwtSecret) {
    return null;
  }

  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch {
    return null;
  }
}
