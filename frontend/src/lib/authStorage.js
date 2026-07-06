const STORAGE_KEY = "abrotto_auth_token";
const USER_KEY = "abrotto_auth_user";

export function getStoredToken() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth({ token, user }) {
  localStorage.setItem(STORAGE_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAuthHeaderToken() {
  return getStoredToken();
}
