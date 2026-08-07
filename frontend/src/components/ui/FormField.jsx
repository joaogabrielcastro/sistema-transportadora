import React, { useId, useMemo } from "react";
import PropTypes from "prop-types";
import SearchableSelect from "./SearchableSelect.jsx";
import {
  decimalsFromStep,
  formatNumberInputDisplay,
  parseNumberInputValue,
} from "../../utils/numberInput.js";

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
  allowEmpty = false,
  emptyLabel,
  decimals,
  step,
  min,
  max,
  onBlur,
  inputMode,
  ...props
}) => {
  const generatedId = useId();
  const fieldId = name || generatedId;

  const maxDecimals = useMemo(() => {
    if (typeof decimals === "number") return decimals;
    return decimalsFromStep(step);
  }, [decimals, step]);

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

  if (type === "typeahead" || type === "searchable") {
    return (
      <SearchableSelect
        label={label}
        name={name}
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(nextValue) => {
          if (!onChange) return;
          onChange({
            target: { name: name || "", value: nextValue },
          });
        }}
        options={options}
        placeholder={placeholder || "Digite para buscar..."}
        disabled={disabled}
        required={required}
        error={error}
        helperText={helperText}
        allowEmpty={allowEmpty}
        emptyLabel={emptyLabel}
        className={className}
        {...props}
      />
    );
  }

  const renderInput = () => {
    if (children) return children;

    if (type === "select") {
      return (
        <div className="relative">
          <select
            id={fieldId}
            name={name}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={onChange}
            disabled={disabled}
            className={`${baseInputClasses} appearance-none ${
              icon ? "pl-10" : ""
            }`}
            {...props}
          >
            {!options.some(
              (o) => o.value === "" || o.value === null || o.value === undefined,
            ) && (
              <option value="" disabled={required}>
                {placeholder || "Selecione uma opção"}
              </option>
            )}
            {options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
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

    if (type === "number") {
      const displayValue = formatNumberInputDisplay(value, { maxDecimals });

      const handleNumberChange = (event) => {
        if (!onChange) return;
        const raw = parseNumberInputValue(event.target.value, { maxDecimals });
        onChange({
          ...event,
          target: {
            ...event.target,
            name: name || event.target.name,
            value: raw,
          },
        });
      };

      const handleBlur = (event) => {
        if (onBlur) onBlur(event);
        if (value === "" || value == null || value === "-") return;

        const num = Number(value);
        if (!Number.isFinite(num)) return;
        let next = num;
        if (min != null && min !== "" && num < Number(min)) next = Number(min);
        if (max != null && max !== "" && num > Number(max)) next = Number(max);
        if (next !== num && onChange) {
          onChange({
            target: {
              name: name || "",
              value:
                maxDecimals == null ? String(Math.trunc(next)) : String(next),
            },
          });
        }
      };

      return (
        <div className="relative">
          <input
            type="text"
            inputMode={
              inputMode || (maxDecimals != null ? "decimal" : "numeric")
            }
            id={fieldId}
            name={name}
            value={displayValue}
            onChange={handleNumberChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            className={`${baseInputClasses} ${icon ? "pl-10" : ""}`}
            aria-valuemin={min != null && min !== "" ? Number(min) : undefined}
            aria-valuemax={max != null && max !== "" ? Number(max) : undefined}
            {...props}
          />
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-light">
              {icon}
            </div>
          )}
        </div>
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
          min={min}
          max={max}
          step={step}
          onBlur={onBlur}
          inputMode={inputMode}
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
      searchText: PropTypes.string,
    }),
  ),
  disabled: PropTypes.bool,
  rows: PropTypes.number,
  helperText: PropTypes.string,
  children: PropTypes.node,
  allowEmpty: PropTypes.bool,
  emptyLabel: PropTypes.string,
  /** Casas decimais; se omitido, deriva de `step` (inteiro por padrão). */
  decimals: PropTypes.number,
  step: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  min: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  max: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onBlur: PropTypes.func,
  inputMode: PropTypes.string,
};

export default FormField;
