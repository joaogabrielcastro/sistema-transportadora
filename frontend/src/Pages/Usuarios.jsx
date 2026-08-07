import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PageLayout from "../components/layout/PageLayout.jsx";
import { Alert, Button, FormField, PageHeader } from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { extractApiArray } from "../utils/extractApiArray.js";

const ROLE_LABEL = {
  admin: "Administrador",
  operator: "Operador",
  viewer: "Somente leitura",
};

export default function Usuarios() {
  const { user, isAuthenticated } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    password: "",
    role: "operator",
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch({ method: "GET", url: "/users" });
      setUsers(extractApiArray(res));
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Falha ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      loadUsers();
    }
  }, [user?.role, loadUsers]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch({
        method: "POST",
        url: "/users",
        data: form,
      });
      setForm({ nome: "", email: "", password: "", role: "operator" });
      setSuccess("Usuário criado com sucesso");
      await loadUsers();
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Falha ao criar usuário");
    } finally {
      setSaving(false);
    }
  };

  const patchUser = async (id, data) => {
    setError("");
    setSuccess("");
    try {
      await apiFetch({
        method: "PATCH",
        url: `/users/${id}`,
        data,
      });
      setSuccess("Usuário atualizado");
      await loadUsers();
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Falha ao atualizar usuário");
    }
  };

  return (
    <PageLayout wide={false}>
      <PageHeader
        title="Usuários"
        subtitle="Gerencie quem acessa a empresa e o perfil de cada um."
      />

      <div className="mt-6">
      {error && <Alert type="error" message={error} className="mb-4" />}
      {success && <Alert type="success" message={success} className="mb-4" />}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="bg-white border border-border rounded-2xl shadow-card p-5 sm:p-6 h-fit">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Novo usuário
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <FormField
              label="Nome"
              name="nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              required
            />
            <FormField
              label="E-mail"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              required
            />
            <FormField
              label="Senha temporária"
              name="password"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder="Mínimo 8 caracteres"
              required
            />
            <FormField
              label="Perfil"
              name="role"
              type="select"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              options={[
                { value: "operator", label: "Operador" },
                { value: "viewer", label: "Somente leitura" },
                { value: "admin", label: "Administrador" },
              ]}
            />
            <Button type="submit" loading={saving} className="w-full">
              Adicionar usuário
            </Button>
          </form>
          <p className="mt-4 text-xs text-text-secondary leading-relaxed">
            <strong>Administrador:</strong> gerencia usuários e configurações
            sensíveis.
            <br />
            <strong>Operador:</strong> usa o dia a dia (frota, gastos, pneus,
            ordens).
          </p>
        </section>

        <section className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">
              Equipe da empresa
            </h2>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-text-secondary">Carregando…</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-sm text-text-secondary">
              Nenhum usuário encontrado.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {users.map((u) => {
                const isSelf = Number(u.id) === Number(user.id);
                return (
                  <li
                    key={u.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">
                        {u.nome}
                        {isSelf ? (
                          <span className="ml-2 text-xs text-text-secondary">
                            (você)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-text-secondary truncate">
                        {u.email}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span
                          className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${
                            u.role === "admin"
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          {ROLE_LABEL[u.role] || u.role}
                        </span>
                        <span
                          className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${
                            u.ativo
                              ? "bg-green-50 text-green-800 border-green-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {u.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <select
                        className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) =>
                          patchUser(u.id, { role: e.target.value })
                        }
                        aria-label={`Perfil de ${u.nome}`}
                      >
                        <option value="operator">Operador</option>
                        <option value="viewer">Somente leitura</option>
                        <option value="admin">Administrador</option>
                      </select>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isSelf}
                        onClick={() =>
                          patchUser(u.id, { ativo: !u.ativo })
                        }
                      >
                        {u.ativo ? "Desativar" : "Reativar"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      </div>
    </PageLayout>
  );
}
