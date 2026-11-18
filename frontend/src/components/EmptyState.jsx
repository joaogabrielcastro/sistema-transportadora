import React from "react";
import PropTypes from "prop-types";
import Icon from "./ui/Icon.jsx";

const EmptyState = ({
  icon,
  title,
  description,
  action,
  dashed = false,
  compact = false,
}) => (
  <div
    className={`rounded-xl border bg-white text-center ${
      dashed ? "border-dashed border-border-strong bg-slate-50/40" : "border-border"
    } ${compact ? "px-4 py-8" : "px-6 py-12"}`}
  >
    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200">
      {icon || <Icon name="box" className="h-5 w-5" />}
    </div>
    <h3 className="text-base font-semibold text-text-primary">{title}</h3>
    {description && (
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-text-secondary">{description}</p>
    )}
    {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  description: PropTypes.node,
  action: PropTypes.node,
  dashed: PropTypes.bool,
  compact: PropTypes.bool,
};

export default EmptyState;
