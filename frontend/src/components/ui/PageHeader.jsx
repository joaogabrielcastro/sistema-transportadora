import React from "react";
import PropTypes from "prop-types";

/**
 * Cabeçalho de página: título forte, contexto curto e ações à direita.
 * `eyebrow` identifica o módulo; `meta` mostra contadores/estado ao lado do título.
 */
const PageHeader = ({ title, subtitle, actions, centered = false, eyebrow, meta }) => (
  <div
    className={`flex gap-4 ${
      centered
        ? "flex-col items-center text-center"
        : "flex-col items-start md:flex-row md:items-end md:justify-between"
    }`}
  >
    <div className={centered ? "min-w-0 max-w-2xl" : "min-w-0"}>
      {eyebrow ? (
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary-dark">
          {eyebrow}
        </p>
      ) : null}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${centered ? "justify-center" : ""}`}>
        <h1 className="break-words text-[1.5rem] font-bold leading-tight tracking-tight text-text-primary sm:text-[1.75rem]">
          {title}
        </h1>
        {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
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
        className={`flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0 ${
          centered ? "justify-center" : "md:justify-end"
        }`}
      >
        {actions}
      </div>
    )}
  </div>
);

PageHeader.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
  centered: PropTypes.bool,
  eyebrow: PropTypes.node,
  meta: PropTypes.node,
};

export default PageHeader;
