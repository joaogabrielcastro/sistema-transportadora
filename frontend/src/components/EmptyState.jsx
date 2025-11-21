// frontend/src/components/EmptyState.jsx
import React from "react";

const EmptyState = ({ icon, title, description }) => (
  <div className="bg-white rounded-xl shadow-md p-8 text-center">
    <div className="text-4xl mb-3">{icon}</div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

export default EmptyState;
