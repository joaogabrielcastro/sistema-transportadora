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

const RegistroDetailModal = ({ registro, onClose }) => {
  if (!registro) return null;

  const { tipo } = registro;

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
        {tipo === "gasto" && (
          <>
            <Row label="Tipo" value={registro.tipos_gastos?.nome_tipo} />
            <Row label="Data" value={formatDate(registro.data_gasto)} />
            <Row label="Valor" value={formatCurrency(registro.valor)} highlight />
            <Row
              label="KM"
              value={
                registro.km_registro != null
                  ? Number(registro.km_registro).toLocaleString("pt-BR")
                  : "—"
              }
            />
            {registro.quantidade_combustivel != null && (
              <Row
                label="Combustível"
                value={`${registro.quantidade_combustivel} L`}
              />
            )}
            {registro.descricao && (
              <Row label="Descrição" value={registro.descricao} multiline />
            )}
          </>
        )}

        {tipo === "manutencao" && (
          <>
            <Row label="Item" value={registro.itens_checklist?.nome_item} />
            <Row label="Data" value={formatDate(registro.data_manutencao)} />
            <Row label="Valor" value={formatCurrency(registro.valor)} highlight />
            <Row
              label="KM"
              value={
                registro.km_manutencao != null
                  ? Number(registro.km_manutencao).toLocaleString("pt-BR")
                  : "—"
              }
            />
            {registro.oficina && <Row label="Oficina" value={registro.oficina} />}
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
            <Row
              label="KM instalação"
              value={
                registro.km_instalacao != null
                  ? Number(registro.km_instalacao).toLocaleString("pt-BR")
                  : "—"
              }
            />
            {registro.vida_util_km != null && (
              <Row
                label="Vida útil"
                value={`${Number(registro.vida_util_km).toLocaleString("pt-BR")} km`}
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
