// frontend/src/components/ui/Button.jsx
import React from "react";
import PropTypes from "prop-types";

const Button = ({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  loading = false,
  loadingText,
  onClick,
  className = "",
  icon,
  ...props
}) => {
  const baseClasses =
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    primary:
      "bg-primary text-white shadow-[0_1px_2px_rgba(11,19,36,0.2),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-primary-light",
    secondary:
      "bg-secondary text-white shadow-[0_1px_2px_rgba(8,145,178,0.25)] hover:bg-secondary-dark",
    danger:
      "bg-danger-dark text-white shadow-sm hover:bg-red-700",
    success:
      "bg-success-dark text-white shadow-sm hover:bg-emerald-700",
    outline:
      "border border-border bg-white text-text-primary shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-border-strong hover:bg-slate-50",
    ghost:
      "bg-transparent text-text-secondary hover:bg-slate-100 hover:text-text-primary",
  };

  const sizes = {
    xs: "min-h-8 px-2.5 text-xs",
    sm: "min-h-9 px-3 text-sm",
    md: "min-h-10 px-4 text-sm",
    lg: "min-h-12 px-6 text-base",
  };

  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={classes}
      {...props}
    >
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      ) : icon ? (
        <span className="inline-flex shrink-0" aria-hidden>{icon}</span>
      ) : null}
      {loading && loadingText ? loadingText : children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf([
    "primary",
    "secondary",
    "danger",
    "success",
    "outline",
    "ghost",
  ]),
  size: PropTypes.oneOf(["xs", "sm", "md", "lg"]),
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  loadingText: PropTypes.string,
  onClick: PropTypes.func,
  className: PropTypes.string,
  icon: PropTypes.node,
};

export default Button;
