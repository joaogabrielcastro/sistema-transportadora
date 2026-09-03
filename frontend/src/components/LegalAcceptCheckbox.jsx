import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";

export default function LegalAcceptCheckbox({ checked, onChange, id = "acceptedLegal" }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 text-sm text-text-secondary cursor-pointer">
      <input
        id={id}
        name="acceptedLegal"
        type="checkbox"
        className="mt-1 rounded border-border"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
      />
      <span>
        Li e aceito os{" "}
        <Link
          to="/termos"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-secondary hover:text-secondary-dark"
        >
          Termos de uso
        </Link>{" "}
        e a{" "}
        <Link
          to="/privacidade"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-secondary hover:text-secondary-dark"
        >
          Política de privacidade
        </Link>
        .
      </span>
    </label>
  );
}

LegalAcceptCheckbox.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  id: PropTypes.string,
};
