import React, { useMemo, useState } from "react";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import {
  Alert,
  Button,
  Card,
  FormField,
  LoadingSpinner,
  PageHeader,
  StatusBadge,
} from "../components/ui";
import EmptyState from "../components/EmptyState.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { extractApiData } from "../utils/extractApiArray.js";
import { useApiMutation, useFiscalEmpresasQuery } from "../hooks";
import { CpfCnpjField } from "../components/fiscal/FiscalFields.jsx";

const CRT_OPTIONS = [
  { value: "1", label: "1 — Simples Nacional" },
  { value: "2", label: "2 — Simples Nacional (excesso de sublimite)" },
  { value: "3", label: "3 — Regime Normal" },
  { value: "4", label: "4 — MEI" },
];

const emptyForm = {
  cnpj: "",
  razao_social: "",
  rntrc: "",
  crt: "",
  inscricao_estadual: "",
  cte_mdfe_provider_token: "",
  brasil_nfe_user_token: "",
  ativo: true,
};

function toForm(empresa) {
  if (!empresa) return emptyForm;
  return {
    cnpj: empresa.cnpj || "",
    razao_social: empresa.razao_social || "",
    rntrc: empresa.rntrc || "",
    crt: empresa.crt != null ? String(empresa.crt) : "",
    inscricao_estadual: empresa.inscricao_estadual || "",
    cte_mdfe_provider_token: "",
    brasil_nfe_user_token: "",
    ativo: empresa.ativo !== false,
  };
}

export default function FiscalEmpresas() {
  const { post } = useApiMutation();
  const empresasQuery = useFiscalEmpresasQuery();
  const empresas = useMemo(
    () => empresasQuery.data || [],
    [empresasQuery.data],
  );

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  const [certEmpresaId, setCertEmpresaId] = useState("");
  const [certFile, setCertFile] = useState(null);
  const [certSenha, setCertSenha] = useState("");
  const [certLoading, setCertLoading] = useState(false);
  const [certCheck, setCertCheck] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErro("");
    setMsg("");
  };

  const startEdit = (empresa) => {
    setEditingId(empresa.id);
    setForm(toForm(empresa));
    setErro("");
    setMsg("");
  };

  const payloadCadastro = () => {
    const body = {
      cnpj: form.cnpj.replace(/\D/g, ""),
      razao_social: form.razao_social.trim(),
      rntrc: form.rntrc.replace(/\D/g, "") || null,
      crt: form.crt ? Number(form.crt) : null,
      inscricao_estadual: form.inscricao_estadual.trim() || null,
      ativo: form.ativo,
    };
    if (form.cte_mdfe_provider_token.trim()) {
      body.cte_mdfe_provider_token = form.cte_mdfe_provider_token.trim();
    }
    if (form.brasil_nfe_user_token.trim()) {
      body.brasil_nfe_user_token = form.brasil_nfe_user_token.trim();
    }
    return body;
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    setErro("");
    setMsg("");
    try {
      await apiFetch({
        method: "DELETE",
        url: `/fiscal/empresas/${deleteTarget.id}`,
      });
      setMsg("Empresa fiscal excluída.");
      if (editingId === deleteTarget.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      if (String(certEmpresaId) === String(deleteTarget.id)) {
        setCertEmpresaId("");
        setCertFile(null);
        setCertSenha("");
        setCertCheck(null);
      }
      setDeleteTarget(null);
      empresasQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setErro(parsed.message || "Não foi possível excluir a empresa fiscal.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErro("");
    setMsg("");
    try {
      const body = payloadCadastro();
      if (editingId) {
        await apiFetch({
          method: "PUT",
          url: `/fiscal/empresas/${editingId}`,
          data: body,
        });
        setMsg("Empresa fiscal atualizada.");
      } else {
        await apiFetch({ method: "POST", url: "/fiscal/empresas", data: body });
        setMsg("Empresa fiscal cadastrada.");
        setForm(emptyForm);
      }
      empresasQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setErro(parsed.message || "Não foi possível salvar a empresa fiscal.");
    } finally {
      setSaving(false);
    }
  };

  const handleEnviarCertificado = async (e) => {
    e.preventDefault();
    if (!certEmpresaId) {
      setErro("Selecione a empresa fiscal.");
      return;
    }
    if (!certFile) {
      setErro(
        "Escolha o arquivo .pfx ou .p12 do certificado A1. Sem o arquivo o envio não sai.",
      );
      return;
    }
    if (!certSenha) {
      setErro("Informe a senha do certificado.");
      return;
    }
    setCertLoading(true);
    setErro("");
    setMsg("");
    setCertCheck(null);
    try {
      const data = new FormData();
      data.append("certificado", certFile);
      data.append("senha", certSenha);
      await apiFetch({
        method: "POST",
        url: `/fiscal/empresas/${certEmpresaId}/certificado`,
        data,
      });
      setMsg("Certificado A1 enviado à Brasil NFe. A senha não é exibida.");
      setCertSenha("");
      setCertFile(null);
      empresasQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setErro(parsed.message || "Falha ao enviar o certificado.");
    } finally {
      setCertLoading(false);
    }
  };

  const handleVerificarCertificado = async () => {
    if (!certEmpresaId) return;
    setCertLoading(true);
    setErro("");
    try {
      const res = await post(
        `/fiscal/empresas/${certEmpresaId}/certificado/verificar`,
      );
      setCertCheck(extractApiData(res) || res);
    } catch {
      /* toast automático */
    } finally {
      setCertLoading(false);
    }
  };

  return (
    <PageLayout className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: "Empresa fiscal" },
        ]}
      />
      <PageHeader
        title="Empresa fiscal — Brasil NFe"
        subtitle="CNPJ emissor, Token da empresa, UserToken e certificado A1. Segredos nunca voltam na API."
      />

      {msg && (
        <Alert type="success" message={msg} dismissible onClose={() => setMsg("")} />
      )}
      {erro && (
        <Alert type="error" message={erro} dismissible onClose={() => setErro("")} />
      )}
      {empresasQuery.isError && (
        <Alert type="error" message="Falha ao carregar as empresas fiscais." />
      )}

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-text-primary">
          Empresas cadastradas
        </h2>
        {empresasQuery.isLoading ? (
          <LoadingSpinner />
        ) : empresas.length === 0 ? (
          <EmptyState
            title="Nenhuma empresa fiscal"
            description="Cadastre o CNPJ emissor, o Token da Brasil NFe e o certificado A1 antes de emitir CT-e, MDF-e ou declarar CIOT."
            dashed
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-text-secondary">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Razão social</th>
                  <th className="px-3 py-2.5 font-medium">CNPJ</th>
                  <th className="px-3 py-2.5 font-medium">CRT</th>
                  <th className="px-3 py-2.5 font-medium">Token</th>
                  <th className="px-3 py-2.5 font-medium">UserToken</th>
                  <th className="px-3 py-2.5 font-medium">Certificado</th>
                  <th className="px-3 py-2.5 font-medium">Ativo</th>
                  <th className="px-3 py-2.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2.5 font-medium">
                      {row.razao_social}
                    </td>
                    <td className="px-3 py-2.5">{row.cnpj}</td>
                    <td className="px-3 py-2.5">{row.crt ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {row.cte_mdfe_provider_token_set ? "cadastrado" : "ausente"}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.brasil_nfe_user_token_set ? "cadastrado" : "env"}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.certificado_senha_set ? "vinculado" : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge
                        status={row.ativo !== false ? "ativo" : "inativo"}
                        type="vehicle"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(row)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(row)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text-primary">
            {editingId ? "Editar empresa fiscal" : "Nova empresa fiscal"}
          </h2>
          {editingId && (
            <Button type="button" variant="outline" size="sm" onClick={startCreate}>
              Nova
            </Button>
          )}
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Razão social"
              required
              value={form.razao_social}
              onChange={(e) => set("razao_social", e.target.value)}
              className="mb-0"
            />
            <CpfCnpjField
              label="CNPJ"
              required
              value={form.cnpj}
              onChange={(e) => set("cnpj", e.target.value)}
              className="mb-0"
            />
            <FormField
              label="RNTRC"
              value={form.rntrc}
              onChange={(e) => set("rntrc", e.target.value.replace(/\D/g, ""))}
              maxLength={9}
              className="mb-0"
            />
            <FormField
              label="CRT"
              type="select"
              value={form.crt}
              onChange={(e) => set("crt", e.target.value)}
              options={CRT_OPTIONS}
              allowEmpty
              emptyLabel="Selecione o CRT"
              className="mb-0"
            />
            <FormField
              label="Inscrição estadual"
              value={form.inscricao_estadual}
              onChange={(e) => set("inscricao_estadual", e.target.value)}
              className="mb-0"
            />
            <FormField
              label="Ativo"
              type="select"
              value={form.ativo ? "1" : "0"}
              onChange={(e) => set("ativo", e.target.value === "1")}
              options={[
                { value: "1", label: "Sim" },
                { value: "0", label: "Não" },
              ]}
              className="mb-0"
            />
            <FormField
              label="Token da empresa (Brasil NFe)"
              type="password"
              value={form.cte_mdfe_provider_token}
              onChange={(e) => set("cte_mdfe_provider_token", e.target.value)}
              placeholder={
                editingId ? "Deixe em branco para manter o atual" : ""
              }
              helperText="Header Token. Nunca é exibido depois de salvo."
              className="mb-0"
            />
            <FormField
              label="UserToken (opcional nesta empresa)"
              type="password"
              value={form.brasil_nfe_user_token}
              onChange={(e) => set("brasil_nfe_user_token", e.target.value)}
              placeholder={
                editingId ? "Deixe em branco para manter o atual" : ""
              }
              helperText="Fallback: variável BRASIL_NFE_USER_TOKEN no servidor."
              className="mb-0"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              {editingId ? "Salvar alterações" : "Cadastrar empresa"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-text-primary">
          Certificado digital A1
        </h2>
        <p className="mb-4 text-sm text-text-secondary">
          Envie o arquivo .pfx/.p12 e a senha. O arquivo e a senha não voltam
          para o navegador. A senha é cifrada no servidor.
        </p>
        <form onSubmit={handleEnviarCertificado} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Empresa"
              type="select"
              required
              value={certEmpresaId}
              onChange={(e) => setCertEmpresaId(e.target.value)}
              options={empresas.map((e) => ({
                value: String(e.id),
                label: `${e.razao_social} (${e.cnpj})`,
              }))}
              allowEmpty
              emptyLabel="Selecione"
              className="mb-0"
            />
            <FormField
              label="Arquivo .pfx / .p12"
              type="file"
              required
              accept=".pfx,.p12,application/x-pkcs12"
              onChange={(e) => setCertFile(e.target.files?.[0] || null)}
              helperText={
                certFile
                  ? `Selecionado: ${certFile.name}`
                  : "Obrigatório. Sem o arquivo o botão Enviar fica desativado."
              }
              className="mb-0"
            />
            <FormField
              label="Senha do certificado"
              type="password"
              value={certSenha}
              onChange={(e) => setCertSenha(e.target.value)}
              autoComplete="new-password"
              className="mb-0"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              loading={certLoading}
              disabled={!certEmpresaId}
              onClick={handleVerificarCertificado}
            >
              Verificar na Brasil NFe
            </Button>
            <Button
              type="submit"
              loading={certLoading}
              disabled={!certEmpresaId || !certFile || !certSenha}
            >
              Enviar certificado
            </Button>
          </div>
        </form>
        {certCheck && (
          <Alert
            className="mt-4"
            type={certCheck.expirado ? "warning" : "info"}
            title="Retorno da verificação"
          >
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(
                {
                  expirado: certCheck.expirado,
                  dt_expiracao: certCheck.dt_expiracao,
                  status: certCheck.status,
                  avisos: certCheck.avisos,
                  error: certCheck.error,
                },
                null,
                2,
              )}
            </pre>
          </Alert>
        )}
      </Card>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir empresa fiscal"
        message={
          deleteTarget
            ? `Deseja excluir a empresa fiscal "${deleteTarget.razao_social}"? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmText={deleting ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        warning
        loading={deleting}
      />
    </PageLayout>
  );
}
