import React from "react";
import PropTypes from "prop-types";
import { mapPosicoesToSlots } from "../../utils/pneuPosicaoMap.js";

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
      <TireButton
        short="EI"
        label={leftInner?.nome_posicao}
        selected={value === String(leftInner?.id)}
        onClick={() => leftInner && onSelect(leftInner.id)}
      />
      <TireButton
        short="EE"
        label={leftOuter?.nome_posicao}
        selected={value === String(leftOuter?.id)}
        onClick={() => leftOuter && onSelect(leftOuter.id)}
      />
    </div>
    <div className="h-1 w-16 sm:w-24 bg-gray-300 rounded" />
    <div className="flex gap-1">
      <TireButton
        short="DE"
        label={rightOuter?.nome_posicao}
        selected={value === String(rightOuter?.id)}
        onClick={() => rightOuter && onSelect(rightOuter.id)}
      />
      <TireButton
        short="DI"
        label={rightInner?.nome_posicao}
        selected={value === String(rightInner?.id)}
        onClick={() => rightInner && onSelect(rightInner.id)}
      />
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

const PneuPositionPicker = ({ posicoes, value, onChange, error }) => {
  const { bySlot, unmapped } = mapPosicoesToSlots(posicoes);
  const selectedId = value ? String(value) : "";

  const pick = (id) => onChange(id ? String(id) : "");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-text-secondary mb-3">
          Posição no veículo <span className="text-danger">*</span>
        </p>

        <div className="rounded-xl border border-border bg-gray-50/80 p-4 space-y-5">
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Eixo dianteiro
            </p>
            <div className="flex items-center justify-center gap-8">
              <TireButton
                short="ESQ"
                label={bySlot["front-left"]?.nome_posicao}
                selected={selectedId === String(bySlot["front-left"]?.id)}
                onClick={() => pick(bySlot["front-left"]?.id)}
              />
              <div className="h-1 w-20 bg-gray-300 rounded" />
              <TireButton
                short="DIR"
                label={bySlot["front-right"]?.nome_posicao}
                selected={selectedId === String(bySlot["front-right"]?.id)}
                onClick={() => pick(bySlot["front-right"]?.id)}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Eixo traseiro 1
            </p>
            <DualAxle
              leftOuter={bySlot["rear1-left-outer"]}
              leftInner={bySlot["rear1-left-inner"]}
              rightInner={bySlot["rear1-right-inner"]}
              rightOuter={bySlot["rear1-right-outer"]}
              value={selectedId}
              onSelect={pick}
            />
          </div>

          {(bySlot["rear2-left-outer"] ||
            bySlot["rear2-right-outer"] ||
            bySlot["rear2-left-inner"]) && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Eixo traseiro 2
              </p>
              <DualAxle
                leftOuter={bySlot["rear2-left-outer"]}
                leftInner={bySlot["rear2-left-inner"]}
                rightInner={bySlot["rear2-right-inner"]}
                rightOuter={bySlot["rear2-right-outer"]}
                value={selectedId}
                onSelect={pick}
              />
            </div>
          )}

          {(bySlot["spare-1"] || bySlot["spare-2"]) && (
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Estepes
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {bySlot["spare-1"] && (
                  <TireButton
                    short="EST 1"
                    label={bySlot["spare-1"].nome_posicao}
                    selected={selectedId === String(bySlot["spare-1"].id)}
                    onClick={() => pick(bySlot["spare-1"].id)}
                  />
                )}
                {bySlot["spare-2"] && (
                  <TireButton
                    short="EST 2"
                    label={bySlot["spare-2"].nome_posicao}
                    selected={selectedId === String(bySlot["spare-2"].id)}
                    onClick={() => pick(bySlot["spare-2"].id)}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {unmapped.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-text-secondary mb-2">Outras posições:</p>
            <div className="flex flex-wrap gap-2">
              {unmapped.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedId === String(p.id)
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : "border-border bg-white text-text-secondary hover:bg-gray-50"
                  }`}
                >
                  {p.nome_posicao}
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
};

export default PneuPositionPicker;
