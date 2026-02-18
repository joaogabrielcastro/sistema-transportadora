import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useApi } from "../hooks/useApi.js";
import {
  Card,
  Button,
  Alert,
  LoadingSpinner,
  FormField,
} from "../components/ui";
import { Link } from "react-router-dom";

const PneusEstoque = () => {
  const { get, post, loading, error } = useApi();
  const [pneus, setPneus] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [pneusBulk, setPneusBulk] = useState([
    {
      id: Date.now(),
      marca: "",
      modelo: "",
      status_id: "",
      vida_util_km: "",
      observacao: "",
    },
  ]);
  const [success, setSuccess] = useState("");
  const [bulkErrors, setBulkErrors] = useState({});

  const pneuLineSchema = z.object({
    marca: z.string().min(1, "Marca é obrigatória"),
    modelo: z.string().min(1, "Modelo é obrigatório"),
    status_id: z.preprocess((v) => Number(v), z.number().int().positive()),
    vida_util_km: z.preprocess(
      (v) => (v === "" || v == null ? null : Number(v)),
      z.number().int().nonnegative().nullable(),
    ),
    observacao: z.string().optional().nullable(),
  });

  const fetchEstoque = async () => {
    try {
      const res = await get("/pneus/in-stock");
      setPneus(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEstoque();
  }, []);

  const validateLine = (line) => {
    const input = {
      marca: line.marca,
      modelo: line.modelo,
      status_id: line.status_id,
      vida_util_km: line.vida_util_km === "" ? null : line.vida_util_km,
      observacao: line.observacao || null,
    };

    const result = pneuLineSchema.safeParse(input);
    if (result.success) return {};

    const errs = {};
    (result.error.issues || []).forEach((issue) => {
      const key = issue.path && issue.path.length ? issue.path[0] : "form";
      errs[key] = issue.message;
    });
    return errs;
  };

  const handleBulkFieldChange = (id, field, value) => {
    setPneusBulk((prev) => {
      const next = prev.map((p) =>
        p.id === id ? { ...p, [field]: value } : p,
      );
      const updated = next.find((p) => p.id === id);
      // update errors for this line
      setBulkErrors((prevErr) => ({ ...prevErr, [id]: validateLine(updated) }));
      return next;
    });
  };

  // carregar lista de status para contagens e selects
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await get("/status-pneus");
        setStatusList(res.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadStatus();
  }, [get]);

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Estoque de Pneus</h1>

        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}

        {/* Formulário único removido: mantemos apenas o cadastro em lote abaixo */}

        <Card title="Cadastro em Lote (estoque)" className="mt-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();

              // Validar cada linha
              const toCreate = [];
              const newBulkErrors = {};
              for (const line of pneusBulk) {
                const parsed = pneuLineSchema.safeParse({
                  marca: line.marca,
                  modelo: line.modelo,
                  status_id: line.status_id,
                  vida_util_km:
                    line.vida_util_km === "" ? null : line.vida_util_km,
                  observacao: line.observacao || null,
                });
                if (!parsed.success) {
                  const errs = {};
                  (parsed.error.issues || []).forEach((issue) => {
                    const key =
                      issue.path && issue.path.length ? issue.path[0] : "form";
                    errs[key] = issue.message;
                  });
                  newBulkErrors[line.id] = errs;
                } else {
                  toCreate.push(parsed.data);
                }
              }

              if (Object.keys(newBulkErrors).length > 0) {
                setBulkErrors(newBulkErrors);
                alert(
                  "Existem linhas com dados inválidos. Verifique os campos.",
                );
                return;
              }

              try {
                await post("/pneus/stock/bulk", { pneus: toCreate });
                setSuccess("Pneus adicionados ao estoque com sucesso");
                setTimeout(() => setSuccess(""), 4000);
                fetchEstoque();
                // reset form
                setPneusBulk([
                  {
                    id: Date.now(),
                    marca: "",
                    modelo: "",
                    status_id: "",
                    vida_util_km: "",
                    observacao: "",
                  },
                ]);
                setBulkErrors({});
              } catch (err) {
                console.error(err);
                alert("Erro ao enviar pneus. Veja o console para detalhes.");
              }
            }}
          >
            <div className="space-y-4">
              {pneusBulk.map((line, idx) => (
                <div key={line.id} className="border p-4 rounded">
                  <div className="flex justify-between items-center mb-3">
                    <strong>Pneu {idx + 1}</strong>
                    {pneusBulk.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPneusBulk((prev) =>
                            prev.filter((p) => p.id !== line.id),
                          )
                        }
                        className="text-red-600"
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField
                      label="Marca"
                      name="marca"
                      value={line.marca}
                      onChange={(e) =>
                        handleBulkFieldChange(line.id, "marca", e.target.value)
                      }
                      required
                      error={bulkErrors[line.id]?.marca}
                    />
                    <FormField
                      label="Modelo"
                      name="modelo"
                      value={line.modelo}
                      onChange={(e) =>
                        handleBulkFieldChange(line.id, "modelo", e.target.value)
                      }
                      required
                      error={bulkErrors[line.id]?.modelo}
                    />
                    <FormField
                      label="Status"
                      type="select"
                      name="status_id"
                      value={line.status_id}
                      onChange={(e) =>
                        handleBulkFieldChange(
                          line.id,
                          "status_id",
                          e.target.value,
                        )
                      }
                      options={(statusList || [])
                        .filter((s) =>
                          [
                            "Novo no estoque",
                            "Recapado no estoque",
                            "Aprovado para uso",
                          ].includes(s.nome_status),
                        )
                        .map((s) => ({
                          value: s.id,
                          label: s.nome_status,
                        }))}
                      required
                      error={bulkErrors[line.id]?.status_id}
                    />
                    <FormField
                      label="Vida útil (KM)"
                      name="vida_util_km"
                      type="number"
                      value={line.vida_util_km}
                      onChange={(e) =>
                        handleBulkFieldChange(
                          line.id,
                          "vida_util_km",
                          e.target.value,
                        )
                      }
                      error={bulkErrors[line.id]?.vida_util_km}
                    />
                    <FormField
                      label="Observação"
                      name="observacao"
                      value={line.observacao}
                      onChange={(e) =>
                        handleBulkFieldChange(
                          line.id,
                          "observacao",
                          e.target.value,
                        )
                      }
                      error={bulkErrors[line.id]?.observacao}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setPneusBulk((prev) => [
                    ...prev,
                    {
                      id: Date.now(),
                      marca: "",
                      modelo: "",
                      status_id: "",
                      vida_util_km: "",
                      observacao: "",
                    },
                  ])
                }
              >
                Adicionar outro pneu
              </Button>
              <Button type="submit">
                Cadastrar {pneusBulk.length} Pneu(s) no Estoque
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Pneus em Estoque">
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Resumo do Estoque</h3>
            <div className="flex flex-wrap gap-2">
              {statusList
                .filter((s) => {
                  // Filtra apenas status relevantes para estoque ou que tenham pneus
                  const count = (pneus || []).filter(
                    (p) => p.status_id === s.id,
                  ).length;
                  const statusEstoque = [
                    "Novo no estoque",
                    "Recapado no estoque",
                    "Aprovado para uso",
                    "Aguardando inspeção",
                    "Em manutenção",
                    "Sucata",
                  ];
                  return statusEstoque.includes(s.nome_status) || count > 0;
                })
                .map((s) => {
                  const count = (pneus || []).filter(
                    (p) => p.status_id === s.id,
                  ).length;

                  // Se a contagem for 0 e não for um status chave de estoque, não mostra
                  if (
                    count === 0 &&
                    !["Novo no estoque", "Recapado no estoque"].includes(
                      s.nome_status,
                    )
                  )
                    return null;

                  return (
                    <span
                      key={s.id}
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        count > 0
                          ? "bg-blue-50 text-blue-700 border-blue-100"
                          : "bg-gray-50 text-gray-500 border-gray-100"
                      }`}
                    >
                      {s.nome_status}: <strong>{count}</strong>
                    </span>
                  );
                })}
            </div>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-3">
              {pneus.length === 0 ? (
                <p className="text-gray-500">Nenhum pneu em estoque.</p>
              ) : (
                pneus.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border rounded p-3"
                  >
                    <div>
                      <div className="font-medium">
                        {p.marca} {p.modelo}
                      </div>
                      <div className="text-sm text-gray-500">
                        Status: {p.status_pneus?.nome_status || "N/A"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/pneus/atribuir?pneu_id=${p.id}`}
                        className="text-sm text-blue-600"
                      >
                        Atribuir
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PneusEstoque;
