import React, { useCallback, useEffect, useState } from "react";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import {
  Alert,
  Button,
  Card,
  FormField,
  LoadingSpinner,
  PageHeader,
} from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { extractApiData } from "../utils/extractApiArray.js";
import { getStatusConfig } from "../utils/statusColors.js";
import { averbacaoProviderLabel } from "../utils/averbacaoLabels.js";

const emptyForm = {
  provider: "atm",
  ambiente: "homologacao",
  automatico: false,
  ativo: false,
  seguradora: "",
  numero_apolice: "",
  tipo_cobertura: "",
  codigo_atm: "",
  usuario: "",
  senha: "",
};

function toForm(cfg) {
  if (!cfg) return emptyForm;
  return {
    provider: cfg.provider || "atm",
    ambiente: cfg.ambiente || "homologacao",
    automatico: Boolean(cfg.automatico),
    ativo: Boolean(cfg.ativo),
    seguradora: cfg.seguradora || "",
    numero_apolice: cfg.numero_apolice || "",
    tipo_cobertura: cfg.tipo_cobertura || "",
    codigo_atm: cfg.codigo_atm || "",
    usuario: "",
    senha: "",
  };
}

export default function FiscalSeguro() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [meta, setMeta] = useState(null);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const load = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await apiFetch({ url: "/fiscal/seguro/config" });
      const data = extractApiData(res);
      setMeta(data);
      setForm(toForm(data));
    } catch (err) {
      const parsed = await parseApiError(err);
      setErro(parsed.message || "Falha ao carregar a configuração de seguro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErro("");
    setMsg("");
    try {
      const body = {
        provider: form.provider,
        ambiente: form.ambiente,
        automatico: form.automatico,
        ativo: form.ativo,
        seguradora: form.seguradora || null,
        numero_apolice: form.numero_apolice || null,
        tipo_cobertura: form.tipo_cobertura || null,
        codigo_atm: form.codigo_atm || null,
      };
      if (form.usuario.trim()) body.usuario = form.usuario.trim();
      if (form.senha) body.senha = form.senha;
      const res = await apiFetch({
        method: "PUT",
        url: "/fiscal/seguro/config",
        data: body,
      });
      const data = extractApiData(res);
      setMeta(data);
      setForm(toForm(data));
      setMsg("Configuração de seguro/averbação salva.");
    } catch (err) {
      const parsed = await parseApiError(err);
      setErro(parsed.message || "Não foi possível salvar a configuração.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestar = async () => {
    setTesting(true);
    setErro("");
    setMsg("");
    try {
      const res = await apiFetch({
        method: "POST",
        url: "/fiscal/seguro/config/testar",
      });
      const data = extractApiData(res);
      setMsg(data?.message || "Teste de conexão concluído.");
      await load();
    } catch (err) {
      const parsed = await parseApiError(err);
      setErro(parsed.message || "Falha no teste de conexão.");
    } finally {
      setTesting(false);
    }
  };

  const status = meta?.status_integracao || "inactive";

  return (
    <PageLayout className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: "Seguro / Averbação" },
        ]}
      />
      <PageHeader
        title="Seguro / Averbação"
        subtitle="Integração com a averbadora (AT&M) por empresa. Homologação e produção usam URLs oficiais distintas — nunca misturadas."
      />

      {msg && (
        <Alert type="success" message={msg} dismissible onClose={() => setMsg("")} />
      )}
      {erro && (
        <Alert type="error" message={erro} dismissible onClose={() => setErro("")} />
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusConfig(status === "ok" ? "averbed" : status === "error" ? "error" : "pending")}`}
            >
              Integração: {status === "ok" ? "OK" : status === "error" ? "Erro" : "Inativa"}
            </span>
            <span className="text-sm text-text-secondary">
              Provedor: {averbacaoProviderLabel(meta?.provider || form.provider)}
            </span>
            {meta?.ultima_validacao_em && (
              <span className="text-sm text-text-secondary">
                Último teste:{" "}
                {new Date(meta.ultima_validacao_em).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
          {meta?.ultima_validacao_erro && (
            <p className="text-sm text-danger">{meta.ultima_validacao_erro}</p>
          )}

          <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Provedor"
              name="provider"
              type="select"
              value={form.provider}
              onChange={(e) => set("provider", e.target.value)}
              options={[{ value: "atm", label: "AT&M" }]}
            />
            <FormField
              label="Ambiente"
              name="ambiente"
              type="select"
              value={form.ambiente}
              onChange={(e) => set("ambiente", e.target.value)}
              options={[
                { value: "homologacao", label: "Homologação" },
                { value: "producao", label: "Produção" },
              ]}
              helperText="Homologação usa homologaws.averba.com.br; produção, webserver.averba.com.br."
            />
            <FormField
              label="Seguradora"
              name="seguradora"
              value={form.seguradora}
              onChange={(e) => set("seguradora", e.target.value)}
            />
            <FormField
              label="Número da apólice"
              name="numero_apolice"
              value={form.numero_apolice}
              onChange={(e) => set("numero_apolice", e.target.value)}
            />
            <FormField
              label="Tipo de cobertura"
              name="tipo_cobertura"
              value={form.tipo_cobertura}
              onChange={(e) => set("tipo_cobertura", e.target.value)}
              placeholder="RCTRC, RCF-DC…"
            />
            <FormField
              label="Código AT&M"
              name="codigo_atm"
              value={form.codigo_atm}
              onChange={(e) => set("codigo_atm", e.target.value)}
              helperText="Identificador da conta na AT&M (não é a senha)."
            />
            <FormField
              label="Usuário"
              name="usuario"
              value={form.usuario}
              onChange={(e) => set("usuario", e.target.value)}
              autoComplete="off"
              placeholder={meta?.usuario_set ? "•••• (cadastrado — deixe vazio para manter)" : ""}
            />
            <FormField
              label="Senha"
              name="senha"
              type="password"
              value={form.senha}
              onChange={(e) => set("senha", e.target.value)}
              autoComplete="new-password"
              placeholder={meta?.senha_set ? "•••• (cadastrada — deixe vazio para manter)" : ""}
            />
            <label className="flex items-start gap-2 text-sm text-text-secondary cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-border"
                checked={form.ativo}
                onChange={(e) => set("ativo", e.target.checked)}
              />
              <span>Integração ativa</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-text-secondary cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-border"
                checked={form.automatico}
                onChange={(e) => set("automatico", e.target.checked)}
              />
              <span>
                Averbação automática após autorização do CT-e / declaração do MDF-e
              </span>
            </label>
            <div className="sm:col-span-2 flex flex-wrap gap-3">
              <Button type="submit" loading={saving}>
                Salvar
              </Button>
              <Button
                type="button"
                variant="outline"
                loading={testing}
                onClick={handleTestar}
              >
                Testar conexão
              </Button>
            </div>
          </form>
        </Card>
      )}
    </PageLayout>
  );
}
