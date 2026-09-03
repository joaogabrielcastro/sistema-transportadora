import React from "react";
import PropTypes from "prop-types";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "../brand.js";
import LegalLayout from "../components/LegalLayout.jsx";
import { legalContactLabel } from "../legal.js";

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

export default function Termos() {
  const contact = legalContactLabel();

  return (
    <LegalLayout title="Termos de uso">
      <p>
        Estes termos regulam o uso do {PRODUCT_NAME} ({PRODUCT_TAGLINE}), plataforma de
        gestão de frotas em modelo software como serviço (SaaS). Ao criar uma conta,
        aceitar um convite ou usar o sistema, você concorda com este documento.
      </p>

      <Section title="1. Quem se vincula">
        <p>
          O contrato é firmado entre a organização que opera esta instância do{" "}
          {PRODUCT_NAME} (“nós”) e a empresa cadastrada (“você” ou “cliente”),
          representada pela pessoa que aceita estes termos.
        </p>
        <p>
          Cada empresa (tenant) tem dados isolados. Usuários convidados pela empresa
          também se vinculam a estes termos ao definir a senha e acessar o sistema.
        </p>
      </Section>

      <Section title="2. O serviço">
        <p>
          O {PRODUCT_NAME} oferece ferramentas para cadastro de frota, pneus,
          manutenção, gastos, documentos, relatórios e, conforme o plano, módulos
          adicionais (por exemplo notas fiscais ou ordem de coleta).
        </p>
        <p>
          O serviço é prestado “como disponível”. Podemos melhorar, alterar ou
          descontinuar funcionalidades com aviso razoável quando a mudança for
          material.
        </p>
      </Section>

      <Section title="3. Conta e responsabilidades do cliente">
        <ul className="list-disc space-y-1 pl-5">
          <li>Manter credenciais em sigilo e usuários com perfil adequado.</li>
          <li>
            Garantir que os dados inseridos (placas, motoristas, documentos, notas)
            são lícitos e que você tem legitimidade para tratá-los.
          </li>
          <li>
            Não tentar acessar dados de outra empresa, sobrecarregar a API ou
            contornar limites de plano, autenticação ou auditoria.
          </li>
        </ul>
      </Section>

      <Section title="4. Planos, trial e pagamento">
        <p>
          Novas empresas podem iniciar em período de teste, conforme condições
          exibidas no cadastro e na tela de assinatura. Após o trial, o acesso aos
          módulos cobrados depende de assinatura ativa. Clientes isentos de cobrança
          (legados ou parceiros) seguem as condições combinadas à parte.
        </p>
      </Section>

      <Section title="5. Conteúdo e documentos">
        <p>
          Arquivos enviados (PDFs de documentos do veículo, comprovantes, XMLs de
          NF-e etc.) permanecem sob sua responsabilidade. Você nos autoriza a
          armazená-los e processá-los apenas para prestar o serviço.
        </p>
      </Section>

      <Section title="6. Disponibilidade e suporte">
        <p>
          Buscamos manter o sistema disponível, mas não garantimos operação
          ininterrupta. Manutenções, falhas de provedores (nuvem, e-mail, pagamento)
          ou caso fortuito podem causar interrupção. Contato: {contact}.
        </p>
      </Section>

      <Section title="7. Limitação de responsabilidade">
        <p>
          O {PRODUCT_NAME} é uma ferramenta de gestão. Decisões operacionais,
          fiscais e de segurança da frota são do cliente. Na medida permitida pela
          lei, não respondemos por lucros cessantes, perda de dados causada por
          uso indevido ou por danos indiretos. Nossa responsabilidade, quando
          existir, limita-se ao valor pago pelo serviço nos 12 meses anteriores ao
          fato, ou ao equivalente ao trial se não houver pagamento.
        </p>
      </Section>

      <Section title="8. Encerramento">
        <p>
          Você pode deixar de usar o serviço a qualquer momento. Podemos suspender
          ou encerrar o acesso em caso de inadimplência, uso ilícito ou violação
          destes termos. Após o encerramento, os dados podem ser retidos pelo
          prazo necessário a obrigações legais e depois eliminados.
        </p>
      </Section>

      <Section title="9. Alterações">
        <p>
          Podemos atualizar estes termos. A versão vigente e a data de início
          aparecem nesta página. Uso continuado após a vigência de uma nova versão
          constitui aceite, salvo quando a lei exigir consentimento específico.
        </p>
      </Section>

      <Section title="10. Lei e foro">
        <p>
          Aplica-se a legislação brasileira. Fica eleito o foro da comarca da sede
          da organização que opera esta instância do {PRODUCT_NAME}, salvo foro
          privilegiado previsto em lei.
        </p>
      </Section>
    </LegalLayout>
  );
}
