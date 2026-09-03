import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";

export default function LegalLinks({ className = "mt-6 text-center text-xs text-text-light" }) {
  return (
    <p className={className}>
      <Link to="/termos" className="font-medium text-secondary hover:text-secondary-dark">
        Termos de uso
      </Link>
      <span className="mx-1.5">·</span>
      <Link to="/privacidade" className="font-medium text-secondary hover:text-secondary-dark">
        Privacidade
      </Link>
    </p>
  );
}

LegalLinks.propTypes = {
  className: PropTypes.string,
};
