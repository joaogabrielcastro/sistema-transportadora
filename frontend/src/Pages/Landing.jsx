import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui";
import PlanComparison from "../components/PlanComparison.jsx";
import LegalLinks from "../components/LegalLinks.jsx";
import {
  PRODUCT_LOGO_ALT,
  PRODUCT_LOGO_SRC,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  PUBLIC_REGISTER_ENABLED,
} from "../brand.js";
import {
  BILLING_TRIAL_DAYS,
  PLAN_CARDS,
  formatPlanPrice,
} from "../utils/billing.js";

const signupHref = PUBLIC_REGISTER_ENABLED ? "/register" : "/login";

const PILLARS = [
  {
    title: "Frota no mesmo lugar",
    text: "Caminhões, cavalos, carretas, composição, motoristas e documentos — sem planilha paralela.",
  },
  {
    title: "Pneus com vida útil",
    text: "Posição, estoque, instalação e km rodado. Você vê o pneu acabar antes de estourar o custo.",
  },
  {
    title: "Custo por km de verdade",
    text: "Gastos, manutenção e relatórios no mesmo painel, por veículo e no consolidado da operação.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Crie a empresa",
    text: `Cadastro em minutos. ${BILLING_TRIAL_DAYS} dias para usar o Starter sem cartão na porta.`,
  },
  {
    n: "2",
    title: "Suba a frota",
    text: "Cadastre veículos, pneus e a equipe. Convide operadores por e-mail.",
  },
  {
    n: "3",
    title: "Opere o dia a dia",
    text: "Lance gastos, acompanhe manutenções e exporte relatórios quando precisar.",
  },
];

const FAQS = [
  {
    q: "O trial precisa de cartão?",
    a: `Não. Você cria a empresa, usa o plano Starter por ${BILLING_TRIAL_DAYS} dias e só assina se quiser continuar.`,
  },
  {
    q: "Meus dados ficam misturados com outra transportadora?",
    a: "Não. Cada empresa é um espaço isolado (tenant). Usuários só veem a frota da própria conta.",
  },
  {
    q: "Posso começar no Starter e subir de plano?",
    a: "Sim. Fiscal e Completo acrescentam NF-e e estoque. A ordem de coleta não entra nos planos públicos.",
  },
  {
    q: "Há limite de veículos e usuários?",
    a: "Sim. Starter inclui até 15 veículos e 3 usuários; Fiscal, 40 e 8; Completo, 100 e 20. Convites pendentes também ocupam vaga.",
  },
  {
    q: "Já tenho login. Onde entro?",
    a: "Use Entrar no topo. Esta página é só para quem ainda não conhece o produto.",
  },
];

function CheckItem({ children }) {
  return (
    <li className="flex gap-2">
      <span
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-[10px] font-bold text-secondary"
        aria-hidden
      >
        ✓
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}

CheckItem.propTypes = {
  children: PropTypes.node,
};

export default function Landing() {
  const location = useLocation();

  useEffect(() => {
    const id = location.hash.replace("#", "");
    if (!id) return undefined;
    const node = document.getElementById(id);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
    return undefined;
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#conteudo" className="flex min-w-0 items-center gap-3">
            <img
              src={PRODUCT_LOGO_SRC}
              alt={PRODUCT_LOGO_ALT}
              className="h-10 w-10 shrink-0 rounded-lg border border-border bg-white object-contain p-1"
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-bold">{PRODUCT_NAME}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                {PRODUCT_TAGLINE}
              </p>
            </div>
          </a>
          <nav className="flex items-center gap-2 sm:gap-3">
            <a
              href="#precos"
              className="hidden text-sm font-medium text-text-secondary hover:text-text-primary sm:inline"
            >
              Preços
            </a>
            <Link
              to="/login"
              className="text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Entrar
            </Link>
            <Link to={signupHref}>
              <Button variant="secondary" size="sm">
                Começar trial
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main id="conteudo">
        <section className="relative overflow-hidden bg-primary text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(148,163,184,0.15) 0%, transparent 45%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                SaaS para transportadoras
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl xl:text-5xl">
                Gestão de frotas para quem já opera no pátio — não na planilha
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
                {PRODUCT_NAME} concentra veículos, pneus, custos, documentos e
                relatórios de custo/km. {BILLING_TRIAL_DAYS} dias grátis no
                Starter para a sua empresa testar com dados reais.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={signupHref}>
                  <Button variant="secondary" size="lg">
                    Começar {BILLING_TRIAL_DAYS} dias grátis
                  </Button>
                </Link>
                <a href="#precos">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                  >
                    Ver preços
                  </Button>
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                Sem cartão no cadastro. Cancele antes do fim do trial se não
                quiser assinar.
              </p>
            </div>
            <ul className="grid gap-3 self-center">
              {PILLARS.map((item) => (
                <li
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" id="como-funciona">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Do cadastro ao custo/km em três passos
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="rounded-2xl border border-border bg-white p-5 shadow-card"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary/15 text-sm font-bold text-secondary">
                  {step.n}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="precos"
          className="scroll-mt-20 border-y border-border bg-white py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Planos claros, trial no Starter
              </h2>
              <p className="mt-2 text-sm text-text-secondary sm:text-base">
                Preços mensais de referência. A ordem de coleta não é vendida nos
                planos públicos.
              </p>
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {PLAN_CARDS.map((plan) => (
                <article
                  key={plan.id}
                  className={`flex h-full flex-col rounded-2xl border border-border bg-background p-5 shadow-card sm:p-6 ${
                    plan.popular
                      ? "border-t-4 border-t-secondary"
                      : plan.bestValue
                        ? "border-t-4 border-t-primary"
                        : "border-t-4 border-t-border"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    {plan.popular ? (
                      <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-secondary">
                        Popular
                      </span>
                    ) : null}
                    {plan.bestValue ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                        Completo
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-secondary">
                    {plan.tagline}
                  </p>
                  <p className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight text-primary">
                      {formatPlanPrice(plan.priceMonthlyBrl)}
                    </span>
                    <span className="text-sm text-text-light">/mês</span>
                  </p>
                  {plan.trialEligible ? (
                    <p className="mt-1.5 text-xs font-medium text-success-dark">
                      {BILLING_TRIAL_DAYS} dias grátis no cadastro
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-text-secondary">
                      Assinatura após criar a conta
                    </p>
                  )}
                  <p className="mt-4 text-sm leading-relaxed text-text-secondary">
                    {plan.description}
                  </p>
                  <ul className="mt-4 mb-5 flex-1 space-y-2 text-sm">
                    {plan.highlights.map((h) => (
                      <CheckItem key={h}>{h}</CheckItem>
                    ))}
                  </ul>
                  <Link to={signupHref} className="mt-auto">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "secondary" : "primary"}
                    >
                      {plan.trialEligible
                        ? "Começar trial"
                        : "Criar conta"}
                    </Button>
                  </Link>
                </article>
              ))}
            </div>
            <div className="mt-10">
              <PlanComparison />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6" id="faq">
          <h2 className="text-2xl font-bold tracking-tight">Perguntas frequentes</h2>
          <dl className="mt-6 space-y-4">
            {FAQS.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-border bg-white p-5 shadow-card"
              >
                <dt className="font-semibold">{item.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-t border-border bg-primary py-14 text-white">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Teste com a frota da sua empresa
            </h2>
            <p className="mt-3 text-slate-300">
              {BILLING_TRIAL_DAYS} dias no Starter. Se servir, assine. Se não,
              encerre antes do vencimento.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to={signupHref}>
                <Button variant="secondary" size="lg">
                  Criar conta
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Já tenho acesso
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <p className="text-xs text-text-light">
            © {new Date().getFullYear()} {PRODUCT_NAME} {PRODUCT_TAGLINE}
          </p>
          <LegalLinks className="text-center text-xs text-text-light" />
        </div>
      </footer>
    </div>
  );
}
