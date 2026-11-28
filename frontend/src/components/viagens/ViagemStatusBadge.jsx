import React from "react";
import PropTypes from "prop-types";
import { VIAGEM_STATUS } from "../../utils/viagens.js";

export default function ViagemStatusBadge({ status, className = "" }) {
  const s = VIAGEM_STATUS[status];
  if (!s) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.tone} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === "em_andamento" ? "animate-pulse" : ""}`} aria-hidden />
      {s.label}
    </span>
  );
}

ViagemStatusBadge.propTypes = { status: PropTypes.string, className: PropTypes.string };
