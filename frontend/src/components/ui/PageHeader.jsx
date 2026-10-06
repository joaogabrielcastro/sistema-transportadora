import React from "react";
import PropTypes from "prop-types";

const PageHeader = ({ title, subtitle, actions, centered = false }) => (
  <div
    className={`flex gap-4 border-b border-border pb-5 ${
      centered
        ? "flex-col items-center text-center"
        : "flex-col items-start md:flex-row md:items-center md:justify-between"
    }`}
  >
    <div className={centered ? "min-w-0 max-w-2xl" : "min-w-0"}>
      <h1 className="text-2xl font-bold text-text-primary tracking-tight break-words sm:text-[1.75rem]">
        {title}
      </h1>
      {subtitle && (
        <p
          className={`mt-1.5 text-sm leading-6 text-text-secondary ${
            centered ? "mx-auto" : "max-w-2xl"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
    {actions && (
      <div
        className={`flex w-full flex-wrap gap-2 md:w-auto ${
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
