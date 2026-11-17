import React from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";

/**
 * Trilha de navegação. "Início" é omitido (o menu lateral já leva ao painel) e
 * a trilha só aparece quando há um nível intermediário útil — ex.:
 * "Pneus / Estoque" ou "ABC1D23 / Editar". "Início / Página" não é exibido,
 * pois repetiria o título da própria página.
 */
const Breadcrumbs = ({ items: rawItems = [], className = "" }) => {
  const items = rawItems.filter((item, i) => !(i === 0 && item.label === "Início" && item.to === "/"));
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`mb-4 text-sm text-text-secondary ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && (
                <span className="text-text-light select-none" aria-hidden="true">
                  /
                </span>
              )}
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="hover:text-primary transition-colors font-medium"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast ? "text-text-primary font-medium" : "text-text-secondary"
                  }
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

Breadcrumbs.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      to: PropTypes.string,
    }),
  ),
  className: PropTypes.string,
};

export default Breadcrumbs;
