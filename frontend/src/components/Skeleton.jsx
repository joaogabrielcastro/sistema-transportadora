import React from "react";

export const Skeleton = ({ className = "", variant = "rectangular" }) => {
  const baseClasses = "animate-pulse bg-gray-200";
  const variantClasses = {
    rectangular: "rounded",
    circular: "rounded-full",
    text: "rounded h-4",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  );
};

export const CardSkeleton = ({ lines = 2 }) => {
  const lineCount = Math.max(1, Number(lines) || 2);
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <Skeleton className="h-6 w-3/4" />
      {Array.from({ length: lineCount }).map((_, i) => (
        <Skeleton
          key={i}
          className={i === lineCount - 1 ? "h-4 w-5/6" : "h-4 w-full"}
        />
      ))}
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
};

export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <div className="space-y-2">
    <div className="flex gap-4 pb-2 border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-6 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-4 py-3 border-b">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export default Skeleton;
