import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "../lib/apiClient.js";
import {
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  setStoredAuth,
} from "../lib/authStorage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(() => getStoredUser());

  const login = useCallback(async (email, password) => {
    const res = await apiFetch({
      method: "POST",
      url: "/auth/login",
      data: { email, password },
    });

    const payload = res.data;
    if (!payload?.token) {
      throw new Error("Resposta de login inválida");
    }

    setStoredAuth({ token: payload.token, user: payload.user });
    setToken(payload.token);
    setUser(payload.user);
    return payload.user;
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken("");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, user, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}
