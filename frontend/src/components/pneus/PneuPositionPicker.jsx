import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { buildPositionDiagram } from "../../utils/pneuPosicaoMap.js";

const TireButton = ({ label, short, selected, onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title || label}
    className={`flex flex-col items-center justify-center min-w-[2.5rem] h-12 rounded-lg border-2 text-[10px] font-semibold transition-all ${
      selected
        ? "border-secondary bg-secondary/15 text-secondary shadow-sm scale-105"
        : "border-border bg-white text-text-secondary hover:border-secondary/50 hover:bg-secondary/5"
    }`}
  >
    <span className="text-base leading-none">⬤</span>
    <span>{short || label}</span>
  </button>
);

TireButton.propTypes = {
  label: PropTypes.string,
  short: PropTypes.string,
  selected: PropTypes.bool,
  onClick: PropTypes.func,
  title: PropTypes.string,
};

const DualAxle = ({ leftOuter, leftInner, rightInner, rightOuter, value, onSelect }) => (
  <div className="flex items-center justify-center gap-2">
    <div className="flex gap-1">
      {leftInner && (
        <TireButton
          short="EI"
          label={leftInner.nome_posicao}
          selected={value === String(leftInner.id)}
          onClick={() => onSelect(leftInner.id)}
        />
      )}
      {leftOuter && (
        <TireButton
          short="EE"
          label={leftOuter.nome_posicao}
          selected={value === String(leftOuter.id)}
          onClick={() => onSelect(leftOuter.id)}
        />
      )}
    </div>
    <div className="h-1 w-16 sm:w-24 bg-gray-300 rounded" />
    <div className="flex gap-1">
      {rightOuter && (
        <TireButton
          short="DE"
          label={rightOuter.nome_posicao}
          selected={value === String(rightOuter.id)}
          onClick={() => onSelect(rightOuter.id)}
        />
      )}
      {rightInner && (
        <TireButton
          short="DI"
          label={rightInner.nome_posicao}
          selected={value === String(rightInner.id)}
          onClick={() => onSelect(rightInner.id)}
        />
      )}
    </div>
  </div>
);

DualAxle.propTypes = {
  leftOuter: PropTypes.object,
  leftInner: PropTypes.object,
  rightInner: PropTypes.object,
  rightOuter: PropTypes.object,
  value: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

const axleLabel = (axle, index) => {
  if (axle.number >= 2) {
    return `Eixo ${axle.number}`;
  }
  return index === 0 ? "Eixo traseiro 1" : `Eixo traseiro ${index + 1}`;
};

const PneuPositionPicker = ({ posicoes, value, onChange, error, caminhao }) => {
  const diagram = useMemo(
    () => buildPositionDiagram(posicoes, caminhao),
    [posicoes, caminhao],
  );

  const selectedId = value ? String(value) : "";
  const pick = (id) => onChange(id ? String(id) : "");

  const hasFront = diagram.front.left || diagram.front.right;
  const hasAxles = diagram.axles.some(
    (axle) =>
      axle.leftOuter ||
      axle.leftInner ||
      axle.rightInner ||
      axle.rightOuter,
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-text-secondary mb-1">
          Posição no veículo <span className="text-danger">*</span>
        </p>
        {caminhao && (
          <p className="text-xs text-text-light mb-3">{diagram.layout.description}</p>
        )}

        {!caminhao && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
            Selecione o caminhão para exibir o diagrama correto (com ou sem carreta).
          </p>
        )}

        <div className="rounded-xl border border-border bg-gray-50/80 p-4 space-y-5">
          {hasFront && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Eixo dianteiro
              </p>
              <div className="flex items-center justify-center gap-8">
                {diagram.front.left && (
                  <TireButton
                    short="ESQ"
                    label={diagram.front.left.nome_posicao}
                    selected={selectedId === String(diagram.front.left.id)}
                    onClick={() => pick(diagram.front.left.id)}
                  />
                )}
                <div className="h-1 w-20 bg-gray-300 rounded" />
                {diagram.front.right && (
                  <TireButton
                    short="DIR"
                    label={diagram.front.right.nome_posicao}
                    selected={selectedId === String(diagram.front.right.id)}
                    onClick={() => pick(diagram.front.right.id)}
                  />
                )}
              </div>
            </div>
          )}

          {diagram.axles.map((axle, index) => {
            const hasTires =
              axle.leftOuter ||
              axle.leftInner ||
              axle.rightInner ||
              axle.rightOuter;

            if (!hasTires) return null;

            return (
              <div key={`axle-${axle.number}`}>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                  {axleLabel(axle, index)}
                </p>
                <DualAxle
                  leftOuter={axle.leftOuter}
                  leftInner={axle.leftInner}
                  rightInner={axle.rightInner}
                  rightOuter={axle.rightOuter}
                  value={selectedId}
                  onSelect={pick}
                />
              </div>
            );
          })}

          {diagram.spares.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Estepes
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {diagram.spares.map((spare, index) => (
                  <TireButton
                    key={spare.id}
                    short={`EST ${index + 1}`}
                    label={spare.nome_posicao}
                    selected={selectedId === String(spare.id)}
                    onClick={() => pick(spare.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasFront && !hasAxles && diagram.spares.length === 0 && (
            <p className="text-sm text-text-secondary text-center py-4">
              Nenhuma posição disponível para este veículo.
            </p>
          )}
        </div>

        {diagram.unmapped.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-text-secondary mb-2">
              Posições adicionais (fora do diagrama deste veículo):
            </p>
            <div className="flex flex-wrap gap-2">
              {diagram.unmapped.map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => pick(pos.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedId === String(pos.id)
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : "border-border bg-white text-text-secondary hover:bg-gray-50"
                  }`}
                >
                  {pos.nome_posicao}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
};

PneuPositionPicker.propTypes = {
  posicoes: PropTypes.arrayOf(PropTypes.object).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  caminhao: PropTypes.object,
};

export default PneuPositionPicker;
