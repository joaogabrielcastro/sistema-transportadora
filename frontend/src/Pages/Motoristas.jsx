import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout.jsx";
import {
  Alert, Button, Card, DataTable, DataTableBody, DataTableHead, DataTableRow,
  DataTableTd, DataTableTh, FormField, Modal, PageHeader, StatCard, TableRowActions,
} from "../components/ui";
import Icon from "../components/ui/Icon.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { TableSkeleton } from "../components/Skeleton.jsx";
import { useToast } from "../components/ui/useToast.js";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { invalidateQueriesFromMutation } from "../lib/invalidateQueries.js";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../utils/permissions.js";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";
import { formatDate } from "../utils/formatters.js";
import { cnhStatus } from "../utils/cnhStatus.js";

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

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "vencida", label: "CNH vencida" },
  { id: "a_vencer", label: "Vence em 30 dias" },
  { id: "sem_veiculo", label: "Sem veículo" },
];

const CNH_TONE = {
  vencida: "bg-red-50 text-red-700 border-red-200",
  a_vencer: "bg-amber-50 text-amber-800 border-amber-200",
  valida: "bg-emerald-50 text-emerald-700 border-emerald-200",
  sem_validade: "bg-slate-50 text-slate-600 border-slate-200",
};

function CnhBadge({ validade }) {
  const st = cnhStatus(validade);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${CNH_TONE[st.key]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {st.label}
    </span>
  );
}

const normalize = (v) =>
  String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const onlyDigits = (v) => String(v || "").replace(/\D/g, "");

function whatsappHref(phone) {
  const digits = onlyDigits(phone);
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

export default function Motoristas() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = userHasPermission(user, PERMISSIONS.MOTORISTAS_WRITE);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");

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

  // Atalho "Cadastrar motorista" (?novo=1) do topo / busca rápida.
  useEffect(() => {
    if (!searchParams.get("novo")) return;
    if (canWrite) openCreate();
    const next = new URLSearchParams(searchParams);
    next.delete("novo");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canWrite]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await apiFetch({
          method: "PATCH",
          url: `/motoristas/${editingId}`,
          data: form,
        });
        toast.success("Motorista atualizado.");
      } else {
        await apiFetch({ method: "POST", url: "/motoristas", data: form });
        toast.success("Motorista cadastrado.");
      }
      invalidateQueriesFromMutation("motoristas", editingId ? "patch" : "post");
      setFormOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      const parsed = await parseApiError(err);
      setFormError(parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setFormError("");
    setForm({
      nome: m.nome || "",
      cpf: m.cpf || "",
      cnh: m.cnh || "",
      cnh_categoria: m.cnh_categoria || "",
      cnh_validade: m.cnh_validade ? String(m.cnh_validade).slice(0, 10) : "",
      telefone: m.telefone || "",
      whatsapp: m.whatsapp || "",
      observacao: m.observacao || "",
    });
    setFormOpen(true);
  };

  const confirmRemove = async () => {
    if (!canWrite || !deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch({ method: "DELETE", url: `/motoristas/${deleteTarget.id}` });
      invalidateQueriesFromMutation("motoristas", "delete");
      toast.success("Motorista removido.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      const parsed = await parseApiError(err);
      toast.error(parsed.message || "Não foi possível remover o motorista.");
    } finally {
      setDeleting(false);
    }
  };

  const resumo = useMemo(() => {
    const acc = { vencida: 0, a_vencer: 0, sem_veiculo: 0 };
    for (const m of items) {
      const st = cnhStatus(m.cnh_validade).key;
      if (st === "vencida") acc.vencida += 1;
      if (st === "a_vencer") acc.a_vencer += 1;
      if (!(m._count?.caminhoes > 0)) acc.sem_veiculo += 1;
    }
    return acc;
  }, [items]);

  const filtered = useMemo(() => {
    const q = normalize(busca.trim());
    const qDigits = onlyDigits(busca);
    return items
      .filter((m) => {
        if (filtro === "vencida" || filtro === "a_vencer") {
          if (cnhStatus(m.cnh_validade).key !== filtro) return false;
        }
        if (filtro === "sem_veiculo" && m._count?.caminhoes > 0) return false;
        if (!q) return true;
        if (normalize(m.nome).includes(q)) return true;
        return qDigits.length >= 3 && [m.cpf, m.cnh, m.telefone, m.whatsapp].some((v) => onlyDigits(v).includes(qDigits));
      })
      .sort((a, b) => {
        // Pendências de CNH primeiro, depois ordem alfabética.
        const rank = { vencida: 0, a_vencer: 1, sem_validade: 2, valida: 3 };
        const ra = rank[cnhStatus(a.cnh_validade).key];
        const rb = rank[cnhStatus(b.cnh_validade).key];
        if (ra !== rb) return ra - rb;
        return String(a.nome).localeCompare(String(b.nome), "pt-BR");
      });
  }, [items, busca, filtro]);

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <PageLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Frota"
          title="Motoristas"
          meta={
            !loading && items.length ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-text-secondary">
                {items.length}
              </span>
            ) : null
          }
          subtitle="Cadastro, contato e validade da CNH. O vínculo com o veículo é feito no cadastro do caminhão."
          actions={
            canWrite ? (
              <Button onClick={openCreate} icon={<Icon name="plus" className="h-4 w-4" strokeWidth={2.25} />}>
                Novo motorista
              </Button>
            ) : null
          }
        />
        {error && (
          <Alert type="error" title="Não foi possível carregar os motoristas" message={error}>
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={load}>
                Tentar novamente
              </Button>
            </div>
          </Alert>
        )}
        {!canWrite && (
          <Alert type="info" message="Você tem acesso somente leitura aos motoristas." />
        )}

        {!loading && items.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              layout="compact"
              title="CNH vencida"
              value={resumo.vencida}
              color={resumo.vencida > 0 ? "red" : "slate"}
              hint={resumo.vencida > 0 ? "Regularize antes de liberar viagens" : "Nenhuma"}
              icon={<Icon name="alert" />}
            />
            <StatCard
              layout="compact"
              title="Vence em 30 dias"
              value={resumo.a_vencer}
              color={resumo.a_vencer > 0 ? "amber" : "slate"}
              hint="Programe a renovação"
              icon={<Icon name="calendar" />}
            />
            <StatCard
              layout="compact"
              title="Sem veículo vinculado"
              value={resumo.sem_veiculo}
              color="slate"
              hint="Disponíveis para escala"
              icon={<Icon name="truck" />}
            />
          </div>
        ) : null}

        {loading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Icon name="user" className="h-5 w-5" />}
            title="Você ainda não possui motoristas cadastrados."
            description={
              canWrite
                ? "Cadastre o primeiro motorista para controlar CNH e vínculos com a frota."
                : "Quando a equipe cadastrar motoristas, eles aparecerão aqui."
            }
            action={canWrite ? <Button onClick={openCreate}>Cadastrar motorista</Button> : null}
            dashed
          />
        ) : (
          <Card noPadding className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="relative w-full sm:max-w-xs">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                <label htmlFor="motoristas-busca" className="sr-only">Buscar motorista</label>
                <input
                  id="motoristas-busca"
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, CPF, CNH ou telefone…"
                  className="control w-full pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar motoristas">
                {FILTERS.map((f) => {
                  const n = f.id === "todos" ? null : resumo[f.id];
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={filtro === f.id}
                      onClick={() => setFiltro(f.id)}
                      className={`chip ${filtro === f.id ? "chip-active" : ""}`}
                    >
                      {f.label}
                      {n ? <span className="tabular-nums opacity-70">{n}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  compact
                  title="Nenhum motorista encontrado"
                  description="Ajuste a busca ou o filtro."
                  action={
                    <Button variant="outline" onClick={() => { setBusca(""); setFiltro("todos"); }}>
                      Limpar filtros
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border md:hidden">
                  {filtered.map((m) => {
                    const wa = whatsappHref(m.whatsapp);
                    return (
                      <li key={m.id} className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-text-primary">{m.nome}</p>
                            <p className="mt-0.5 text-xs text-text-secondary">
                              CNH {m.cnh || "—"}{m.cnh_categoria ? ` · cat. ${m.cnh_categoria}` : ""}
                            </p>
                          </div>
                          {canWrite && (
                            <TableRowActions
                              onEdit={() => startEdit(m)}
                              onDelete={() => setDeleteTarget(m)}
                              editTitle={`Editar ${m.nome}`}
                              deleteTitle={`Remover ${m.nome}`}
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-secondary">
                          <CnhBadge validade={m.cnh_validade} />
                          <span>Validade {formatDate(m.cnh_validade) || "—"}</span>
                          <span>{m._count?.caminhoes ?? 0} veículo(s)</span>
                          {m.telefone ? <a className="text-secondary-dark" href={`tel:${onlyDigits(m.telefone)}`}>{m.telefone}</a> : null}
                          {wa ? <a className="text-emerald-700" href={wa} target="_blank" rel="noreferrer">WhatsApp</a> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="hidden md:block">
                  <DataTable fixed={false}>
                    <DataTableHead>
                      <tr>
                        <DataTableTh>Motorista</DataTableTh>
                        <DataTableTh>Contato</DataTableTh>
                        <DataTableTh>CNH</DataTableTh>
                        <DataTableTh>Validade</DataTableTh>
                        <DataTableTh align="center">Veículos</DataTableTh>
                        <DataTableTh align="right"><span className="sr-only">Ações</span></DataTableTh>
                      </tr>
                    </DataTableHead>
                    <DataTableBody>
                      {filtered.map((m) => {
                        const wa = whatsappHref(m.whatsapp);
                        return (
                          <DataTableRow key={m.id}>
                            <DataTableTd>
                              <p className="font-semibold text-text-primary">{m.nome}</p>
                              <p className="text-xs text-text-secondary">
                                {m.cpf ? `CPF ${m.cpf}` : "CPF não informado"}
                                {m.ativo === false ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-px text-[11px] font-medium text-slate-600">Inativo</span> : null}
                              </p>
                            </DataTableTd>
                            <DataTableTd>
                              <div className="flex flex-col gap-0.5 text-sm">
                                {m.telefone ? (
                                  <a href={`tel:${onlyDigits(m.telefone)}`} className="text-text-primary hover:text-secondary-dark">{m.telefone}</a>
                                ) : null}
                                {wa ? (
                                  <a href={wa} target="_blank" rel="noreferrer" className="text-xs font-medium text-emerald-700 hover:underline">
                                    WhatsApp {m.whatsapp}
                                  </a>
                                ) : null}
                                {!m.telefone && !wa ? <span className="text-text-light">—</span> : null}
                              </div>
                            </DataTableTd>
                            <DataTableTd className="whitespace-nowrap tabular-nums">
                              {m.cnh || "—"}
                              {m.cnh_categoria ? (
                                <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-px text-xs font-semibold text-text-secondary">{m.cnh_categoria}</span>
                              ) : null}
                            </DataTableTd>
                            <DataTableTd className="whitespace-nowrap">
                              <div className="flex flex-col items-start gap-1">
                                <CnhBadge validade={m.cnh_validade} />
                                <span className="text-xs tabular-nums text-text-secondary">{formatDate(m.cnh_validade) || "—"}</span>
                              </div>
                            </DataTableTd>
                            <DataTableTd align="center" className="tabular-nums">{m._count?.caminhoes ?? 0}</DataTableTd>
                            <DataTableTd align="right">
                              {canWrite && (
                                <TableRowActions
                                  onEdit={() => startEdit(m)}
                                  onDelete={() => setDeleteTarget(m)}
                                  editTitle={`Editar ${m.nome}`}
                                  deleteTitle={`Remover ${m.nome}`}
                                />
                              )}
                            </DataTableTd>
                          </DataTableRow>
                        );
                      })}
                    </DataTableBody>
                  </DataTable>
                </div>
              </>
            )}
          </Card>
        )}

        <p className="text-sm text-text-secondary">
          Para vincular um motorista a um veículo, abra o veículo e escolha o motorista no cadastro.
          O nome é sincronizado automaticamente.{" "}
          <Link to="/frota" className="font-medium text-secondary-dark underline-offset-2 hover:underline">
            Ver veículos
          </Link>
        </p>
      </div>

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editingId ? "Editar motorista" : "Novo motorista"}
        size="lg"
        closeOnOverlayClick={!saving}
      >
        <form onSubmit={onSubmit} className="space-y-1">
          {formError ? <Alert type="error" message={formError} className="mb-4" /> : null}
          <p className="section-label pb-2">Dados pessoais</p>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <FormField label="Nome" name="nome" value={form.nome} onChange={setField("nome")} required maxLength={FIELD_LIMITS.NOME} className="sm:col-span-2" autoFocus />
            <FormField label="CPF" name="cpf" value={form.cpf} onChange={setField("cpf")} mask="cpf" inputMode="numeric" />
            <FormField label="Telefone" name="telefone" value={form.telefone} onChange={setField("telefone")} mask="phone" type="tel" inputMode="tel" />
            <FormField label="WhatsApp" name="whatsapp" value={form.whatsapp} onChange={setField("whatsapp")} mask="phone" type="tel" inputMode="tel" helperText="Usado para avisos e contato rápido." />
          </div>
          <p className="section-label pb-2 pt-2">Habilitação</p>
          <div className="grid gap-x-3 sm:grid-cols-3">
            <FormField label="CNH" name="cnh" value={form.cnh} onChange={setField("cnh")} mask="cnh" maxLength={FIELD_LIMITS.CNH} inputMode="numeric" />
            <FormField label="Categoria" name="cnh_categoria" value={form.cnh_categoria} onChange={setField("cnh_categoria")} mask="cnhCategoria" placeholder="E" />
            <FormField
              label="Validade"
              type="date"
              name="cnh_validade"
              value={form.cnh_validade}
              onChange={setField("cnh_validade")}
              helperText={form.cnh_validade ? cnhStatus(form.cnh_validade).label : "Gera alerta 30 dias antes."}
            />
          </div>
          <FormField
            label="Observações"
            name="observacao"
            type="textarea"
            rows={2}
            value={form.observacao}
            onChange={setField("observacao")}
            maxLength={FIELD_LIMITS.OBSERVACAO}
          />
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editingId ? "Salvar alterações" : "Cadastrar motorista"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmRemove}
        title="Remover motorista"
        message={
          deleteTarget
            ? deleteTarget._count?.caminhoes > 0
              ? `Remover ${deleteTarget.nome}? Ele está vinculado a ${deleteTarget._count.caminhoes} veículo(s); o vínculo será desfeito. Esta ação não pode ser desfeita.`
              : `Remover ${deleteTarget.nome}? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmText={deleting ? "Removendo..." : "Remover"}
        cancelText="Cancelar"
        warning
        loading={deleting}
      />
    </PageLayout>
  );
}
