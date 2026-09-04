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

const HERO_IMG = "/images/landing-hero-truck.jpg";
const PATIO_IMG = "/images/landing-frota-patio.jpg";
const PNEUS_IMG = "/images/landing-pneus.jpg";
const ESTRADA_IMG = "/images/landing-estrada.jpg";

const PILLARS = [
  {
    title: "Frota no mesmo lugar",
    text: "Caminhões, cavalos, carretas, composição, motoristas e documentos — sem planilha paralela.",
    image: PATIO_IMG,
    alt: "Pátio com caminhões da frota alinhados",
  },
  {
    title: "Pneus com vida útil",
    text: "Posição, estoque, instalação e km rodado. Você vê o pneu acabar antes de estourar o custo.",
    image: PNEUS_IMG,
    alt: "Pneus de caminhão em detalhe",
  },
  {
    title: "Custo por km de verdade",
    text: "Gastos, manutenção e relatórios no mesmo painel, por veículo e no consolidado da operação.",
    image: ESTRADA_IMG,
    alt: "Caminhão em operação na estrada",
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
    a: "Sim. Fiscal acrescenta NF-e de compra e estoque. Completo inclui tudo isso mais emissão de CT-e e MDF-e. A ordem de coleta não entra nos planos públicos.",
  },
  {
    q: "Há limite de veículos e usuários?",
    a: "Sim. Starter inclui até 15 veículos e 3 usuários; Fiscal, 40 e 8; Completo, 100 e 20. Convites pendentes também ocupam vaga.",
  },
  {
    q: "O que muda no Completo em relação ao Fiscal?",
    a: "Além da maior capacidade (100 veículos / 20 usuários) e suporte prioritário, o Completo libera o módulo de fiscal de transporte (CT-e e MDF-e).",
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
        <section className="relative isolate min-h-[78vh] overflow-hidden bg-primary-dark lg:min-h-[86vh]">
          <img
            src={HERO_IMG}
            alt="Caminhão em operação na rodovia ao entardecer"
            className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
            width={1920}
            height={1080}
            fetchPriority="high"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-primary-dark via-primary-dark/85 to-primary-dark/25"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-dark/80 via-transparent to-primary-dark/30" aria-hidden />

          <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 py-16 sm:px-6 sm:py-20 lg:min-h-[86vh] lg:justify-center">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary-light">
                SaaS para transportadoras
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl xl:text-[3.35rem] xl:leading-[1.1]">
                Gestão de frotas para quem já opera no pátio — não na planilha
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-100 sm:text-lg">
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
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    Ver preços
                  </Button>
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-200">
                Sem cartão no cadastro. Cancele antes do fim do trial se não
                quiser assinar.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 sm:py-20" id="produto">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                Operação real
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Feito para o pátio, a estrada e o custo da viagem
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">
                Menos planilha, mais visão da frota: cadastro, pneus e
                relatórios no mesmo sistema.
              </p>
            </div>
            <ul className="mt-10 grid gap-6 md:grid-cols-3">
              {PILLARS.map((item) => (
                <li
                  key={item.title}
                  className="overflow-hidden rounded-2xl border border-border bg-white shadow-card"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-slate-200">
                    <img
                      src={item.image}
                      alt={item.alt}
                      className="h-full w-full object-cover transition duration-500 hover:scale-[1.04]"
                      loading="lazy"
                      width={800}
                      height={500}
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                      {item.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20"
          id="como-funciona"
        >
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="overflow-hidden rounded-3xl border border-border shadow-card">
              <img
                src={PATIO_IMG}
                alt="Frota estacionada no pátio da transportadora"
                className="h-full min-h-[280px] w-full object-cover lg:min-h-[420px]"
                loading="lazy"
                width={1200}
                height={750}
              />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Do cadastro ao custo/km em três passos
              </h2>
              <ol className="mt-8 grid gap-4">
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
            </div>
          </div>
        </section>

        <section
          id="precos"
          className="scroll-mt-20 border-y border-border bg-gradient-to-b from-white via-background to-white py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                Preços transparentes
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Planos alinhados ao que sua frota usa no dia a dia
              </h2>
              <p className="mt-2 text-sm text-text-secondary sm:text-base">
                Comece grátis no Starter. Suba para Fiscal (NF-e e estoque) ou
                Completo (CT-e e MDF-e) quando a operação pedir.
              </p>
            </div>
            <div className="mt-10 grid items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
              {PLAN_CARDS.map((plan) => (
                <article
                  key={plan.id}
                  className={`relative flex h-full flex-col rounded-2xl border bg-white p-5 shadow-card sm:p-6 ${
                    plan.popular
                      ? "border-secondary/40 ring-2 ring-secondary/30 shadow-soft lg:-mt-2 lg:mb-2 lg:scale-[1.02]"
                      : plan.bestValue
                        ? "border-primary/25 border-t-4 border-t-primary"
                        : "border-border border-t-4 border-t-border"
                  }`}
                >
                  {plan.popular ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-soft">
                      Mais escolhido
                    </span>
                  ) : null}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    {plan.bestValue ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                        Melhor valor
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
                      {BILLING_TRIAL_DAYS} dias grátis no cadastro · sem cartão
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
                      variant={
                        plan.popular || plan.trialEligible
                          ? "secondary"
                          : "primary"
                      }
                      size="lg"
                    >
                      {plan.trialEligible
                        ? "Começar trial grátis"
                        : plan.bestValue
                          ? "Quero o Completo"
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

        <section className="relative overflow-hidden py-20 text-white">
          <img
            src={ESTRADA_IMG}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            width={1600}
            height={900}
          />
          <div className="absolute inset-0 bg-primary-dark/80" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Teste com a frota da sua empresa
            </h2>
            <p className="mt-3 text-slate-100">
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
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20"
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
