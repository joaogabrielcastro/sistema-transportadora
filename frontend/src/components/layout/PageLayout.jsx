import React from "react";
import PropTypes from "prop-types";

/** Container de página com largura útil maior em telas wide. */
const PageLayout = ({ children, className = "", wide = true }) => (
  <div className="min-h-screen bg-background pt-24 pb-12 px-3 sm:px-6 lg:px-8">
    <div
      className={`mx-auto w-full animate-fade-in ${
        wide ? "max-w-[1600px]" : "max-w-7xl"
      } ${className}`}
    >
      {children}
    </div>
  </div>
);

PageLayout.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  wide: PropTypes.bool,
};

export default PageLayout;
