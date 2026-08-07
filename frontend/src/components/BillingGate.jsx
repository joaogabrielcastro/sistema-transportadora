import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { hasBillingAccess } from "../utils/billing.js";

/**
 * Bloqueia o app (exceto /assinatura) quando a assinatura/trial expirou.
 */
export function BillingGate({ children }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return children;
  }

  if (location.pathname.startsWith("/assinatura")) {
    return children;
  }

  if (!hasBillingAccess(user)) {
    return <Navigate to="/assinatura" replace state={{ from: location }} />;
  }

  return children;
}
