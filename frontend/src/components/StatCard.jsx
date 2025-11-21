// frontend/src/components/StatCard.jsx
import React from "react";

const StatCard = ({ icon, value, label, color = "blue" }) => {
  const colorClasses = {
    blue: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-500",
    },
    green: {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-500",
    },
    purple: {
      bg: "bg-purple-100",
      text: "text-purple-800",
      border: "border-purple-500",
    },
    orange: {
      bg: "bg-orange-100",
      text: "text-orange-800",
      border: "border-orange-500",
    },
    red: {
      bg: "bg-red-100",
      text: "text-red-800",
      border: "border-red-500",
    },
  };

  const currentColor = colorClasses[color];

  return (
    <div
      className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${currentColor.border}`}
    >
      <div className="flex items-center">
        <div className={`rounded-full ${currentColor.bg} p-3 mr-4`}>{icon}</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{value}</h2>
          <p className="text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
