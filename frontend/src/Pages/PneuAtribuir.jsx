import React, { useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useApiMutation, usePneuAtribuirQueries } from "../hooks";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import PneuPositionPicker from "../components/pneus/PneuPositionPicker.jsx";
import {
  Card,
  Button,
  LoadingSpinner,
  FormField,
  Alert,
  PageHeader,
} from "../components/ui";
import { isPosicaoAllowedForCaminhao } from "../utils/pneuPosicaoMap.js";

const today = () => new Date().toISOString().split("T")[0];

const createRow = (overrides = {}) => ({
  id: Date.now() + Math.random(),
  modo: "estoque",
  stock_pneu_id: "",
  marca: "",
  modelo: "",
  posicao_id: "",
  observacao: "",
  ...overrides,
});

const PneuAtribuir = () => {
  const { post } = useApiMutation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const caminhaoIdFromState = location.state?.caminhaoId;
  const initialPneuId = searchParams.get("pneu_id") || "";

  const { pneus, caminhoes, posicoes, statusOptions, isLoading: loading } =
    usePneuAtribuirQueries();

  const defaultStatusId = useMemo(() => {
    const emUso =
      statusOptions.find((s) => /em uso/i.test(s.nome_status || "")) ||
      statusOptions[0];
    return emUso ? String(emUso.id) : "";
  }, [statusOptions]);

  const [caminhaoId, setCaminhaoId] = useState(
    caminhaoIdFromState ? String(caminhaoIdFromState) : "",
  );
  const [dataInstalacao, setDataInstalacao] = useState(today());
  const [kmInstalacao, setKmInstalacao] = useState("");
  const [statusId, setStatusId] = useState("");
  const [rows, setRows] = useState([createRow()]);
  const [activeRowId, setActiveRowId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [rowErrors, setRowErrors] = useState({});

  useEffect(() => {
    if (defaultStatusId && !statusId) {
      setStatusId(defaultStatusId);
    }
  }, [defaultStatusId, statusId]);

  useEffect(() => {
    if (!initialPneuId || rows[0]?.stock_pneu_id) return;
    setRows([
      createRow({ stock_pneu_id: initialPneuId, modo: "estoque" }),
    ]);
    setActiveRowId(null);
  }, [initialPneuId]);

  useEffect(() => {
    if (rows.length && !activeRowId) {
      setActiveRowId(rows[0].id);
    }
  }, [rows, activeRowId]);

  const caminhaoSelecionado = useMemo(
    () => caminhoes.find((c) => String(c.id) === String(caminhaoId)),
    [caminhoes, caminhaoId],
  );

  useEffect(() => {
    if (caminhaoSelecionado?.km_atual != null && !kmInstalacao) {
      setKmInstalacao(String(caminhaoSelecionado.km_atual));
    }
  }, [caminhaoSelecionado, kmInstalacao]);

  const activeRow = rows.find((r) => r.id === activeRowId) || rows[0];
  const activeIndex = rows.findIndex((r) => r.id === activeRow?.id);

  const usedStockIds = useMemo(
    () =>
      new Set(
        rows
          .map((r) => r.stock_pneu_id)
          .filter(Boolean)
          .map(String),
      ),
    [rows],
  );

  const occupiedPositionIds = useMemo(
    () =>
      rows
        .filter((r) => r.id !== activeRow?.id && r.posicao_id)
        .map((r) => String(r.posicao_id)),
    [rows, activeRow?.id],
  );

  const stockOptionsForRow = (row) =>
    pneus
      .filter(
        (p) =>
          String(p.id) === String(row.stock_pneu_id) ||
          !usedStockIds.has(String(p.id)),
      )
      .map((p) => ({
        value: String(p.id),
        label: `${p.marca} ${p.modelo}${p.dot ? ` (DOT: ${p.dot})` : ""}`,
      }));

  const handleCaminhaoChange = (e) => {
    const nextId = e.target.value;
    const caminhao = caminhoes.find((c) => String(c.id) === nextId);
    setCaminhaoId(nextId);
    setKmInstalacao(
      caminhao?.km_atual != null ? String(caminhao.km_atual) : "",
    );
    setRows((prev) =>
      prev.map((row) => {
        if (
          row.posicao_id &&
          !isPosicaoAllowedForCaminhao(row.posicao_id, posicoes, caminhao)
        ) {
          return { ...row, posicao_id: "" };
        }
        return row;
      }),
    );
  };

  const updateRow = (id, patch) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
    if (rowErrors[id]) {
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleAddRow = () => {
    const row = createRow();
    setRows((prev) => [...prev, row]);
    setActiveRowId(row.id);
  };

  const handleRemoveRow = (id) => {
    if (rows.length <= 1) return;
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (activeRowId === id) {
        setActiveRowId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const getPosicaoLabel = (posicaoId) => {
    const pos = posicoes.find((p) => String(p.id) === String(posicaoId));
    return pos?.nome_posicao || "Posição selecionada";
  };

  const validate = () => {
    const errors = {};
    let message = "";

    if (!caminhaoId) {
      message = "Selecione um caminhão.";
    }
    if (!statusId) {
      message = message || "Selecione o status inicial.";
    }
    if (!dataInstalacao) {
      message = message || "Informe a data de instalação.";
    }

    const positions = new Set();
    rows.forEach((row, index) => {
      const rowErr = {};
      if (row.modo === "estoque" && !row.stock_pneu_id) {
        rowErr.stock_pneu_id = "Selecione o pneu do estoque.";
      }
      if (row.modo === "novo") {
        if (!row.marca?.trim()) rowErr.marca = "Marca é obrigatória.";
        if (!row.modelo?.trim()) rowErr.modelo = "Modelo é obrigatório.";
      }
      if (!row.posicao_id) {
        rowErr.posicao_id = "Selecione a posição no diagrama.";
      } else if (positions.has(String(row.posicao_id))) {
        rowErr.posicao_id = "Posição já usada por outro pneu.";
      } else {
        positions.add(String(row.posicao_id));
      }
      if (Object.keys(rowErr).length) {
        errors[row.id] = rowErr;
        if (!message) {
          message = `Revise o pneu ${index + 1}.`;
        }
      }
    });

    setRowErrors(errors);
    setFormError(message);
    return !message && Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const km = kmInstalacao ? parseInt(kmInstalacao, 10) : null;
      const stockRows = rows.filter((r) => r.modo === "estoque");
      const newRows = rows.filter((r) => r.modo === "novo");

      await Promise.all(
        stockRows.map((row) =>
          post("/pneus", {
            stock_pneu_id: parseInt(row.stock_pneu_id, 10),
            caminhao_id: parseInt(caminhaoId, 10),
            posicao_id: parseInt(row.posicao_id, 10),
            status_id: parseInt(statusId, 10),
            data_instalacao: dataInstalacao,
            km_instalacao: km,
            observacao: row.observacao || null,
          }),
        ),
      );

      if (newRows.length > 0) {
        await post("/pneus/bulk", {
          pneus: newRows.map((row) => ({
            caminhao_id: parseInt(caminhaoId, 10),
            marca: row.marca.trim(),
            modelo: row.modelo.trim(),
            posicao_id: parseInt(row.posicao_id, 10),
            status_id: parseInt(statusId, 10),
            data_instalacao: dataInstalacao,
            km_instalacao: km ?? 0,
            observacao: row.observacao || null,
          })),
        });
      }

      const placa = caminhaoSelecionado?.placa;
      setTimeout(() => {
        if (placa) navigate(`/caminhao/${placa}`);
        else navigate("/pneus");
      }, 1200);
    } catch (err) {
      console.error(err);
      setFormError(err?.message || "Erro ao instalar pneus.");
      if (err?.fieldErrors) {
        setRowErrors((prev) => ({ ...prev, form: err.fieldErrors }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-24">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <PageLayout className="space-y-6 max-w-6xl">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: "Pneus", to: "/pneus" },
          { label: "Instalar pneus" },
        ]}
      />
      <PageHeader
        title="Instalar pneus no caminhão"
        subtitle="Use o estoque ou cadastre pneus novos em lote — toque no diagrama para definir a posição de cada um."
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormField
              label="Caminhão"
              type="select"
              value={caminhaoId}
              onChange={handleCaminhaoChange}
              placeholder="Selecione o caminhão"
              required
              options={caminhoes.map((c) => ({
                value: String(c.id),
                label: `${c.placa} - ${c.motorista || c.modelo || "Sem motorista"}`,
              }))}
            />
            <FormField
              label="Data de instalação"
              type="date"
              value={dataInstalacao}
              onChange={(e) => setDataInstalacao(e.target.value)}
              max={today()}
              required
            />
            <FormField
              label="KM do caminhão"
              type="number"
              value={kmInstalacao}
              onChange={(e) => setKmInstalacao(e.target.value)}
              placeholder="Ex: 154000"
              helperText="KM no momento da instalação"
            />
            <FormField
              label="Status inicial"
              type="select"
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              placeholder="Selecione o status"
              required
              options={statusOptions.map((s) => ({
                value: String(s.id),
                label: s.nome_status || s.descricao || `Status ${s.id}`,
              }))}
              helperText="Geralmente «Em uso» para pneus instalados."
            />
          </div>

          {formError && <Alert type="error" message={formError} />}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              {rows.map((row, index) => {
                const isActive = row.id === activeRow?.id;
                const errs = rowErrors[row.id] || {};
                return (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveRowId(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setActiveRowId(row.id);
                      }
                    }}
                    className={`rounded-xl border p-4 transition-all cursor-pointer ${
                      isActive
                        ? "border-secondary bg-secondary/5 ring-2 ring-secondary/20"
                        : "border-border bg-gray-50/50 hover:border-secondary/40"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div>
                        <h3 className="font-semibold text-text-primary">
                          Pneu {index + 1}
                          {isActive && (
                            <span className="ml-2 text-xs font-normal text-secondary">
                              (selecionado no diagrama)
                            </span>
                          )}
                        </h3>
                        {row.posicao_id && (
                          <p className="text-xs text-text-secondary mt-0.5">
                            Posição: {getPosicaoLabel(row.posicao_id)}
                          </p>
                        )}
                      </div>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRow(row.id);
                          }}
                          className="text-danger hover:bg-red-50 p-1 rounded-lg"
                          title="Remover pneu"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div
                      className="flex gap-2 mb-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          updateRow(row.id, {
                            modo: "estoque",
                            marca: "",
                            modelo: "",
                          })
                        }
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                          row.modo === "estoque"
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-text-secondary border-border"
                        }`}
                      >
                        Do estoque
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateRow(row.id, {
                            modo: "novo",
                            stock_pneu_id: "",
                          })
                        }
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                          row.modo === "novo"
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-text-secondary border-border"
                        }`}
                      >
                        Pneu novo
                      </button>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      {row.modo === "estoque" ? (
                        <FormField
                          label="Pneu em estoque"
                          type="select"
                          value={row.stock_pneu_id}
                          onChange={(e) =>
                            updateRow(row.id, {
                              stock_pneu_id: e.target.value,
                            })
                          }
                          placeholder="Selecione o pneu"
                          error={errs.stock_pneu_id}
                          options={stockOptionsForRow(row)}
                          className="mb-3"
                        />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <FormField
                            label="Marca"
                            value={row.marca}
                            onChange={(e) =>
                              updateRow(row.id, { marca: e.target.value })
                            }
                            placeholder="Ex: Michelin"
                            error={errs.marca}
                            className="mb-0"
                          />
                          <FormField
                            label="Modelo"
                            value={row.modelo}
                            onChange={(e) =>
                              updateRow(row.id, { modelo: e.target.value })
                            }
                            placeholder="Ex: XZY-123"
                            error={errs.modelo}
                            className="mb-0"
                          />
                        </div>
                      )}

                      <FormField
                        label="Observação (opcional)"
                        type="textarea"
                        value={row.observacao}
                        onChange={(e) =>
                          updateRow(row.id, { observacao: e.target.value })
                        }
                        rows={2}
                        placeholder="Detalhes adicionais..."
                        className="mb-0"
                      />
                      {errs.posicao_id && (
                        <p className="text-xs font-medium text-danger mt-2">
                          {errs.posicao_id}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={handleAddRow}
                className="w-full border-dashed"
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                }
              >
                Adicionar outro pneu
              </Button>
            </div>

            <div className="xl:sticky xl:top-28">
              <PneuPositionPicker
                posicoes={posicoes}
                caminhao={caminhaoSelecionado}
                value={activeRow?.posicao_id || ""}
                occupiedIds={occupiedPositionIds}
                hint={
                  activeRow
                    ? `Toque na posição para o Pneu ${activeIndex + 1}.`
                    : undefined
                }
                onChange={(posicaoId) => {
                  if (!activeRow) return;
                  updateRow(activeRow.id, { posicao_id: posicaoId });
                }}
                error={rowErrors[activeRow?.id]?.posicao_id}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/pneus")}
              disabled={submitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" loading={submitting} className="flex-1">
              {`Instalar ${rows.length} pneu(s)`}
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
};

export default PneuAtribuir;
