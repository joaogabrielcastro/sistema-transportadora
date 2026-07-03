import React from "react";
import PropTypes from "prop-types";

const EmptyState = ({
  icon,
  title,
  description,
  action,
  dashed = false,
}) => (
  <div
    className={`text-center py-12 px-6 rounded-xl ${
      dashed
        ? "bg-white border border-dashed border-border"
        : "bg-gray-50 border border-dashed border-gray-200"
    }`}
  >
    {icon && (
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary/10 text-secondary">
        {icon}
      </div>
    )}
    <h3 className="text-lg font-semibold text-text-primary mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-text-secondary max-w-md mx-auto">{description}</p>
    )}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  action: PropTypes.node,
  dashed: PropTypes.bool,
};

export default EmptyState;
