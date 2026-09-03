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
export function PermissionRoute({ permission, children }) {
  const { user } = useAuth();

  if (!permission || userHasPermission(user, permission)) {
    return children;
  }

  return (
    <PageLayout narrow className="space-y-6">
      <PageHeader
        title="Acesso restrito"
        subtitle="Seu perfil não permite abrir esta página."
      />
      <Alert
        type="warning"
        message="Peça a um administrador para alterar seu perfil ou liberar a permissão necessária."
      />
      <div className="flex flex-wrap gap-3">
        <Link to="/">
          <Button variant="primary">Voltar ao início</Button>
        </Link>
      </div>
    </PageLayout>
  );
}
