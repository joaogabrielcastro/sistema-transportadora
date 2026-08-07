import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";

const SearchableSelect = ({
  label,
  name,
  value,
  onChange,
  options = [],
  placeholder = "Digite para buscar...",
  disabled = false,
  className = "",
  noResultsText = "Nenhum resultado encontrado",
  required = false,
  error,
  helperText,
  allowEmpty = false,
  emptyLabel = "Nenhum / limpar seleção",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();
  const fieldId = name || listId;

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const term = query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const base = allowEmpty
      ? [{ value: "", label: emptyLabel, searchText: emptyLabel }, ...options]
      : options;

    if (!term) return base;

    return base.filter((option) => {
      const hay = `${option.label || ""} ${option.searchText || ""} ${option.value || ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return hay.includes(term);
    });
  }, [options, query, allowEmpty, emptyLabel]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeList = () => {
    setOpen(false);
    setQuery("");
  };

  const handleSelect = (optionValue) => {
    onChange(String(optionValue));
    closeList();
    inputRef.current?.blur();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      closeList();
      inputRef.current?.blur();
      return;
    }

    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        setOpen(true);
        event.preventDefault();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filteredOptions.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const opt = filteredOptions[highlight];
      if (opt) handleSelect(opt.value);
    }
  };

  const inputClasses = `
    block w-full rounded-lg border bg-white px-4 py-2.5 pr-10
    text-text-primary placeholder-text-light
    focus:border-transparent focus:outline-none focus:ring-2
    disabled:bg-gray-50 disabled:text-text-light disabled:cursor-not-allowed
    transition-all duration-200
    ${
      error
        ? "border-danger focus:ring-danger"
        : "border-border focus:ring-secondary"
    }
  `;

  return (
    <div className={`mb-4 ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={fieldId}
          className="mb-1.5 block text-sm font-medium text-text-secondary"
        >
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          id={fieldId}
          name={name}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-required={required || undefined}
          disabled={disabled}
          value={open ? query : selectedOption?.label || ""}
          placeholder={
            open
              ? placeholder
              : selectedOption?.label || placeholder
          }
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={inputClasses}
          autoComplete="off"
        />

        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-text-light">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {open && !disabled && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-[60] mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-white py-1 shadow-card"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isSelected = String(option.value) === String(value);
                const isActive = index === highlight;

                return (
                  <li
                    key={`${String(option.value)}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                      isSelected
                        ? "bg-secondary/10 font-medium text-secondary"
                        : isActive
                          ? "bg-gray-100 text-text-primary"
                          : "text-text-primary hover:bg-gray-50"
                    }`}
                    onMouseEnter={() => setHighlight(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(option.value)}
                  >
                    {option.label}
                  </li>
                );
              })
            ) : (
              <li className="px-4 py-3 text-sm text-text-light">
                {noResultsText}
              </li>
            )}
          </ul>
        )}
      </div>

      {helperText && !error && (
        <p className="mt-1 text-xs text-text-light">{helperText}</p>
      )}
      {error && (
        <p className="mt-1 text-xs font-medium text-danger flex items-center">
          {error}
        </p>
      )}
    </div>
  );
};

SearchableSelect.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      label: PropTypes.string.isRequired,
      searchText: PropTypes.string,
    }),
  ),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  noResultsText: PropTypes.string,
  required: PropTypes.bool,
  error: PropTypes.string,
  helperText: PropTypes.string,
  allowEmpty: PropTypes.bool,
  emptyLabel: PropTypes.string,
};

export default SearchableSelect;
