import React from "react";
import PropTypes from "prop-types";
import { Modal, Button } from "./ui";

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—";

const formatKm = (value) => {
  if (value == null || value === "" || value === "N/A") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR");
};

const RegistroDetailModal = ({ registro, onClose }) => {
  if (!registro) return null;

  const { tipo } = registro;
  const placa = registro.placa || registro.caminhoes?.placa;

  return (
    <Modal
      isOpen={Boolean(registro)}
      onClose={onClose}
      title={
        tipo === "pneu"
          ? "Detalhes do pneu"
          : tipo === "gasto"
            ? "Detalhes do gasto"
            : "Detalhes da manutenção"
      }
      size="lg"
    >
      <div className="space-y-4">
        {placa && <Row label="Caminhão" value={placa} />}

        {tipo === "gasto" && (
          <>
            <Row
              label="Tipo"
              value={registro.nome_tipo || registro.tipos_gastos?.nome_tipo}
            />
            <Row
              label="Data"
              value={formatDate(registro.data || registro.data_gasto)}
            />
            <Row label="Valor" value={formatCurrency(registro.valor)} highlight />
            <Row label="KM" value={formatKm(registro.km_registro)} />
            {registro.quantidade_combustivel != null &&
              registro.quantidade_combustivel !== "N/A" && (
                <Row
                  label="Combustível"
                  value={`${registro.quantidade_combustivel} L`}
                />
              )}
            {(registro.descricao || registro.observacao) && (
              <Row
                label="Descrição"
                value={registro.descricao || registro.observacao}
                multiline
              />
            )}
          </>
        )}

        {tipo === "manutencao" && (
          <>
            <Row
              label="Serviço"
              value={registro.nome_tipo || registro.itens_checklist?.nome_item}
            />
            <Row
              label="Data"
              value={formatDate(registro.data || registro.data_manutencao)}
            />
            <Row label="Valor" value={formatCurrency(registro.valor)} highlight />
            <Row
              label="KM"
              value={formatKm(registro.km_manutencao ?? registro.km_registro)}
            />
            {registro.oficina && registro.oficina !== "N/A" && (
              <Row label="Oficina" value={registro.oficina} />
            )}
            {registro.proxima_km != null && registro.proxima_km !== "" && (
              <Row
                label="Próxima troca (KM)"
                value={formatKm(registro.proxima_km)}
              />
            )}
            {registro.proxima_data && (
              <Row
                label="Próxima troca (data)"
                value={formatDate(registro.proxima_data)}
              />
            )}
            {registro.observacao && (
              <Row label="Observações" value={registro.observacao} multiline />
            )}
          </>
        )}

        {tipo === "pneu" && (
          <>
            <Row
              label="Posição"
              value={registro.posicoes_pneus?.nome_posicao}
            />
            <Row
              label="Pneu"
              value={`${registro.marca || ""} ${registro.modelo || ""}`.trim()}
            />
            <Row
              label="Status"
              value={registro.status_pneus?.nome_status}
            />
            <Row
              label="Instalação"
              value={formatDate(registro.data_instalacao)}
            />
            <Row label="KM instalação" value={formatKm(registro.km_instalacao)} />
            {registro.vida_util_km != null && (
              <Row
                label="Vida útil"
                value={`${formatKm(registro.vida_util_km)} km`}
              />
            )}
            {registro.observacao && (
              <Row label="Observações" value={registro.observacao} multiline />
            )}
          </>
        )}

        <div className="pt-4 border-t border-border">
          <Button onClick={onClose} className="w-full sm:w-auto">
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const Row = ({ label, value, highlight = false, multiline = false }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-1">
      {label}
    </p>
    <p
      className={`text-sm ${highlight ? "text-lg font-bold text-primary" : "text-text-primary"} ${multiline ? "whitespace-pre-wrap" : ""}`}
    >
      {value || "—"}
    </p>
  </div>
);

Row.propTypes = {
  label: PropTypes.string,
  value: PropTypes.node,
  highlight: PropTypes.bool,
  multiline: PropTypes.bool,
};

RegistroDetailModal.propTypes = {
  registro: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

export default RegistroDetailModal;
