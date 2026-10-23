import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { userHasPermission } from "../utils/permissions.js";
import PageLayout from "./layout/PageLayout.jsx";
import { Alert, Button, PageHeader } from "./ui";

/**
 * Bloqueia a rota se o usuário autenticado não tiver a permissão.
 * A API continua sendo a fonte de verdade; isto evita UX quebrada (403).
 */
export function PermissionRoute({ permission, anyPermission, children }) {
  const { user } = useAuth();

  const allowed = anyPermission
    ? (Array.isArray(anyPermission) ? anyPermission : [anyPermission]).some(
        (p) => userHasPermission(user, p),
      )
    : !permission || userHasPermission(user, permission);

  if (allowed) {
    return children;
  }

  const roleLabel =
    user?.role === "viewer"
      ? "somente leitura"
      : user?.role === "operator"
        ? "operador"
        : null;

  return (
    <PageLayout narrow className="space-y-6">
      <PageHeader
        title="Acesso restrito"
        subtitle={
          roleLabel
            ? `Seu perfil (${roleLabel}) não permite abrir esta página.`
            : "Seu perfil não permite abrir esta página."
        }
      />
      <Alert
        type="warning"
        title="O que fazer agora"
        message="Peça a um administrador da sua empresa para alterar seu perfil ou liberar a permissão. Enquanto isso, você pode continuar nas telas liberadas para o seu acesso."
      />
      <div className="flex flex-wrap gap-3">
        <Link to="/">
          <Button variant="primary">Voltar ao início</Button>
        </Link>
      </div>
    </PageLayout>
  );
}
