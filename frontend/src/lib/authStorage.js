const STORAGE_KEY = "atrack_auth_token";
const USER_KEY = "atrack_auth_user";
const LEGACY_TOKEN_KEY = "abrotto_auth_token";
const LEGACY_USER_KEY = "abrotto_auth_user";

function migrateLegacyAuth() {
  try {
    if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(LEGACY_TOKEN_KEY)) {
      localStorage.setItem(STORAGE_KEY, localStorage.getItem(LEGACY_TOKEN_KEY));
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
    if (!localStorage.getItem(USER_KEY) && localStorage.getItem(LEGACY_USER_KEY)) {
      localStorage.setItem(USER_KEY, localStorage.getItem(LEGACY_USER_KEY));
      localStorage.removeItem(LEGACY_USER_KEY);
    }
  } catch {
    // ignore
  }
}

export function getStoredToken() {
  try {
    migrateLegacyAuth();
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function getStoredUser() {
  try {
    migrateLegacyAuth();
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth({ token, user }) {
  localStorage.setItem(STORAGE_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    // ignore
  }
}

export function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    // ignore
  }
}

export function getAuthHeaderToken() {
  return getStoredToken();
}
