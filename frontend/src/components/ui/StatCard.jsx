import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";

const colorStyles = {
  blue: {
    card: "border-border hover:shadow-soft",
    icon: "bg-blue-500/10 text-blue-600",
    compact: "bg-blue-50 text-blue-600 border-blue-200",
  },
  green: {
    card: "border-border hover:shadow-soft",
    icon: "bg-emerald-500/10 text-emerald-600",
    compact: "bg-green-50 text-green-600 border-green-200",
  },
  purple: {
    card: "border-border hover:shadow-soft",
    icon: "bg-purple-500/10 text-purple-600",
    compact: "bg-purple-50 text-purple-600 border-purple-200",
  },
  orange: {
    card: "border-border hover:shadow-soft",
    icon: "bg-orange-500/10 text-orange-600",
    compact: "bg-orange-50 text-orange-600 border-orange-200",
  },
  amber: {
    card: "border-border hover:shadow-soft",
    icon: "bg-amber-500/10 text-amber-600",
    compact: "bg-amber-50 text-amber-600 border-amber-200",
  },
};

const StatCard = ({
  title,
  value,
  icon,
  color = "blue",
  layout = "dashboard",
  hint,
  to,
  className = "",
}) => {
  const styles = colorStyles[color] || colorStyles.blue;

  if (layout === "compact") {
    return (
      <div
        className={`rounded-xl border bg-white p-4 shadow-card ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2.5 ${styles.icon}`}>{icon}</div>
          <div className="min-w-0">
            <div className="truncate text-xl font-bold tabular-nums text-text-primary">{value}</div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</p>
            {hint ? (
              <p className="mt-0.5 text-xs opacity-70">{hint}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-text-secondary mb-1">{title}</p>
          <div className="text-2xl font-bold tabular-nums text-text-primary">{value}</div>
          {hint ? (
            <p className="mt-1 text-xs text-text-secondary">{hint}</p>
          ) : null}
        </div>
        <div
          className={`p-3 rounded-lg ${styles.icon} group-hover:opacity-90 transition-colors`}
        >
          {icon}
        </div>
      </div>
      {to ? (
        <span className="mt-4 inline-flex items-center text-xs font-semibold text-secondary">
          Ver detalhes <span aria-hidden className="ml-1">→</span>
        </span>
      ) : null}
    </>
  );

  const classes = `group block rounded-xl border bg-white p-5 shadow-card transition-colors ${styles.card} ${
    to ? "hover:border-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary" : ""
  } ${className}`;

  return to ? <Link to={to} className={classes}>{content}</Link> : <div className={classes}>{content}</div>;
};

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  icon: PropTypes.node,
  color: PropTypes.oneOf(["blue", "green", "purple", "orange", "amber"]),
  layout: PropTypes.oneOf(["dashboard", "compact"]),
  hint: PropTypes.node,
  to: PropTypes.string,
  className: PropTypes.string,
};

export default StatCard;
