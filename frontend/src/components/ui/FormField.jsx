import React from "react";
import PropTypes from "prop-types";

const FormField = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  required = false,
  className = "",
  icon,
  options = [],
  disabled = false,
  rows = 3,
  helperText,
  children,
  ...props
}) => {
  const fieldId = name || `field-${Math.random().toString(36).substr(2, 9)}`;

  const baseInputClasses = `
    block w-full rounded-lg border 
    ${
      error
        ? "border-danger focus:ring-danger"
        : "border-border focus:ring-secondary"
    } 
    bg-white px-4 py-2.5 text-text-primary placeholder-text-light 
    focus:border-transparent focus:outline-none focus:ring-2 
    disabled:bg-gray-50 disabled:text-text-light disabled:cursor-not-allowed
    transition-all duration-200
  `;

  const renderInput = () => {
    if (children) return children;

    if (type === "select") {
      return (
        <div className="relative">
          <select
            id={fieldId}
            name={name}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`${baseInputClasses} appearance-none ${
              icon ? "pl-10" : ""
            }`}
            {...props}
          >
            <option value="" disabled>
              {placeholder || "Selecione uma opção"}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-text-light">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-light">
              {icon}
            </div>
          )}
        </div>
      );
    }

    if (type === "textarea") {
      return (
        <textarea
          id={fieldId}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={`${baseInputClasses} ${icon ? "pl-10" : ""}`}
          {...props}
        />
      );
    }

    return (
      <div className="relative">
        <input
          type={type}
          id={fieldId}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`${baseInputClasses} ${icon ? "pl-10" : ""}`}
          {...props}
        />
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-light">
            {icon}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="mb-1.5 block text-sm font-medium text-text-secondary"
        >
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}
      {renderInput()}
      {helperText && !error && (
        <p className="mt-1 text-xs text-text-light">{helperText}</p>
      )}
      {error && (
        <p className="mt-1 text-xs font-medium text-danger animate-fade-in flex items-center">
          <svg
            className="w-3 h-3 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

FormField.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string,
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  icon: PropTypes.node,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  disabled: PropTypes.bool,
  rows: PropTypes.number,
  helperText: PropTypes.string,
  children: PropTypes.node,
};

export default FormField;
