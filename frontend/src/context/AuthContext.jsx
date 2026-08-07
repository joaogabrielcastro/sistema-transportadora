import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

function mapProfileToUser(profile, prev = {}) {
  return {
    ...prev,
    id: profile.id,
    email: profile.email,
    nome: profile.nome,
    role: profile.role,
    tenantId: profile.tenantId,
    tenantSlug: profile.tenantSlug,
    tenantNome: profile.tenantNome,
        features: profile.features,
    billingExempt: profile.billingExempt ?? false,
    plan: profile.plan ?? null,
    subscriptionStatus: profile.subscriptionStatus ?? null,
    trialEndsAt: profile.trialEndsAt ?? null,
    hasBillingAccess: profile.hasBillingAccess,
    permissions: profile.permissions || [],
    onboardingCompletedAt: profile.onboardingCompletedAt ?? null,
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(() => getStoredUser());

  const refreshProfile = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) return null;
    const res = await apiFetch({ url: "/auth/me" });
    const profile = res.data?.data ?? res.data;
    if (!profile?.id) return null;
    const nextUser = mapProfileToUser(profile, getStoredUser() || {});
    setStoredAuth({ token: currentToken, user: nextUser });
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const next = await refreshProfile();
        if (cancelled || !next) return;
      } catch {
        /* sessão inválida tratada em rotas protegidas */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refreshProfile]);

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
      refreshProfile,
    }),
    [token, user, login, register, logout, refreshProfile],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

// Hook no mesmo arquivo do Provider é padrão de Context; o aviso de fast refresh não se aplica.
// eslint-disable-next-line react-refresh/only-export-components -- useAuth junto do Provider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}
