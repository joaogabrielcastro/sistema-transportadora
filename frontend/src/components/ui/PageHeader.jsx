import React from "react";
import PropTypes from "prop-types";

const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
    <div>
      <h1 className="text-3xl font-bold text-text-primary tracking-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-text-secondary mt-1 max-w-2xl">{subtitle}</p>
      )}
    </div>
    {actions && (
      <div className="flex flex-wrap gap-3 w-full md:w-auto">{actions}</div>
    )}
  </div>
);

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  actions: PropTypes.node,
};

export default PageHeader;
