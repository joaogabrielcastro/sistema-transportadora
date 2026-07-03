import React from "react";
import PropTypes from "prop-types";

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
  className = "",
}) => {
  const styles = colorStyles[color] || colorStyles.blue;

  if (layout === "compact") {
    return (
      <div
        className={`p-6 rounded-xl border transition-all duration-200 hover:shadow-md ${styles.compact} ${className}`}
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-white shadow-sm">{icon}</div>
          <div>
            <h3 className="text-2xl font-bold text-text-primary">{value}</h3>
            <p className="text-sm font-medium opacity-80">{title}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-xl p-6 shadow-card border transition-all duration-300 group ${styles.card} ${className}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-text-secondary mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-text-primary">{value}</h3>
        </div>
        <div
          className={`p-3 rounded-lg ${styles.icon} group-hover:opacity-90 transition-colors`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  icon: PropTypes.node,
  color: PropTypes.oneOf(["blue", "green", "purple", "orange", "amber"]),
  layout: PropTypes.oneOf(["dashboard", "compact"]),
  className: PropTypes.string,
};

export default StatCard;
