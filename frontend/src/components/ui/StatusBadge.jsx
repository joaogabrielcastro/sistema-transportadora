// src/components/ui/StatusBadge.jsx
import React from "react";
import PropTypes from "prop-types";
import { getStatusConfig } from "../../utils/statusColors";

/** Selo de status. Não renderiza nada quando não há status (evita pílulas vazias). */
export const StatusBadge = ({ status, type = "status", className = "", dot = false }) => {
  if (status === null || status === undefined || String(status).trim() === "") {
    return null;
  }
  const colorClass = getStatusConfig(String(status), type);

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium leading-5 ${colorClass} ${className}`}
    >
      {dot ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden /> : null}
      <span className="break-words">{status}</span>
    </span>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.node,
  type: PropTypes.string,
  className: PropTypes.string,
  dot: PropTypes.bool,
};
