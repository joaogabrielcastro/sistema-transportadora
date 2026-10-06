import React from "react";
import PropTypes from "prop-types";

/** Container de página com largura útil maior em telas wide. */
const PageLayout = ({ children, className = "", wide = true, narrow = false }) => (
  <main className="min-h-full bg-background px-4 pb-12 pt-5 sm:px-6 sm:pt-6 xl:px-8">
    <div
      className={`mx-auto w-full ${
        narrow ? "max-w-2xl" : wide ? "max-w-[1600px]" : "max-w-7xl"
      } ${className}`}
    >
      {children}
    </div>
  </main>
);

PageLayout.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  wide: PropTypes.bool,
  narrow: PropTypes.bool,
};

export default PageLayout;
