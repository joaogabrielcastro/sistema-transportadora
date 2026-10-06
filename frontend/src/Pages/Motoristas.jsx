import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout.jsx";
import {
  Alert, Button, Card, DataTable, DataTableBody, DataTableHead, DataTableRow,
  DataTableTd, DataTableTh, FormField, PageHeader, TableRowActions,
} from "../components/ui";
import EmptyState from "../components/EmptyState.jsx";
import { TableSkeleton } from "../components/Skeleton.jsx";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../utils/permissions.js";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";
import { formatDate } from "../utils/formatters.js";

const emptyForm = {
  nome: "",
  cpf: "",
  cnh: "",
  cnh_categoria: "",
  cnh_validade: "",
  telefone: "",
  whatsapp: "",
  observacao: "",
};

export default function Motoristas() {
  const { user } = useAuth();
  const canWrite = userHasPermission(user, PERMISSIONS.MOTORISTAS_WRITE);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch({ url: "/motoristas" });
      setItems(res.data || []);
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (editingId) {
        await apiFetch({
          method: "PATCH",
          url: `/motoristas/${editingId}`,
          data: form,
        });
        setSuccess("Motorista atualizado.");
      } else {
        await apiFetch({ method: "POST", url: "/motoristas", data: form });
        setSuccess("Motorista cadastrado.");
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setForm({
      nome: m.nome || "",
      cpf: m.cpf || "",
      cnh: m.cnh || "",
      cnh_categoria: m.cnh_categoria || "",
      cnh_validade: m.cnh_validade
        ? String(m.cnh_validade).slice(0, 10)
        : "",
      telefone: m.telefone || "",
      whatsapp: m.whatsapp || "",
      observacao: m.observacao || "",
    });
  };

  const remove = async (id) => {
    if (!canWrite) return;
    if (!window.confirm("Remover este motorista?")) return;
    try {
      await apiFetch({ method: "DELETE", url: `/motoristas/${id}` });
      setSuccess("Motorista removido.");
      await load();
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message);
    }
  };

  return (
    <PageLayout>
      <div className="space-y-6">
        <PageHeader
          title="Motoristas"
          subtitle="Cadastre motoristas com CNH e validade. Vincule depois ao veículo."
        />
        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {canWrite ? (
        <Card
          title={editingId ? "Editar motorista" : "Novo motorista"}
          subtitle="Dados cadastrais e habilitação do profissional."
        >
          <form
            onSubmit={onSubmit}
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          >
            <FormField
              label="Nome"
              name="nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
              maxLength={FIELD_LIMITS.NOME}
            />
            <FormField
              label="CPF"
              name="cpf"
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              mask="cpf"
              inputMode="numeric"
            />
            <FormField
              label="CNH"
              name="cnh"
              value={form.cnh}
              onChange={(e) => setForm({ ...form, cnh: e.target.value })}
              mask="cnh"
              maxLength={FIELD_LIMITS.CNH}
              inputMode="numeric"
            />
            <FormField
              label="Categoria CNH"
              name="cnh_categoria"
              value={form.cnh_categoria}
              onChange={(e) =>
                setForm({ ...form, cnh_categoria: e.target.value })
              }
              mask="cnhCategoria"
              placeholder="E"
            />
            <FormField
              label="Validade CNH"
              type="date"
              value={form.cnh_validade}
              onChange={(e) =>
                setForm({ ...form, cnh_validade: e.target.value })
              }
            />
            <FormField
              label="Telefone"
              name="telefone"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              mask="phone"
              type="tel"
              inputMode="tel"
            />
            <FormField
              label="WhatsApp"
              name="whatsapp"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              mask="phone"
              type="tel"
              inputMode="tel"
            />
            <FormField
              label="Observações"
              name="observacao"
              type="textarea"
              rows={2}
              value={form.observacao}
              onChange={(e) =>
                setForm({ ...form, observacao: e.target.value })
              }
              maxLength={FIELD_LIMITS.OBSERVACAO}
              className="md:col-span-2 xl:col-span-3"
            />
            <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-3">
              <Button type="submit" loading={saving}>
                {editingId ? "Salvar alterações" : "Cadastrar motorista"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </Card>
        ) : (
          <Alert
            type="info"
            message="Você tem acesso somente leitura aos motoristas."
          />
        )}

        {loading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Você ainda não possui motoristas cadastrados."
            description={
              canWrite
                ? "Use o formulário acima para cadastrar o primeiro motorista e controlar CNH e vínculos com a frota."
                : "Quando a equipe cadastrar motoristas, eles aparecerão aqui."
            }
            dashed
          />
        ) : (
          <Card noPadding>
            <div className="divide-y divide-border sm:hidden">
              {items.map((m) => (
                <div key={m.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text-primary">{m.nome}</p>
                      <p className="mt-1 text-sm text-text-light">CNH {m.cnh || "—"}{m.cnh_categoria ? ` (${m.cnh_categoria})` : ""}</p>
                    </div>
                    {canWrite && <TableRowActions onEdit={() => startEdit(m)} onDelete={() => remove(m.id)} />}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-light">
                    <span>Validade: {formatDate(m.cnh_validade) || "—"}</span>
                    <span>{m._count?.caminhoes ?? 0} veículo(s)</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden sm:block">
            <DataTable fixed={false}>
              <DataTableHead>
                <DataTableRow>
                  <DataTableTh>Nome</DataTableTh>
                  <DataTableTh>CNH</DataTableTh>
                  <DataTableTh>Validade</DataTableTh>
                  <DataTableTh align="center">Veículos</DataTableTh>
                  <DataTableTh align="right">Ações</DataTableTh>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {items.map((m) => (
                  <DataTableRow key={m.id}>
                    <DataTableTd className="font-semibold">{m.nome}</DataTableTd>
                    <DataTableTd>
                      {m.cnh || "—"}
                      {m.cnh_categoria ? ` (${m.cnh_categoria})` : ""}
                    </DataTableTd>
                    <DataTableTd className="whitespace-nowrap">{formatDate(m.cnh_validade) || "—"}</DataTableTd>
                    <DataTableTd align="center" className="tabular-nums">{m._count?.caminhoes ?? 0}</DataTableTd>
                    <DataTableTd align="right">
                      {canWrite && (
                        <TableRowActions onEdit={() => startEdit(m)} onDelete={() => remove(m.id)} />
                      )}
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            </div>
          </Card>
        )}

        <p className="text-sm text-slate-500">
          No cadastro ou edição do caminhão, vincule o motorista pelo ID
          (lista de motoristas). O nome é sincronizado automaticamente.{" "}
          <Link to="/" className="text-secondary underline">
            Ver frota
          </Link>
        </p>
      </div>
    </PageLayout>
  );
}
