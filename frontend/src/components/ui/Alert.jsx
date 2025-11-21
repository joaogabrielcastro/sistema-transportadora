import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";

const Alert = ({
  type = "info",
  title,
  message,
  dismissible = false,
  onClose,
  className = "",
  autoClose = false,
  duration = 5000,
  children,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoClose && isVisible) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, isVisible]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  const variants = {
    info: {
      container: "bg-blue-50 border-blue-200",
      icon: "text-blue-500",
      title: "text-blue-800",
      text: "text-blue-700",
      border: "border-l-blue-500",
    },
    success: {
      container: "bg-green-50 border-green-200",
      icon: "text-green-500",
      title: "text-green-800",
      text: "text-green-700",
      border: "border-l-green-500",
    },
    warning: {
      container: "bg-amber-50 border-amber-200",
      icon: "text-amber-500",
      title: "text-amber-800",
      text: "text-amber-700",
      border: "border-l-amber-500",
    },
    error: {
      container: "bg-red-50 border-red-200",
      icon: "text-red-500",
      title: "text-red-800",
      text: "text-red-700",
      border: "border-l-red-500",
    },
  };

  const icons = {
    info: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    success: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    warning: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    error: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  };

  const variant = variants[type] || variants.info;

  return (
    <div
      className={`relative w-full rounded-lg border border-l-4 p-4 shadow-sm animate-fade-in ${variant.container} ${variant.border} ${className}`}
    >
      <div className="flex items-start">
        <div className={`flex-shrink-0 ${variant.icon}`}>{icons[type]}</div>
        <div className="ml-3 flex-1 md:flex md:justify-between">
          <div>
            {title && (
              <h3 className={`text-sm font-medium ${variant.title}`}>
                {title}
              </h3>
            )}
            <div className={`text-sm ${title ? "mt-1" : ""} ${variant.text}`}>
              {message}
              {children}
            </div>
          </div>
        </div>
        {(dismissible || onClose) && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={handleClose}
                type="button"
                className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${variant.text} hover:bg-white hover:bg-opacity-20`}
              >
                <span className="sr-only">Fechar</span>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

Alert.propTypes = {
  type: PropTypes.oneOf(["info", "success", "warning", "error"]),
  title: PropTypes.string,
  message: PropTypes.node,
  dismissible: PropTypes.bool,
  onClose: PropTypes.func,
  className: PropTypes.string,
  autoClose: PropTypes.bool,
  duration: PropTypes.number,
  children: PropTypes.node,
};

export default Alert;
