import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";

const toneStyles = {
  blue: { icon: "bg-blue-50 text-blue-600 ring-blue-100", bar: "bg-blue-500" },
  green: { icon: "bg-emerald-50 text-emerald-600 ring-emerald-100", bar: "bg-emerald-500" },
  purple: { icon: "bg-violet-50 text-violet-600 ring-violet-100", bar: "bg-violet-500" },
  orange: { icon: "bg-orange-50 text-orange-600 ring-orange-100", bar: "bg-orange-500" },
  amber: { icon: "bg-amber-50 text-amber-600 ring-amber-100", bar: "bg-amber-500" },
  cyan: { icon: "bg-cyan-50 text-cyan-700 ring-cyan-100", bar: "bg-cyan-500" },
  red: { icon: "bg-red-50 text-red-600 ring-red-100", bar: "bg-red-500" },
  slate: { icon: "bg-slate-100 text-slate-600 ring-slate-200", bar: "bg-slate-400" },
};

/**
 * Indicador numérico. `layout="dashboard"` (padrão) mostra rótulo, valor e dica;
 * `layout="compact"` cabe em faixas de KPIs dentro de páginas de detalhe.
 * `emphasis` destaca indicadores que pedem ação (ex.: vencidos > 0).
 */
const StatCard = ({
  title,
  value,
  icon,
  color = "blue",
  layout = "dashboard",
  hint,
  to,
  className = "",
  emphasis = false,
  loading = false,
}) => {
  const styles = toneStyles[color] || toneStyles.blue;
  const valueNode = loading ? (
    <span className="inline-block h-7 w-20 animate-pulse rounded bg-slate-200 align-middle" aria-label="Carregando" />
  ) : (
    value
  );

  if (layout === "compact") {
    return (
      <div className={`card p-4 ${className}`}>
        <div className="flex items-center gap-3">
          {icon ? (
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${styles.icon}`}>
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-text-secondary">{title}</p>
            <div className="truncate text-lg font-semibold tabular-nums text-text-primary">{valueNode}</div>
            {hint ? <p className="mt-0.5 truncate text-xs text-text-secondary">{hint}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-text-secondary">{title}</p>
        {icon ? (
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset [&>svg]:h-4 [&>svg]:w-4 ${styles.icon}`}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div
        className={`mt-1 break-words text-xl font-semibold leading-tight tracking-tight tabular-nums sm:text-[1.65rem] ${
          emphasis ? "text-red-700" : "text-text-primary"
        }`}
      >
        {valueNode}
      </div>
      {hint || to ? (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-text-secondary">
          <span className="min-w-0 truncate">{hint}</span>
          {to ? (
            <span
              aria-hidden
              className="shrink-0 text-text-light transition-transform group-hover:translate-x-0.5 group-hover:text-secondary"
            >
              →
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const classes = `group relative block overflow-hidden rounded-xl border bg-white p-4 shadow-card transition-[border-color,box-shadow] sm:p-5 ${
    emphasis ? "border-red-200" : "border-border"
  } ${
    to
      ? "hover:border-border-strong hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
      : ""
  } ${className}`;

  if (!to) return <div className={classes}>{content}</div>;
  if (to.startsWith("#")) {
    return (
      <a href={to} className={classes}>
        {content}
      </a>
    );
  }
  return (
    <Link to={to} className={classes}>
      {content}
    </Link>
  );
};

StatCard.propTypes = {
  title: PropTypes.node.isRequired,
  value: PropTypes.node,
  icon: PropTypes.node,
  color: PropTypes.oneOf(["blue", "green", "purple", "orange", "amber", "cyan", "red", "slate"]),
  layout: PropTypes.oneOf(["dashboard", "compact"]),
  hint: PropTypes.node,
  to: PropTypes.string,
  className: PropTypes.string,
  emphasis: PropTypes.bool,
  loading: PropTypes.bool,
};

export default StatCard;
