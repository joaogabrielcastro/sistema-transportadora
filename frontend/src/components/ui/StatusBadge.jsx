// src/components/ui/StatusBadge.jsx
import React from "react";
import { getStatusConfig } from "../../utils/statusColors";

export const StatusBadge = ({ status, type = "status" }) => {
  const className = getStatusConfig(status, type);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}
    >
      {status}
    </span>
  );
};
