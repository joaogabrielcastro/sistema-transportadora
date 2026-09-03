import React from "react";
import PropTypes from "prop-types";
import { PRODUCT_NAME } from "../brand.js";
import LegalLayout from "../components/LegalLayout.jsx";
import { LEGAL_CONTACT_EMAIL, legalContactLabel } from "../legal.js";

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-base font-semibold text-text-primary">{title}</h2>
    <div className="space-y-2 text-text-secondary">{children}</div>
  </section>
);

Section.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export default function Privacidade() {
  const contact = legalContactLabel();

  return (
    <LegalLayout title="Política de privacidade">
      <p>
        Esta política descreve como o {PRODUCT_NAME} trata dados pessoais, em
        conformidade com a Lei nº 13.709/2018 (LGPD). Ela complementa os Termos de
        uso.
      </p>

      <Section title="1. Papéis">
        <p>
          A empresa cliente (transportadora) é, em regra, a <strong>controladora</strong>{" "}
          dos dados operacionais que cadastra: motoristas, documentos, notas
          fiscais, placas e demais registros da frota.
        </p>
        <p>
          A organização que opera o {PRODUCT_NAME} atua como{" "}
          <strong>operadora</strong> desses dados (tratamento sob instrução do
          cliente) e como <strong>controladora</strong> dos dados da conta
          (e-mail de login, nome, perfil, aceite de termos, faturamento da
          assinatura).
        </p>
      </Section>

      <Section title="2. Quais dados tratamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Conta:</strong> nome, e-mail, senha (armazenada como hash),
            perfil (admin, operador, leitura) e registros de aceite.
          </li>
          <li>
            <strong>Empresa:</strong> nome da transportadora, plano, status da
            assinatura e identificadores de pagamento quando houver Stripe.
          </li>
          <li>
            <strong>Operação:</strong> frota, pneus, gastos, manutenções, KM,
            documentos em PDF, motoristas (incluindo CPF quando informado),
            notas fiscais e estoque — conforme os módulos usados.
          </li>
          <li>
            <strong>Técnicos:</strong> IP, data/hora e ações de auditoria em
            alterações relevantes, para segurança e suporte.
          </li>
        </ul>
      </Section>

      <Section title="3. Finalidades e bases legais">
        <p>Tratamos dados para:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>executar o contrato de prestação do SaaS (art. 7º, V, LGPD);</li>
          <li>autenticar usuários, prevenir abuso e registrar auditoria (art. 7º, VI);</li>
          <li>cobrar assinatura e cumprir obrigações fiscais (art. 7º, II e V);</li>
          <li>
            enviar e-mails transacionais (convite, recuperação de senha, ordem de
            coleta), quando configurado.
          </li>
        </ul>
        <p>
          Não vendemos dados pessoais. Não usamos os dados da frota do cliente
          para anúncio a terceiros.
        </p>
      </Section>

      <Section title="4. Compartilhamento">
        <p>
          Podemos usar subprocessadores estritamente necessários: hospedagem e
          banco de dados, armazenamento de arquivos, envio de e-mail, e
          processador de pagamento (Stripe), todos sob obrigação de
          confidencialidade. Autoridades podem receber dados quando a lei exigir.
        </p>
      </Section>

      <Section title="5. Retenção">
        <p>
          Dados da conta e da operação permanecem enquanto a empresa estiver
          ativa. Após encerramento, podemos reter o mínimo necessário para
          defesa de direitos, obrigações legais e backups, e em seguida eliminar
          ou anonimizar.
        </p>
      </Section>

      <Section title="6. Direitos do titular">
        <p>
          Titulares podem solicitar confirmação de tratamento, acesso, correção,
          anonimização, portabilidade, informação sobre compartilhamentos e
          revogação de consentimento, quando esta for a base legal. Pedidos da
          operação da frota devem ser feitos primeiro à empresa cliente
          (controladora). Pedidos sobre a conta no {PRODUCT_NAME} podem ser
          enviados a {contact}.
        </p>
        {LEGAL_CONTACT_EMAIL ? (
          <p>
            Encarregado / contato de privacidade:{" "}
            <a
              className="font-medium text-secondary hover:text-secondary-dark"
              href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            >
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        ) : null}
      </Section>

      <Section title="7. Segurança">
        <p>
          Usamos HTTPS, senhas com hash, isolamento por empresa (tenant) e
          controle de perfil. Nenhum sistema é isento de risco; comunique
          incidentes suspeitos pelo mesmo canal de contato.
        </p>
      </Section>

      <Section title="8. Cookies e sessão">
        <p>
          O aplicativo usa armazenamento local do navegador para manter a sessão
          (token de acesso) e preferências mínimas de uso. Não empregamos rede de
          anúncios de terceiros neste app.
        </p>
      </Section>

      <Section title="9. Alterações">
        <p>
          Esta política pode ser atualizada. A versão e a data de vigência
          aparecem no topo desta página.
        </p>
      </Section>
    </LegalLayout>
  );
}
