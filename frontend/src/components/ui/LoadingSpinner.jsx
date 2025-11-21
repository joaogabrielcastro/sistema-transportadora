import React from "react";
import PropTypes from "prop-types";

const LoadingSpinner = ({
  size = "md",
  color = "primary",
  text,
  fullScreen = false,
  className = "",
}) => {
  const sizes = {
    sm: "h-5 w-5 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
    xl: "h-16 w-16 border-4",
  };

  const colors = {
    primary: "border-primary border-t-transparent",
    secondary: "border-secondary border-t-transparent",
    white: "border-white border-t-transparent",
    blue: "border-blue-500 border-t-transparent",
    green: "border-green-500 border-t-transparent",
    red: "border-red-500 border-t-transparent",
    gray: "border-gray-500 border-t-transparent",
  };

  const spinnerClasses = `
    animate-spin rounded-full 
    ${sizes[size] || sizes.md} 
    ${colors[color] || colors.primary}
  `;

  const content = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={spinnerClasses}></div>
      {text && (
        <p
          className={`mt-3 text-sm font-medium ${
            color === "white" ? "text-white" : "text-text-secondary"
          } animate-pulse`}
        >
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-all duration-300">
        {content}
      </div>
    );
  }

  return content;
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  color: PropTypes.oneOf([
    "primary",
    "secondary",
    "white",
    "blue",
    "green",
    "red",
    "gray",
  ]),
  text: PropTypes.string,
  fullScreen: PropTypes.bool,
  className: PropTypes.string,
};

export default LoadingSpinner;
