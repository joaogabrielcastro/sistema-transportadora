import React from "react";
import PropTypes from "prop-types";
import { SALES_CONTACT_ENABLED, SALES_CONTACT_URL } from "../../commercial.js";
import { trackFunnel } from "../../utils/funnel.js";
import { Button } from "../ui";

export default function SalesContactButton({
  location,
  variant = "outline",
  size = "lg",
  className = "",
  label = "Agendar demonstração",
}) {
  if (!SALES_CONTACT_ENABLED) return null;
  const external = SALES_CONTACT_URL.startsWith("https://");

  return (
    <a
      href={SALES_CONTACT_URL}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      onClick={() => trackFunnel("cta_demo", { location })}
    >
      <Button variant={variant} size={size} className={className}>
        {label}
      </Button>
    </a>
  );
}

SalesContactButton.propTypes = {
  location: PropTypes.string.isRequired,
  variant: PropTypes.string,
  size: PropTypes.string,
  className: PropTypes.string,
  label: PropTypes.string,
};

