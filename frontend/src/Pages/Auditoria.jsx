import React, { useCallback, useEffect, useState } from "react";
import PageLayout from "../components/layout/PageLayout.jsx";
import {
  Alert, Button, Card, DataTable, DataTableBody, DataTableHead, DataTableRow,
  DataTableTd, DataTableTh, FormField, PageHeader, StatusBadge,
} from "../components/ui";
import EmptyState from "../components/EmptyState.jsx";
import Pagination from "../components/Pagination.jsx";
import { TableSkeleton } from "../components/Skeleton.jsx";
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
            <FormField
                label="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@…"
                className="mb-0"
            />
            <FormField
                label="Ação"
                type="select"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                options={[
                  { value: "", label: "Todas" },
                  { value: "POST", label: "Criar" },
                  { value: "PUT", label: "Atualizar" },
                  { value: "PATCH", label: "Atualizar (parcial)" },
                  { value: "DELETE", label: "Excluir" },
                ]}
                className="mb-0"
            />
            <FormField
                label="Onde"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="placa, usuário, registro…"
                className="mb-0 sm:col-span-2 lg:col-span-1"
            />
            <Button type="submit" loading={loading}>
              Filtrar
            </Button>
          </form>
        </Card>

        {loading ? (
          <TableSkeleton rows={7} columns={5} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum registro"
            description="Ações de criação, edição e exclusão aparecem aqui."
            dashed
          />
        ) : (
          <>
            <Card noPadding>
              <DataTable fixed={false}>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableTh>Quando</DataTableTh>
                    <DataTableTh>Usuário</DataTableTh>
                    <DataTableTh>Ação</DataTableTh>
                    <DataTableTh>Registro</DataTableTh>
                    <DataTableTh>Detalhe</DataTableTh>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {items.map((row) => (
                    <DataTableRow key={row.id}>
                      <DataTableTd className="whitespace-nowrap text-text-secondary">
                        {formatDateTime(row.criado_em) || "—"}
                      </DataTableTd>
                      <DataTableTd>
                        <span className="font-medium text-text-primary">
                          {row.user_email || "—"}
                        </span>
                      </DataTableTd>
                      <DataTableTd>
                        <StatusBadge status={ACTION_LABEL[row.action] ||
                            ACTION_LABEL[row.method] ||
                            row.action ||
                            row.method} />
                      </DataTableTd>
                      <DataTableTd className="text-text-secondary">
                        {row.entity || "—"}
                        {row.entity_id ? (
                          <span className="text-slate-400"> #{row.entity_id}</span>
                        ) : null}
                      </DataTableTd>
                      <DataTableTd className="max-w-xs truncate font-mono text-xs text-text-secondary" title={row.path}>
                        {row.path}
                      </DataTableTd>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </Card>
            <p className="text-sm text-text-secondary">{total} registro{total === 1 ? "" : "s"}</p>
            <Pagination currentPage={page} totalPages={pages} onPageChange={(nextPage) => void load((nextPage - 1) * PAGE_SIZE)} />
          </>
        )}
      </div>
    </PageLayout>
  );
}
