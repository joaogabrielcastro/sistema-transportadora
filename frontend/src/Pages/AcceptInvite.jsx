import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Button, FormField, Alert } from "../components/ui";
import AuthShell from "../components/AuthShell.jsx";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import LegalAcceptCheckbox from "../components/LegalAcceptCheckbox.jsx";

const ROLE_LABEL = {
  admin: "Administrador",
  operator: "Operador",
  viewer: "Somente leitura",
};

export default function AcceptInvite() {
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => String(params.get("token") || "").trim(), [params]);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(Boolean(token));
  const [previewError, setPreviewError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  useEffect(() => {
    if (!token) {
      setPreviewError("Link de convite incompleto.");
      setLoadingPreview(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch({
          method: "GET",
          url: `/auth/invite?token=${encodeURIComponent(token)}`,
        });
        if (!cancelled) setPreview(res.data);
      } catch (err) {
        const parsed = await parseApiError(err);
        if (!cancelled) {
          setPreviewError(parsed.message || "Este convite não é mais válido.");
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem");
      return;
    }
    if (!acceptedLegal) {
      setError("É necessário aceitar os termos de uso e a política de privacidade");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await acceptInvite({ token, password, nome: preview?.nome, acceptedLegal });
      navigate("/", { replace: true });
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Não foi possível aceitar o convite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Aceitar convite"
      subtitle={
        preview
          ? `${preview.empresaNome} convidou você como ${ROLE_LABEL[preview.role] || preview.role}.`
          : "Defina sua senha para acessar a empresa."
      }
    >
      {loadingPreview && (
        <p className="text-sm text-text-secondary">Validando convite…</p>
      )}
      {previewError && (
        <>
          <Alert type="error" message={previewError} />
          <p className="mt-6 text-center text-sm">
            <Link to="/login" className="font-semibold text-secondary">
              Ir para o login
            </Link>
          </p>
        </>
      )}
      {preview && !previewError && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <Alert type="error" message={error} />}
          <FormField
            label="E-mail"
            name="email"
            type="email"
            value={preview.email}
            disabled
          />
          <FormField
            label="Nome"
            name="nome"
            value={preview.nome || ""}
            disabled
          />
          <FormField
            label="Senha"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
          />
          <FormField
            label="Confirmar senha"
            name="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
          <LegalAcceptCheckbox
            checked={acceptedLegal}
            onChange={setAcceptedLegal}
          />
          <Button type="submit" loading={loading} className="w-full py-3">
            Criar acesso
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
