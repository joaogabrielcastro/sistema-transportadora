import React from "react";
import PropTypes from "prop-types";

export const Tabs = ({ tabs, activeTab, onChange, className = "" }) => (
  <div
    className={`flex flex-wrap gap-2 border-b border-border ${className}`}
    role="tablist"
  >
    {tabs.map((tab) => {
      const isActive = activeTab === tab.id;

      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            isActive
              ? "border-secondary text-secondary"
              : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
          }`}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);

Tabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  activeTab: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export const FilterChips = ({ items = [], onRemove, className = "" }) => {
  if (!items.length) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((item) => (
        <span
          key={item.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-text-secondary"
        >
          <span className="text-text-light">{item.label}:</span>
          <span className="text-text-primary">{item.value}</span>
          {onRemove && item.removable !== false && (
            <button
              type="button"
              onClick={() => onRemove(item.key)}
              className="ml-0.5 text-text-light hover:text-danger transition-colors"
              aria-label={`Remover filtro ${item.label}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
};

FilterChips.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
      removable: PropTypes.bool,
    }),
  ),
  onRemove: PropTypes.func,
  className: PropTypes.string,
};
