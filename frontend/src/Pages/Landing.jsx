import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui";
import PlanComparison from "../components/PlanComparison.jsx";
import SiteLayout from "../components/site/SiteLayout.jsx";
import ProductPreview from "../components/site/ProductPreview.jsx";
import PlanCardGrid from "../components/site/PlanCardGrid.jsx";
import Seo from "../components/Seo.jsx";
import {
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  PUBLIC_REGISTER_ENABLED,
} from "../brand.js";
import { BILLING_TRIAL_DAYS, resolvePlanCards } from "../utils/billing.js";
import { registerHref } from "../utils/planLid.js";
import { trackFunnel } from "../utils/funnel.js";
import { usePublicPlansQuery } from "../hooks/queries/usePublicPlansQuery.js";
import { useAuth } from "../context/AuthContext.jsx";

const HERO_IMG = "/images/landing-hero-truck.jpg";
const PATIO_IMG = "/images/landing-frota-patio.jpg";
const PNEUS_IMG = "/images/landing-pneus.jpg";
const ESTRADA_IMG = "/images/landing-estrada.jpg";
const DASHBOARD_IMG = "/images/landing-dashboard.jpg";
const OFICINA_IMG = "/images/landing-oficina.jpg";
const RELATORIOS_IMG = "/images/landing-relatorios.jpg";

const BENEFITS = [
  { eyebrow: "01", title: "Controle da frota", text: "Veículos, composição, motoristas e documentos em um só cadastro." },
  { eyebrow: "02", title: "Controle financeiro", text: "Acompanhe gastos e custos da operação por veículo e no consolidado." },
  { eyebrow: "03", title: "Manutenção", text: "Checklist, pendências e histórico para não perder o que vence." },
  { eyebrow: "04", title: "Pneus", text: "Posição, estoque e vida útil no veículo, junto da manutenção da frota." },
  { eyebrow: "05", title: "Fiscal", text: "NF-e, estoque de peças, CT-e, MDF-e e contrato de frete a partir do plano Fiscal." },
  { eyebrow: "06", title: "Indicadores", text: "Dashboard, custo por km e relatórios da frota. No Fiscal e no Completo, entram também NF-e, estoque e emissão." },
];

const PRODUCT_SHOTS = [
  { title: "Dashboard", text: "Indicadores e gráficos de custo da frota.", image: DASHBOARD_IMG, alt: "Painel de controle da operação" },
  { title: "Frota", text: "Caminhões, cavalos e carretas no mesmo cadastro.", image: PATIO_IMG, alt: "Frota estacionada no pátio" },
  { title: "Gastos", text: "Abastecimento e custos lançados por veículo.", image: ESTRADA_IMG, alt: "Caminhão em operação na estrada" },
  { title: "Manutenção", text: "Checklist e histórico de serviços.", image: OFICINA_IMG, alt: "Oficina e manutenção da frota" },
  { title: "Pneus", text: "Posição, estoque e vida útil no veículo.", image: PNEUS_IMG, alt: "Controle de pneus" },
  { title: "Relatórios", text: "Custo por km e exportação quando precisar.", image: RELATORIOS_IMG, alt: "Relatórios e indicadores da frota" },
];

function faqs(trialDays) {
  return [
    { q: "O que é a Atrack?", a: `${PRODUCT_NAME} é um sistema de ${PRODUCT_TAGLINE.toLowerCase()} para transportadoras: frota, gastos, manutenção, documentos, pneus e relatórios no mesmo lugar.` },
    { q: "Para quem é a Atrack?", a: "Para empresas de transporte que precisam sair da planilha e acompanhar a operação com dados isolados da própria conta." },
    { q: "Existe período de teste?", a: `Sim. O cadastro abre ${trialDays} dias no plano Starter, sem cartão. Depois, você assina para continuar.` },
    { q: "Posso cancelar?", a: "Sim. Encerre a conta ou cancele a assinatura antes do fim do trial se não quiser continuar. Clientes com Stripe gerenciam o pagamento no portal da assinatura." },
    { q: "Quais recursos estão disponíveis em cada plano?", a: "Starter é entrada: até 8 veículos e 2 usuários, com dashboard, frota, pneus, gastos, manutenção, documentos e relatórios. Fiscal e Completo abrem NF-e, estoque e emissão de CT-e, MDF-e e CIOT. A ordem de coleta não entra nos planos públicos." },
    { q: "Como funciona a contratação?", a: "Você escolhe o plano, cria a empresa e, se não for o trial Starter, conclui o pagamento no checkout. O identificador do plano segue do site até a assinatura." },
    { q: "Posso trocar de plano?", a: "Sim. Administradores acessam Assinatura no sistema e escolhem Starter, Fiscal ou Completo." },
    { q: "Meus dados ficam seguros?", a: "Cada empresa é um espaço isolado (tenant). Usuários só veem a frota da própria conta. Detalhes estão na política de privacidade." },
  ];
}

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 10h11M10.5 5.5 15 10l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CheckIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-secondary"><path fill="currentColor" d="m8.2 14.7-4-4 1.4-1.4 2.6 2.6 6.2-6.2 1.4 1.4-7.6 7.6Z" /></svg>;
}

export default function Landing() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { data, isError } = usePublicPlansQuery();
  const [openFaq, setOpenFaq] = useState(0);
  const trialDays = data?.trialDays || BILLING_TRIAL_DAYS;
  const plans = resolvePlanCards(data?.plans);
  const signupHref = PUBLIC_REGISTER_ENABLED ? registerHref("starter") : "/login";
  const faqItems = faqs(trialDays);

  useEffect(() => { trackFunnel("view_home"); }, []);

  useEffect(() => {
    const id = location.hash.replace("#", "");
    if (!id) return undefined;
    const node = document.getElementById(id);
    if (node) window.setTimeout(() => node.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    return undefined;
  }, [location.hash]);

  return (
    <SiteLayout signupHref={signupHref}>
      <Seo title={`${PRODUCT_NAME} — Controle sua transportadora em um só lugar`} description={`${PRODUCT_NAME} concentra frota, gastos, manutenção, pneus, documentos e indicadores. ${trialDays} dias para testar o Starter.`} path="/" />

      <section className="relative isolate min-h-[720px] overflow-hidden bg-primary-dark lg:min-h-[760px]">
        <img src={HERO_IMG} alt="Caminhão em operação na rodovia" className="absolute inset-0 h-full w-full object-cover object-[68%_center]" width={1920} height={1080} fetchPriority="high" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_38%,rgba(255,255,255,.12),transparent_27%),linear-gradient(90deg,#081a2c_0%,rgba(8,26,44,.96)_35%,rgba(8,26,44,.45)_72%,rgba(8,26,44,.2)_100%)]" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-primary-dark/40 to-transparent" aria-hidden />
        <div className="relative mx-auto flex min-h-[720px] max-w-6xl items-center px-4 py-20 sm:px-6 lg:min-h-[760px]">
          <div className="max-w-2xl pt-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-secondary-light backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary-light" /> Gestão feita para transportadoras
            </div>
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.06] tracking-[-0.035em] text-white sm:text-6xl lg:text-[4.5rem]">Mais controle.<br /><span className="text-secondary-light">Menos improviso.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">A Atrack conecta frota, gastos, manutenção, documentos e indicadores para sua transportadora operar com clareza todos os dias.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={signupHref} onClick={() => trackFunnel("cta_start", { lid: "starter", location: "hero" })}><Button variant="secondary" size="lg" className="group gap-2 shadow-lg shadow-secondary/20">Começar agora <ArrowIcon /></Button></Link>
              <a href="#produto"><Button variant="outline" size="lg" className="border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20">Ver como funciona</Button></a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-200">
              <span className="flex items-center gap-2"><CheckIcon /> {trialDays} dias para testar</span>
              <span className="flex items-center gap-2"><CheckIcon /> Sem cartão no cadastro</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-7 right-6 hidden rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur-md lg:block">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Uma visão da operação</p>
          <p className="mt-1 text-sm font-semibold">Decisões melhores começam com dados.</p>
        </div>
      </section>

      <section className="relative z-10 -mt-8 mx-auto max-w-6xl px-4 sm:px-6" aria-label="Benefícios principais">
        <div className="grid overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_60px_rgba(8,26,44,.12)] sm:grid-cols-3">
          {[['01', 'Tudo em um só lugar', 'Fim da informação espalhada em planilhas.'], ['02', 'Visão por veículo', 'Entenda onde a operação ganha ou perde dinheiro.'], ['03', 'Decisão com contexto', 'Acompanhe a rotina antes que o problema apareça.']].map(([number, title, text]) => <div key={number} className="border-b border-border p-5 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:p-6"><p className="text-xs font-bold tracking-[0.18em] text-secondary">{number}</p><p className="mt-2 font-semibold text-primary-dark">{title}</p><p className="mt-1 text-sm leading-relaxed text-text-secondary">{text}</p></div>)}
        </div>
      </section>

      <section className="bg-white py-20 sm:py-28" id="produto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-end gap-6 lg:grid-cols-[1fr_auto]">
            <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">O produto</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.025em] text-primary-dark sm:text-4xl">A operação inteira no seu campo de visão.</h2><p className="mt-4 text-base leading-7 text-text-secondary">Um sistema simples de usar, mas completo o suficiente para acompanhar a realidade de uma transportadora.</p></div>
            <a href="#beneficios" className="hidden items-center gap-2 text-sm font-semibold text-secondary transition hover:gap-3 sm:flex">Explorar recursos <ArrowIcon /></a>
          </div>
          <div className="mt-10 rounded-3xl bg-slate-50 p-2 ring-1 ring-border sm:p-3"><ProductPreview /></div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{PRODUCT_SHOTS.map((item, index) => <li key={item.title} className="group overflow-hidden rounded-2xl border border-border bg-white shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-lg"><div className="relative aspect-[16/10] overflow-hidden bg-slate-200"><img src={item.image} alt={item.alt} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" width={800} height={500} /><span className="absolute left-3 top-3 rounded-full bg-primary-dark/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white backdrop-blur">0{index + 1}</span></div><div className="p-5"><h3 className="font-semibold text-primary-dark">{item.title}</h3><p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{item.text}</p></div></li>)}</ul>
        </div>
      </section>

      <section className="bg-slate-50 py-20 sm:py-28" id="beneficios">
        <div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Visão 360º</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.025em] text-primary-dark sm:text-4xl">O que você controla</h2><p className="mt-4 text-base leading-7 text-text-secondary">Menos tempo procurando informação. Mais tempo cuidando da operação.</p></div><ul className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">{BENEFITS.map((item) => <li key={item.title} className="group bg-white p-6 transition hover:bg-secondary/5 sm:p-7"><p className="text-xs font-bold tracking-[0.18em] text-secondary">{item.eyebrow}</p><h3 className="mt-8 font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-text-secondary">{item.text}</p><div className="mt-6 h-px w-8 bg-secondary transition-all group-hover:w-14" /></li>)}</ul></div>
      </section>

      <section id="precos" className="scroll-mt-20 border-y border-border bg-white py-20 sm:py-28"><div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Planos transparentes</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.025em] text-primary-dark sm:text-4xl">Escolha o ritmo da sua operação.</h2><p className="mt-4 text-base leading-7 text-text-secondary">Comece pelo essencial e evolua quando a sua empresa precisar.</p></div><Link to="/planos" className="flex items-center gap-2 text-sm font-semibold text-secondary hover:gap-3">Comparar todos os planos <ArrowIcon /></Link></div>{isError ? <p className="mt-8 rounded-xl border border-border bg-slate-50 p-4 text-sm text-text-secondary">Exibindo os planos de referência. Confira detalhes em <Link to="/planos" className="font-medium text-secondary">/planos</Link>.</p> : null}<div className="mt-10"><PlanCardGrid plans={plans} isAuthenticated={isAuthenticated} registerEnabled={PUBLIC_REGISTER_ENABLED} trialDays={trialDays} /></div><div className="mt-12"><PlanComparison /></div></div></section>

      <section className="bg-slate-50 py-20 sm:py-28" id="faq"><div className="mx-auto max-w-4xl px-4 sm:px-6"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Dúvidas?</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.025em] text-primary-dark sm:text-4xl">Perguntas frequentes</h2></div><dl className="mt-10 space-y-3">{faqItems.map((item, index) => { const isOpen = openFaq === index; return <div key={item.q} className={`overflow-hidden rounded-2xl border bg-white transition ${isOpen ? "border-secondary/50 shadow-sm" : "border-border"}`}><dt><button type="button" aria-expanded={isOpen} onClick={() => setOpenFaq(isOpen ? -1 : index)} className="flex w-full items-center justify-between gap-5 p-5 text-left font-semibold text-primary-dark sm:p-6"><span>{item.q}</span><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-normal text-secondary transition-transform ${isOpen ? "rotate-45" : ""}`}>+</span></button></dt>{isOpen ? <dd className="px-5 pb-6 text-sm leading-7 text-text-secondary sm:px-6">{item.a}</dd> : null}</div>; })}</dl></div></section>

      <section className="relative overflow-hidden py-24 text-white sm:py-32"><img src={ESTRADA_IMG} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" width={1600} height={900} /><div className="absolute inset-0 bg-primary-dark/85" aria-hidden /><div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary-light">Pronto para organizar a operação?</p><h2 className="mt-4 text-3xl font-bold tracking-[-0.025em] text-white sm:text-5xl">Comece com a frota da sua empresa.</h2><p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-200">{trialDays} dias no Starter. Sem cartão no cadastro e sem compromisso para começar.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link to={signupHref} onClick={() => trackFunnel("cta_start", { lid: "starter", location: "footer_cta" })}><Button variant="secondary" size="lg" className="gap-2 shadow-lg shadow-secondary/20">Começar agora <ArrowIcon /></Button></Link><Link to="/planos"><Button variant="outline" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white/20">Ver planos</Button></Link></div></div></section>
    </SiteLayout>
  );
}
