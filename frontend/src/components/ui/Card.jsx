// frontend/src/components/ui/Card.jsx
import React from "react";
import PropTypes from "prop-types";

const Card = ({
  title,
  subtitle,
  children,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  footer,
  noPadding = false,
  action,
}) => {
  return (
    <div className={`card flex flex-col ${className}`}>
      {(title || subtitle || action) && (
        <div
          className={`flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 ${headerClassName}`}
        >
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-semibold text-text-primary tracking-tight break-words">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-text-secondary mt-1">{subtitle}</p>
            )}
          </div>
          {action && (
            <div className="w-full sm:w-auto sm:ml-4 shrink-0 flex flex-wrap gap-2">
              {action}
            </div>
          )}
        </div>
      )}

      <div className={`flex-1 ${noPadding ? "p-0" : "p-4 sm:p-5"} ${bodyClassName}`}>
        {children}
      </div>

      {footer && (
        <div
          className={`px-6 py-4 bg-gray-50/50 border-t border-border rounded-b-xl ${
            noPadding ? "" : ""
          }`}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

Card.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
  headerClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  footer: PropTypes.node,
  noPadding: PropTypes.bool,
  action: PropTypes.node,
};

export default Card;
