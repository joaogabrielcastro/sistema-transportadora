import React, { useCallback, useEffect, useState } from "react";
import PageLayout from "../components/layout/PageLayout.jsx";
import { Alert, Card, PageHeader } from "../components/ui";
import EmptyState from "../components/EmptyState.jsx";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { formatDateTime } from "../utils/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../utils/permissions.js";
import { Navigate } from "react-router-dom";

const PAGE_SIZE = 50;

const ACTION_LABEL = {
  POST: "Criar",
  PUT: "Atualizar",
  PATCH: "Atualizar",
  DELETE: "Excluir",
};

export default function Auditoria() {
  const { user } = useAuth();
  const canRead = userHasPermission(user, PERMISSIONS.AUDIT_READ);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [email, setEmail] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextOffset = 0) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });
      if (email.trim()) params.set("userEmail", email.trim());
      if (action.trim()) params.set("action", action.trim());
      if (q.trim()) params.set("q", q.trim());
      const res = await apiFetch({ url: `/ops/audit-logs?${params}` });
      const data = res.data?.data ?? res.data;
      setItems(data?.items || []);
      setTotal(data?.total || 0);
      setOffset(nextOffset);
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  }, [email, action, q]);

  useEffect(() => {
    if (canRead) void load(0);
  }, [canRead, load]);

  if (!canRead) {
    return <Navigate to="/" replace />;
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageLayout>
      <div className="space-y-6">
        <PageHeader
          title="Auditoria"
          subtitle="Histórico de alterações feitas na conta."
        />
        {error && <Alert type="error">{error}</Alert>}

        <Card>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void load(0);
            }}
          >
            <label className="block text-sm">
              <span className="font-medium text-slate-700">E-mail</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                placeholder="usuario@…"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Ação</span>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">Todas</option>
                <option value="POST">Criar</option>
                <option value="PUT">Atualizar</option>
                <option value="PATCH">Atualizar (parcial)</option>
                <option value="DELETE">Excluir</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2 lg:col-span-1">
              <span className="font-medium text-slate-700">Onde</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                placeholder="placa, usuário, registro…"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-secondary text-white text-sm font-semibold px-4 py-2.5 hover:bg-secondary-dark"
            >
              Filtrar
            </button>
          </form>
        </Card>

        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum registro"
            description="Ações de criação, edição e exclusão aparecem aqui."
            dashed
          />
        ) : (
          <>
            <div className="overflow-x-auto border border-border rounded-xl bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Quando</th>
                    <th className="px-3 py-2.5 font-semibold">Usuário</th>
                    <th className="px-3 py-2.5 font-semibold">Ação</th>
                    <th className="px-3 py-2.5 font-semibold">Registro</th>
                    <th className="px-3 py-2.5 font-semibold">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                        {formatDateTime(row.criado_em) || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-slate-900">
                          {row.user_email || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {ACTION_LABEL[row.action] ||
                            ACTION_LABEL[row.method] ||
                            row.action ||
                            row.method}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {row.entity || "—"}
                        {row.entity_id ? (
                          <span className="text-slate-400"> #{row.entity_id}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 max-w-xs truncate font-mono text-xs">
                        {row.path}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>
                {total} registro{total === 1 ? "" : "s"} · Página {page} de{" "}
                {pages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={offset <= 0 || loading}
                  onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
                  className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={offset + PAGE_SIZE >= total || loading}
                  onClick={() => void load(offset + PAGE_SIZE)}
                  className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
