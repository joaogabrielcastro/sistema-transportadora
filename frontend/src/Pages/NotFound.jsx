import React from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout.jsx";
import { Button, PageHeader } from "../components/ui";

export default function NotFound() {
  return (
    <PageLayout narrow className="space-y-6">
      <PageHeader
        title="Página não encontrada"
        subtitle="O endereço não existe ou foi movido."
      />
      <Link to="/">
        <Button variant="primary">Voltar ao início</Button>
      </Link>
      <p className="text-sm text-text-secondary">
        Se você esperava ver um módulo (ordem de coleta, notas), confira se o
        plano da empresa inclui essa funcionalidade em{" "}
        <Link to="/assinatura" className="text-secondary underline">
          Assinatura
        </Link>
        .
      </p>
    </PageLayout>
  );
}
