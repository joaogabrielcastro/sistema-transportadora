import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button, FormField, Modal } from "../ui";
import { UfField } from "./FiscalFields.jsx";

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/**
 * Encerramento de MDF-e. UF / município / data são gravados no ATrack.
 * O payload oficial da Brasil NFe (EncerrarManifestoTransporte) usa só
 * tipoAmbiente, chave, protocolo e numeroSequencial.
 */
export default function EncerrarMdfeModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}) {
  const [uf, setUf] = useState("");
  const [codigoMunicipio, setCodigoMunicipio] = useState("");
  const [nomeMunicipio, setNomeMunicipio] = useState("");
  const [dataEncerramento, setDataEncerramento] = useState("");

  useEffect(() => {
    if (isOpen) {
      setUf("");
      setCodigoMunicipio("");
      setNomeMunicipio("");
      setDataEncerramento(nowLocalInput());
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const body = {};
    if (uf.trim().length === 2) body.uf = uf.trim().toUpperCase();
    if (codigoMunicipio.trim()) body.codigo_municipio = codigoMunicipio.trim();
    if (nomeMunicipio.trim()) body.nome_municipio = nomeMunicipio.trim();
    if (dataEncerramento) {
      const d = new Date(dataEncerramento);
      if (!Number.isNaN(d.getTime())) body.data_encerramento = d.toISOString();
    }
    onConfirm(body);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Encerrar MDF-e"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary">
          O encerramento é enviado à SEFAZ via Brasil NFe. Informe o município
          de encerramento para o registro interno da viagem.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <UfField
            label="UF de encerramento"
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            className="mb-0"
          />
          <FormField
            label="Código do município (IBGE)"
            value={codigoMunicipio}
            onChange={(e) =>
              setCodigoMunicipio(e.target.value.replace(/\D/g, "").slice(0, 7))
            }
            maxLength={7}
            className="mb-0"
          />
          <FormField
            label="Nome do município"
            value={nomeMunicipio}
            onChange={(e) => setNomeMunicipio(e.target.value)}
            className="mb-0"
          />
          <FormField
            label="Data / hora"
            type="datetime-local"
            value={dataEncerramento}
            onChange={(e) => setDataEncerramento(e.target.value)}
            className="mb-0"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" loading={loading}>
            Encerrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

EncerrarMdfeModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};
