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
import { queryClient } from "../lib/queryClient.js";

const AuthContext = createContext(null);

/** Evita dados de um tenant aparecerem após login em outro (sem hard refresh). */
function resetSessionCaches() {
  queryClient.clear();
}

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

    resetSessionCaches();
    setStoredAuth({ token: payload.token, user: payload.user });
    setToken(payload.token);
    setUser(payload.user);
    return payload.user;
  }, []);

  const register = useCallback(async ({ empresaNome, email, password, nome }) => {
    const res = await apiFetch({
      method: "POST",
      url: "/auth/register",
      data: { empresaNome, email, password, nome },
    });

    const payload = res.data;
    if (!payload?.token) {
      throw new Error("Resposta de cadastro inválida");
    }

    resetSessionCaches();
    setStoredAuth({ token: payload.token, user: payload.user });
    setToken(payload.token);
    setUser(payload.user);
    return payload.user;
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken("");
    setUser(null);
    resetSessionCaches();
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      register,
      logout,
    }),
    [token, user, login, register, logout],
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
