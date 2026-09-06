import React from "react";
import PropTypes from "prop-types";
import { FormField } from "../ui";
import {
  camposDetalheGasto,
  compactDetalhes,
  defaultStatusForKind,
  STATUS_PAGAMENTO_OPTIONS,
  tituloDetalheGasto,
} from "../../utils/gastoDetalhes.js";
import { classifyTipoGastoById } from "../../utils/tipoGastoUtils.js";

/**
 * Motorista, status de pagamento, vencimento e campos extras do tipo de gasto.
 */
export default function GastoDetalhesFields({
  tipoId,
  tiposGastos = [],
  motoristas = [],
  motoristaId,
  statusPagamento,
  dataVencimento,
  detalhes = {},
  onChange,
  className = "",
}) {
  const kind = classifyTipoGastoById(tipoId, tiposGastos);
  const campos = camposDetalheGasto(kind);
  const motoristaOptions = (Array.isArray(motoristas) ? motoristas : []).map(
    (m) => ({
      value: String(m.id),
      label: m.nome + (m.ativo === false ? " (inativo)" : ""),
    }),
  );

  const setDetalhe = (name, value) => {
    onChange?.({
      detalhes: { ...detalhes, [name]: value },
    });
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FormField
          label="Motorista"
          type="select"
          name="motorista_id"
          value={motoristaId || ""}
          onChange={(e) => onChange?.({ motorista_id: e.target.value })}
          options={[
            { value: "", label: "Sem motorista" },
            ...motoristaOptions,
          ]}
          helperText={
            kind === "multa"
              ? "Quem estava dirigindo no auto de infração."
              : "Opcional — quem gerou o gasto."
          }
          className="mb-0"
        />
        <FormField
          label="Situação"
          type="select"
          name="status_pagamento"
          value={statusPagamento || defaultStatusForKind(kind)}
          onChange={(e) => onChange?.({ status_pagamento: e.target.value })}
          options={STATUS_PAGAMENTO_OPTIONS}
          helperText={
            kind === "multa"
              ? "Pendente, pago ou em recurso. Vencidas entram em Alertas."
              : "Marque pendente quando ainda for pagar."
          }
          className="mb-0"
        />
        <FormField
          label="Vencimento"
          type="date"
          name="data_vencimento"
          value={dataVencimento || ""}
          onChange={(e) => onChange?.({ data_vencimento: e.target.value })}
          helperText={
            kind === "multa"
              ? "Prazo para pagar a multa. Aparece em Alertas se pendente."
              : "Opcional. Usado em Alertas se a situação for pendente."
          }
          className="mb-0"
        />
      </div>

      {campos.length > 0 && (
        <div className="mt-4">
          <p className="mb-3 text-sm font-semibold text-text-primary">
            {tituloDetalheGasto(kind)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campos.map((campo) => (
              <FormField
                key={campo.name}
                label={campo.label}
                type={campo.type || "text"}
                name={campo.name}
                value={detalhes[campo.name] ?? ""}
                onChange={(e) => setDetalhe(campo.name, e.target.value)}
                placeholder={campo.placeholder}
                maxLength={campo.maxLength}
                min={campo.min}
                max={campo.max}
                step={campo.step}
                options={campo.options}
                allowEmpty={campo.type === "select"}
                emptyLabel={campo.type === "select" ? "—" : undefined}
                className="mb-0"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

GastoDetalhesFields.propTypes = {
  tipoId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tiposGastos: PropTypes.array,
  motoristas: PropTypes.array,
  motoristaId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  statusPagamento: PropTypes.string,
  dataVencimento: PropTypes.string,
  detalhes: PropTypes.object,
  onChange: PropTypes.func,
  className: PropTypes.string,
};

export function payloadControleGasto(form, kind) {
  const status =
    form.status_pagamento || defaultStatusForKind(kind);
  return {
    motorista_id: form.motorista_id ? Number(form.motorista_id) : null,
    status_pagamento: status || null,
    data_vencimento: form.data_vencimento || null,
    detalhes: compactDetalhes(form.detalhes),
  };
}
