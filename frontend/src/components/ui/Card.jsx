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
          className={`flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${headerClassName}`}
        >
          <div className="min-w-0">
            {title && (
              <h3 className="break-words text-[15px] font-semibold tracking-tight text-text-primary">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[13px] leading-5 text-text-secondary">{subtitle}</p>
            )}
          </div>
          {action && (
            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:ml-4 sm:w-auto">
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
          className="rounded-b-xl border-t border-border bg-slate-50/60 px-4 py-3 sm:px-5"
        >
          {footer}
        </div>
      )}
    </div>
  );
};

Card.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  headerClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  footer: PropTypes.node,
  noPadding: PropTypes.bool,
  action: PropTypes.node,
};

export default Card;
