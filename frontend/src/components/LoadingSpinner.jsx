// frontend/src/components/LoadingSpinner.jsx
import React from "react";

const sizeClasses = {
  small: "h-4 w-4 border",
  medium: "h-8 w-8 border-2",
  large: "h-12 w-12 border-2",
  xlarge: "h-16 w-16 border-4",
};

const LoadingSpinner = ({ size = "medium", className = "", text = "" }) => (
  <div
    className={`flex flex-col justify-center items-center py-12 ${className}`}
  >
    <div
      className={`animate-spin rounded-full border-navy-blue border-t-transparent ${sizeClasses[size]}`}
      role="status"
      aria-label="Carregando"
    />
    {text && <p className="mt-4 text-gray-600 text-sm animate-pulse">{text}</p>}
  </div>
);

export default LoadingSpinner;
