// frontend/src/components/LoadingSpinner.jsx
import React from "react";

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-blue"></div>
  </div>
);

export default LoadingSpinner;
