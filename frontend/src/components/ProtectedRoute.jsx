import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/** Auth is required unless explicitly disabled for local demo (AUTH_ENABLED=false). */
const AUTH_REQUIRED = import.meta.env.VITE_AUTH_REQUIRED !== "false";

export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (AUTH_REQUIRED && !isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
