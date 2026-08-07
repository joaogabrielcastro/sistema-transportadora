import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { featureEnabled } from "../utils/billing.js";
import PageLayout from "./layout/PageLayout.jsx";
import { Alert, Button, PageHeader } from "./ui";

const FEATURE_LABELS = {
  ordem_coleta: "Ordem de coleta",
  notas_estoque: "Notas fiscais / estoque",
};

/**
 * Bloqueia rota se o tenant não tiver a feature (mensagem clara + CTA).
 * @param {{ feature: 'ordem_coleta' | 'notas_estoque', children: React.ReactNode }} props
 */
export function FeatureRoute({ feature, children }) {
  const { user } = useAuth();

  if (featureEnabled(user, feature)) {
    return children;
  }

  const label = FEATURE_LABELS[feature] || feature;

  return (
    <PageLayout narrow className="space-y-6">
      <PageHeader
        title="Recurso não disponível"
        subtitle={`${label} não está incluído no plano atual desta empresa.`}
      />
      <Alert
        type="warning"
        message="Faça upgrade do plano ou peça ao administrador para liberar o módulo na assinatura."
      />
      <div className="flex flex-wrap gap-3">
        <Link to="/assinatura">
          <Button variant="primary">Ver planos / Assinatura</Button>
        </Link>
        <Link to="/">
          <Button variant="outline">Voltar ao início</Button>
        </Link>
      </div>
    </PageLayout>
  );
}
