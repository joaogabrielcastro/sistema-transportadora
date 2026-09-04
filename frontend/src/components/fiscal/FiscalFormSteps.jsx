import React from "react";
import PropTypes from "prop-types";
import Button from "../ui/Button.jsx";

/**
 * Navegação por fases nos formulários longos de CT-e / MDF-e / CIOT.
 * O estado dos campos fica no formulário pai; clicar numa fase só troca a vista.
 */
export function FiscalFormSteps({ steps, current, onSelect }) {
  return (
    <ol className="mb-4 flex flex-wrap gap-2">
      {steps.map((label, index) => {
        const ativa = index === current;
        const feita = index < current;
        return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                ativa
                  ? "bg-primary text-white"
                  : feita
                    ? "bg-primary/10 text-primary"
                    : "bg-gray-100 text-text-secondary hover:bg-gray-200"
              }`}
              aria-current={ativa ? "step" : undefined}
            >
              {index + 1}. {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

FiscalFormSteps.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.string).isRequired,
  current: PropTypes.number.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export function FiscalFormStepNav({
  current,
  total,
  onPrev,
  onNext,
  children,
}) {
  const ultima = current >= total - 1;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
      <Button
        type="button"
        variant="outline"
        disabled={current === 0}
        onClick={onPrev}
      >
        Voltar
      </Button>
      <div className="flex flex-wrap justify-end gap-2">
        {children}
        {!ultima && (
          <Button type="button" onClick={onNext}>
            Continuar
          </Button>
        )}
      </div>
    </div>
  );
}

FiscalFormStepNav.propTypes = {
  current: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  onPrev: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  children: PropTypes.node,
};
