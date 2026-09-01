import React from "react";
import PropTypes from "prop-types";

const PageHeader = ({ title, subtitle, actions, centered = false }) => (
  <div
    className={`flex animate-fade-in gap-4 ${
      centered
        ? "flex-col items-center text-center"
        : "flex-col items-start md:flex-row md:items-center md:justify-between"
    }`}
  >
    <div className={centered ? "min-w-0 max-w-2xl" : "min-w-0"}>
      <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight break-words">
        {title}
      </h1>
      {subtitle && (
        <p
          className={`text-text-secondary mt-1 text-sm sm:text-base ${
            centered ? "mx-auto" : "max-w-2xl"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
    {actions && (
      <div
        className={`flex flex-wrap gap-3 w-full md:w-auto ${
          centered ? "justify-center" : ""
        }`}
      >
        {actions}
      </div>
    )}
  </div>
);

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  actions: PropTypes.node,
  centered: PropTypes.bool,
};

export default PageHeader;
