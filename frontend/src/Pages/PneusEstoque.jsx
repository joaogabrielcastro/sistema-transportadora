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
  const { get, post, delete: del, loading, error } = useApi();
  const [pneus, setPneus] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [pneusBulk, setPneusBulk] = useState([
    {
      id: Date.now(),
      marca: "",
      modelo: "",
      status_id: "",
      vida_util_km: "",
      observacao: "",
      quantidade: 1,
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
    quantidade: z.preprocess(
      (v) => Number(v),
      z.number().int().positive("Quantidade deve ser no mínimo 1").default(1),
    ),
  });

  const fetchEstoque = async () => {
    try {
      const res = await get("/pneus/in-stock");
      setPneus(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePneu = async (pneuId) => {
    const pneu = pneus.find(p => p.id === pneuId);
    const pneuInfo = pneu ? `${pneu.marca} ${pneu.modelo}` : `ID ${pneuId}`;
    
    if (!window.confirm(`Tem certeza que deseja excluir este pneu do estoque?\n\nPneu: ${pneuInfo}\nStatus: ${pneu?.status_pneus?.nome_status || 'N/A'}`)) {
      return;
    }

    setDeletingId(pneuId);
    try {
      console.log("Tentando deletar pneu:", { id: pneuId, pneu });
      await del(`/pneus/${pneuId}`);
      setSuccess(`Pneu ${pneuInfo} excluído com sucesso`);
      setTimeout(() => setSuccess(""), 3000);
      fetchEstoque();
    } catch (err) {
      console.error("Erro completo ao excluir pneu:", err);
      console.error("Resposta do servidor:", err.response?.data);
      console.error("Status HTTP:", err.response?.status);
      
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || "Erro desconhecido ao excluir pneu";
      alert(`Erro ao excluir pneu ${pneuInfo}:\n\n${errorMessage}\n\nVerifique o console do navegador para mais detalhes.`);
    } finally {
      setDeletingId(null);
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
      quantidade: line.quantidade || 1,
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
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Dica:</strong> Use o campo "Quantidade" para adicionar vários pneus idênticos de uma vez. 
              Por exemplo: 70 pneus lisos, 16 borrachudos, etc.
            </p>
          </div>
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
                  quantidade: line.quantidade || 1,
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
                  // Criar múltiplos pneus baseado na quantidade
                  const quantidade = parsed.data.quantidade || 1;
                  const pneuData = {
                    marca: parsed.data.marca,
                    modelo: parsed.data.modelo,
                    status_id: parsed.data.status_id,
                    vida_util_km: parsed.data.vida_util_km,
                    observacao: parsed.data.observacao,
                  };
                  
                  // Adiciona o mesmo pneu N vezes baseado na quantidade
                  for (let i = 0; i < quantidade; i++) {
                    toCreate.push(pneuData);
                  }
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
                setSuccess(`${toCreate.length} pneus adicionados ao estoque com sucesso`);
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
                    quantidade: 1,
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
                <div key={line.id} className="border p-4 rounded bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <strong>Tipo de Pneu {idx + 1}</strong>
                      {line.quantidade > 1 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                          {line.quantidade}x
                        </span>
                      )}
                    </div>
                    {pneusBulk.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPneusBulk((prev) =>
                            prev.filter((p) => p.id !== line.id),
                          )
                        }
                        className="text-red-600 hover:text-red-800 text-sm"
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
                      label="Quantidade"
                      name="quantidade"
                      type="number"
                      min="1"
                      value={line.quantidade || 1}
                      onChange={(e) =>
                        handleBulkFieldChange(
                          line.id,
                          "quantidade",
                          e.target.value,
                        )
                      }
                      required
                      error={bulkErrors[line.id]?.quantidade}
                      helperText="Quantos pneus iguais adicionar"
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
                      quantidade: 1,
                    },
                  ])
                }
              >
                Adicionar outro tipo de pneu
              </Button>
              <Button type="submit">
                Cadastrar {pneusBulk.reduce((total, p) => total + (parseInt(p.quantidade) || 1), 0)} Pneu(s) no Estoque
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
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Atribuir
                      </Link>
                      <button
                        onClick={() => handleDeletePneu(p.id)}
                        disabled={deletingId === p.id}
                        className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === p.id ? "Excluindo..." : "Excluir"}
                      </button>
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
