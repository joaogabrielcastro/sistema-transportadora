import React, { useId, useState } from "react";
import PropTypes from "prop-types";

export default function NfeXmlDrop({
  label = "XML da NF-e",
  hint,
  multiple = false,
  disabled = false,
  onFiles,
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const pick = (list) => {
    const files = Array.from(list || []).filter((f) =>
      String(f.name || "").toLowerCase().endsWith(".xml"),
    );
    if (files.length) onFiles?.(multiple ? files : files.slice(0, 1));
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-sm font-medium text-text-secondary"
      >
        {label}
      </label>
      <label
        htmlFor={inputId}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) pick(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging
            ? "border-secondary bg-secondary/5"
            : "border-border bg-gray-50 hover:border-secondary/40"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          id={inputId}
          type="file"
          accept=".xml,application/xml,text/xml"
          multiple={multiple}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-sm font-medium text-text-primary">
          Solte o XML aqui ou clique para escolher
        </p>
        {hint ? (
          <p className="mt-1 text-xs text-text-secondary">{hint}</p>
        ) : null}
      </label>
    </div>
  );
}

NfeXmlDrop.propTypes = {
  label: PropTypes.string,
  hint: PropTypes.string,
  multiple: PropTypes.bool,
  disabled: PropTypes.bool,
  onFiles: PropTypes.func,
};
