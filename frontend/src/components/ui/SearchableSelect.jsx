import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";

const SearchableSelect = ({
  label,
  name,
  value,
  onChange,
  options = [],
  placeholder = "Buscar...",
  disabled = false,
  className = "",
  noResultsText = "Nenhum resultado encontrado",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();
  const fieldId = name || listId;

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return options;
    }

    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) ||
        String(option.value).toLowerCase().includes(term),
    );
  }, [options, query]);

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
    }
  };

  const inputClasses = `
    block w-full rounded-lg border border-border bg-white px-4 py-2.5 pr-10
    text-text-primary placeholder-text-light
    focus:border-transparent focus:outline-none focus:ring-2 focus:ring-secondary
    disabled:bg-gray-50 disabled:text-text-light disabled:cursor-not-allowed
    transition-all duration-200
  `;

  return (
    <div className={`mb-4 ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={fieldId}
          className="mb-1.5 block text-sm font-medium text-text-secondary"
        >
          {label}
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
          disabled={disabled}
          value={open ? query : selectedOption?.label || ""}
          placeholder={open ? placeholder : selectedOption?.label || placeholder}
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
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-white py-1 shadow-card"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = String(option.value) === String(value);

                return (
                  <li
                    key={String(option.value)}
                    role="option"
                    aria-selected={isSelected}
                    className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                      isSelected
                        ? "bg-secondary/10 font-medium text-secondary"
                        : "text-text-primary hover:bg-gray-50"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(option.value)}
                  >
                    {option.label}
                  </li>
                );
              })
            ) : (
              <li className="px-4 py-3 text-sm text-text-light">{noResultsText}</li>
            )}
          </ul>
        )}
      </div>
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
    }),
  ),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  noResultsText: PropTypes.string,
};

export default SearchableSelect;
