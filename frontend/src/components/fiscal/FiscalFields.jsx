import React from "react";
import PropTypes from "prop-types";
import { FormField } from "../ui";
import {
  clampCpfCnpjDigits,
  formatCnpj,
  formatCpfCnpj,
  formatUf,
  normalizeMoneyRaw,
  normalizePercentRaw,
  MONEY_CEILING_14_2,
} from "../../utils/fiscalFieldMask.js";

/**
 * Campos reutilizáveis das telas fiscais (CT-e / MDF-e). São invólucros finos em
 * volta do `FormField` compartilhado — NÃO alteram o `FormField`, só adicionam
 * uma transformação de entrada/saída em cima dele. A lógica pura vive em
 * `utils/fiscalFieldMask.js` (testada lá).
 *
 * Contrato do `onChange`: todos emitem um evento com `e.target.value` já CRU
 * (dígitos para CPF/CNPJ, número puro para monetário/percentual, sigla
 * maiúscula para UF), para os formulários seguirem usando
 * `onChange={(e) => set("campo", e.target.value)}` como antes.
 */

function emit(onChange, event, name, value) {
  if (!onChange) return;
  onChange({
    ...event,
    target: { ...event.target, name: name ?? event.target?.name, value },
  });
}

/**
 * CPF/CNPJ: guarda só dígitos no estado, mostra formatado
 * (`000.000.000-00` / `00.000.000/0000-00`), `maxLength` visual conforme o
 * tamanho e nunca deixa passar de 14 dígitos (ou 11 quando `soCpf`).
 */
export function CpfCnpjField({
  value,
  onChange,
  name,
  soCpf = false,
  soCnpj = false,
  ...rest
}) {
  const maxDigits = soCpf ? 11 : 14;
  const digits = clampCpfCnpjDigits(value, maxDigits);
  const formatFn = soCnpj ? formatCnpj : formatCpfCnpj;
  const maxLen = soCnpj ? 18 : digits.length <= 11 ? 14 : 18;
  return (
    <FormField
      {...rest}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={maxLen}
      value={formatFn(digits)}
      onChange={(e) => emit(onChange, e, name, clampCpfCnpjDigits(e.target.value, maxDigits))}
    />
  );
}

CpfCnpjField.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  name: PropTypes.string,
  /** Campo que só aceita CPF (condutor): trava em 11 dígitos. */
  soCpf: PropTypes.bool,
  /** Campo que é SEMPRE CNPJ (seguradora): máscara fixa de CNPJ, 14 dígitos. */
  soCnpj: PropTypes.bool,
};

/**
 * Monetário: prefixo "R$" fixo, sem negativo, teto da coluna do banco
 * (`DECIMAL(14,2)` por padrão), 2 casas decimais. O valor no estado/payload é
 * número puro — o `FormField type="number"` já entrega cru no onChange; aqui só
 * aplicamos a trava.
 */
export function MoneyField({ value, onChange, name, ceiling = MONEY_CEILING_14_2, ...rest }) {
  return (
    <FormField
      {...rest}
      name={name}
      type="number"
      step="0.01"
      min={0}
      max={ceiling}
      inputMode="decimal"
      useGrouping={false}
      icon={<span className="text-sm font-medium text-text-light">R$</span>}
      value={value}
      onChange={(e) => emit(onChange, e, name, normalizeMoneyRaw(e.target.value))}
    />
  );
}

MoneyField.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  name: PropTypes.string,
  /** Teto máximo (o que a coluna DECIMAL aguenta). Default: DECIMAL(14,2). */
  ceiling: PropTypes.number,
};

/**
 * Percentual: 0 a 100, 2 casas decimais, sem negativo.
 */
export function PercentField({ value, onChange, name, ...rest }) {
  return (
    <FormField
      {...rest}
      name={name}
      type="number"
      step="0.01"
      min={0}
      max={100}
      inputMode="decimal"
      useGrouping={false}
      value={value}
      onChange={(e) => emit(onChange, e, name, normalizePercentRaw(e.target.value))}
    />
  );
}

PercentField.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  name: PropTypes.string,
};

/**
 * UF: só letras, exatamente 2, maiúsculas automáticas.
 */
export function UfField({ value, onChange, name, ...rest }) {
  return (
    <FormField
      {...rest}
      name={name}
      type="text"
      autoComplete="off"
      maxLength={2}
      value={formatUf(value)}
      onChange={(e) => emit(onChange, e, name, formatUf(e.target.value))}
    />
  );
}

UfField.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  name: PropTypes.string,
};
