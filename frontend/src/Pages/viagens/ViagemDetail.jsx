import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageLayout from "../../components/layout/PageLayout.jsx";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  PageHeader,
  StatCard,
} from "../../components/ui";
import Icon from "../../components/ui/Icon.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { CardSkeleton } from "../../components/Skeleton.jsx";
import ViagemStatusBadge from "../../components/viagens/ViagemStatusBadge.jsx";
import {
  DespesaModal,
  EditarViagemModal,
  EncerrarViagemModal,
  MotivoModal,
} from "../../components/viagens/ViagemModals.jsx";
import { useToast } from "../../components/ui/useToast.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiFetch, parseApiError } from "../../lib/apiClient.js";
import { PERMISSIONS, userHasPermission } from "../../utils/permissions.js";
import {
  useViagemHistoricoQuery,
  useViagemMutation,
  useViagemQuery,
} from "../../hooks/queries/useViagensQueries.js";
import {
  HISTORICO_LABEL,
  fmtCustoKm,
  fmtDataHora,
  fmtKm,
  fmtMoney,
  formatDuracao,
  historicoLinhas,
  minutosDesde,
} from "../../utils/viagens.js";

function Campo({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-text-secondary">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-text-primary">{children ?? "—"}</dd>
    </div>
  );
}

function Pessoa({ label, pessoa, em }) {
  if (!pessoa && !em) return null;
  return (
    <li className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right">
        <span className="font-medium text-text-primary">{pessoa?.nome || "—"}</span>
        {em ? <span className="block text-xs text-text-secondary">{fmtDataHora(em)}</span> : null}
      </span>
    </li>
  );
}

export default function ViagemDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const can = (p) => userHasPermission(user, p);
  const { data: v, isLoading, isError, error } = useViagemQuery(id);
  const historico = useViagemHistoricoQuery(id);
  const iniciar = useViagemMutation();
  const [modal, setModal] = useState(null); // encerrar | editar | cancelar | despesa | excluir
  const [despesaSel, setDespesaSel] = useState(null);
  const close = () => {
    setModal(null);
    setDespesaSel(null);
  };

  if (isLoading) {
    return (
      <PageLayout className="space-y-6">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={5} />
      </PageLayout>
    );
  }
  if (isError || !v) {
    const notFound = error?.response?.status === 404;
    return (
      <PageLayout className="space-y-6">
        <EmptyState
          icon={<Icon name="route" className="h-5 w-5" />}
          title={notFound ? "Viagem não encontrada" : "Não foi possível abrir a viagem"}
          description={notFound ? "Ela não existe ou não pertence à sua empresa." : "Tente novamente em instantes."}
          action={<Link to="/viagens" className="inline-flex min-h-10 items-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-text-primary hover:bg-slate-50">Voltar para viagens</Link>}
        />
      </PageLayout>
    );
  }

  const fin = v.financeiro_visivel;
  const despesasVisiveis = Array.isArray(v.despesas);
  const aberta = v.status === "em_andamento";
  const podeDespesa = can(PERMISSIONS.VIAGENS_DESPESAS_CREATE) && ["em_andamento", "finalizada"].includes(v.status);
  const podeEditarDespesa = can(PERMISSIONS.VIAGENS_DESPESAS_EDIT) && v.status !== "cancelada";
  const podeExcluirDespesa = can(PERMISSIONS.VIAGENS_DESPESAS_DELETE);
  const duracao = v.duracao_min ?? (aberta ? minutosDesde(v.saida_em) : null);

  const iniciarAgora = async () => {
    try {
      await iniciar.mutateAsync({ method: "POST", url: `/viagens/${v.id}/iniciar`, data: {} });
      toast.success(`Viagem nº ${v.numero} iniciada`);
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    }
  };

  const abrirComprovante = async (d) => {
    // Nova aba aberta já no clique (evita bloqueio de pop-up), preenchida quando o arquivo chega.
    const win = window.open("", "_blank");
    try {
      const res = await apiFetch({
        method: "GET",
        url: `/viagens/${v.id}/despesas/${d.id}/comprovante`,
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      if (win) win.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      win?.close();
      toast.error((await parseApiError(err)).message);
    }
  };

  const actions = (
    <div className="flex flex-wrap gap-2">
      {v.status === "planejada" && can(PERMISSIONS.VIAGENS_START) ? (
        <Button type="button" onClick={iniciarAgora} loading={iniciar.isPending}>
          <Icon name="route" className="h-4 w-4" /> Iniciar viagem
        </Button>
      ) : null}
      {aberta && can(PERMISSIONS.VIAGENS_FINISH) ? (
        <Button type="button" onClick={() => setModal("encerrar")}>
          <Icon name="check" className="h-4 w-4" /> Encerrar viagem
        </Button>
      ) : null}
      {podeDespesa ? (
        <Button type="button" variant="outline" onClick={() => setModal("despesa")}>
          <Icon name="plus" className="h-4 w-4" /> Registrar despesa
        </Button>
      ) : null}
      {v.status !== "cancelada" && can(PERMISSIONS.VIAGENS_EDIT) ? (
        <Button type="button" variant="outline" onClick={() => setModal("editar")}>
          <Icon name="pencil" className="h-4 w-4" /> Editar
        </Button>
      ) : null}
      {["planejada", "em_andamento"].includes(v.status) && can(PERMISSIONS.VIAGENS_EDIT) ? (
        <Button type="button" variant="ghost" className="!text-red-700" onClick={() => setModal("cancelar")}>
          Cancelar viagem
        </Button>
      ) : null}
    </div>
  );

  return (
    <PageLayout className="space-y-6">
      <div>
        <Link to="/viagens?aba=lista" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          ← Viagens
        </Link>
      </div>
      <PageHeader
        eyebrow={`Viagem nº ${v.numero}`}
        title={`${v.origem} → ${v.destino}`}
        meta={<ViagemStatusBadge status={v.status} />}
        subtitle={
          <>
            <span className="font-mono font-semibold text-text-primary">{v.caminhao?.placa}</span>
            {v.motorista?.nome ? ` · ${v.motorista.nome}` : ""} · saída {fmtDataHora(v.saida_em)}
          </>
        }
        actions={actions}
      />

      {v.status === "cancelada" ? (
        <Alert type="error" message={`Viagem cancelada${v.motivo_cancelamento ? `: ${v.motivo_cancelamento}` : "."}`} />
      ) : null}
      {v.tem_ocorrencia ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Ocorrência registrada</p>
            <p className="whitespace-pre-line">{v.ocorrencias}</p>
          </div>
        </div>
      ) : null}

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${fin ? "lg:grid-cols-3 2xl:grid-cols-5" : "lg:grid-cols-3"}`}>
        <StatCard layout="compact" title="Km percorrido" value={v.km_percorrido != null ? fmtKm(v.km_percorrido) : aberta ? "em viagem" : "—"} icon={<Icon name="gauge" className="h-4 w-4" />} color="cyan" />
        <StatCard layout="compact" title={aberta ? "Em viagem há" : "Tempo total"} value={formatDuracao(duracao)} icon={<Icon name="clock" className="h-4 w-4" />} color="blue" />
        <StatCard layout="compact" title="Despesas" value={v.qtd_despesas ?? "—"} icon={<Icon name="receipt" className="h-4 w-4" />} color="slate" hint={despesasVisiveis ? "lançamentos" : "sem acesso"} />
        {fin ? (
          <>
            <StatCard layout="compact" title="Total de despesas" value={fmtMoney(v.total_despesas)} icon={<Icon name="money" className="h-4 w-4" />} color="purple" />
            <StatCard
              layout="compact"
              title="Custo por km"
              value={fmtCustoKm(v.custo_por_km)}
              icon={<Icon name="chart" className="h-4 w-4" />}
              color="orange"
              hint={v.status === "finalizada" ? undefined : "calculado no encerramento"}
            />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card title="Dados da viagem">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo label="Caminhão">
                <Link to={`/caminhao/${v.caminhao?.placa}`} className="font-mono font-semibold hover:underline">{v.caminhao?.placa}</Link>
                {v.caminhao?.modelo ? <span className="text-text-secondary"> · {v.caminhao.modelo}</span> : null}
              </Campo>
              <Campo label="Motorista">{v.motorista?.nome}</Campo>
              <Campo label="Origem → destino">{v.origem} → {v.destino}</Campo>
              <Campo label="Saída">{fmtDataHora(v.saida_em)}</Campo>
              <Campo label="Chegada">{v.chegada_em ? fmtDataHora(v.chegada_em) : aberta ? "Em andamento" : "—"}</Campo>
              <Campo label="Km inicial → final">{fmtKm(v.km_inicial)} → {v.km_final != null ? fmtKm(v.km_final) : "—"}</Campo>
              {v.observacoes ? <div className="sm:col-span-2 lg:col-span-3"><Campo label="Observações"><span className="whitespace-pre-line">{v.observacoes}</span></Campo></div> : null}
              {v.observacoes_encerramento ? (
                <div className="sm:col-span-2 lg:col-span-3"><Campo label="Observações do encerramento"><span className="whitespace-pre-line">{v.observacoes_encerramento}</span></Campo></div>
              ) : null}
            </dl>
          </Card>

          <Card
            title="Despesas"
            subtitle={despesasVisiveis ? "Lançamentos feitos durante a viagem" : undefined}
            noPadding
            action={podeDespesa ? <Button type="button" size="sm" variant="outline" onClick={() => setModal("despesa")}><Icon name="plus" className="h-4 w-4" /> Registrar</Button> : null}
          >
            {!despesasVisiveis ? (
              <div className="p-4"><EmptyState compact dashed icon={<Icon name="eye" className="h-5 w-5" />} title="Sem acesso às despesas" description="Peça ao administrador a permissão Visualizar despesas." /></div>
            ) : v.despesas.length === 0 ? (
              <div className="p-4">
                <EmptyState compact dashed icon={<Icon name="receipt" className="h-5 w-5" />} title="Nenhuma despesa lançada" description={podeDespesa ? "Combustível, pedágio, alimentação, hospedagem e outros custos do percurso." : undefined} />
              </div>
            ) : (
              <DataTable fixed={false}>
                <DataTableHead>
                  <tr>
                    <DataTableTh>Data</DataTableTh>
                    <DataTableTh>Categoria</DataTableTh>
                    <DataTableTh>Descrição</DataTableTh>
                    {fin ? <DataTableTh align="right">Valor</DataTableTh> : null}
                    <DataTableTh>Lançado por</DataTableTh>
                    <DataTableTh align="right"><span className="sr-only">Ações</span></DataTableTh>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {v.despesas.map((d) => (
                    <DataTableRow key={d.id}>
                      <DataTableTd className="whitespace-nowrap tabular-nums">{fmtDataHora(d.registrado_em)}</DataTableTd>
                      <DataTableTd className="whitespace-nowrap">{d.categoria || "—"}</DataTableTd>
                      <DataTableTd className="min-w-[12rem]">
                        {d.descricao}
                        {d.quantidade_combustivel ? <span className="text-xs text-text-secondary"> · {Number(d.quantidade_combustivel).toLocaleString("pt-BR")} L</span> : null}
                      </DataTableTd>
                      {fin ? <DataTableTd align="right" className="whitespace-nowrap font-medium tabular-nums">{fmtMoney(d.valor)}</DataTableTd> : null}
                      <DataTableTd className="whitespace-nowrap text-text-secondary">{d.criado_por?.nome || "—"}</DataTableTd>
                      <DataTableTd align="right" className="whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          {d.tem_comprovante ? (
                            <button type="button" className="rounded-lg p-2 text-text-secondary hover:bg-slate-100 hover:text-text-primary" title={`Comprovante: ${d.comprovante_nome || ""}`} onClick={() => abrirComprovante(d)}>
                              <Icon name="document" className="h-4 w-4" /><span className="sr-only">Ver comprovante</span>
                            </button>
                          ) : null}
                          {podeEditarDespesa ? (
                            <button type="button" className="rounded-lg p-2 text-text-secondary hover:bg-slate-100 hover:text-text-primary" title="Editar" onClick={() => { setDespesaSel(d); setModal("despesa"); }}>
                              <Icon name="pencil" className="h-4 w-4" /><span className="sr-only">Editar despesa</span>
                            </button>
                          ) : null}
                          {podeExcluirDespesa ? (
                            <button type="button" className="rounded-lg p-2 text-text-secondary hover:bg-red-50 hover:text-red-700" title="Excluir" onClick={() => { setDespesaSel(d); setModal("excluir"); }}>
                              <Icon name="trash" className="h-4 w-4" /><span className="sr-only">Excluir despesa</span>
                            </button>
                          ) : null}
                        </div>
                      </DataTableTd>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          {fin && v.despesas_por_categoria?.length ? (
            <Card title="Custo por categoria">
              <ul className="space-y-2 text-sm">
                {v.despesas_por_categoria.map((c) => (
                  <li key={c.categoria} className="flex items-center justify-between gap-3">
                    <span className="text-text-secondary">{c.categoria}</span>
                    <span className="font-medium tabular-nums">{fmtMoney(c.total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Responsáveis">
            <ul className="divide-y divide-border">
              <Pessoa label="Criou" pessoa={v.criado_por} em={v.criado_em} />
              <Pessoa label="Iniciou" pessoa={v.iniciado_por} em={v.iniciado_em} />
              <Pessoa label="Encerrou" pessoa={v.encerrado_por} em={v.encerrado_em} />
              <Pessoa label="Cancelou" pessoa={v.cancelado_por} em={v.cancelado_em} />
            </ul>
          </Card>

          <Card title="Histórico" subtitle="Toda alteração fica registrada" noPadding>
            {historico.isLoading ? (
              <div className="p-4"><CardSkeleton lines={4} /></div>
            ) : historico.isError ? (
              <div className="p-4"><Alert type="error" message="Não foi possível carregar o histórico." /></div>
            ) : (
              <ol className="relative space-y-0 px-4 py-3 sm:px-5">
                {(historico.data || []).map((h) => {
                  const linhas = historicoLinhas(h.alteracoes);
                  return (
                    <li key={h.id} className="relative border-l border-border pb-4 pl-4 last:pb-0">
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-secondary ring-2 ring-white" aria-hidden />
                      <p className="text-sm font-medium text-text-primary">{HISTORICO_LABEL[h.acao] || h.acao}</p>
                      <p className="text-xs text-text-secondary">{h.usuario?.nome || "Sistema"} · {fmtDataHora(h.criado_em)}</p>
                      {h.motivo ? <p className="mt-1 text-xs text-text-primary"><span className="text-text-secondary">Motivo:</span> {h.motivo}</p> : null}
                      {linhas.length && h.acao !== "criada" ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-text-secondary">
                          {linhas.map((l) => (
                            <li key={l.campo}>
                              <span>{l.label}:</span>{" "}
                              {l.valor != null ? <span className="text-text-primary">{l.valor}</span> : <><span className="line-through">{l.de}</span> → <span className="text-text-primary">{l.para}</span></>}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <EncerrarViagemModal viagem={v} isOpen={modal === "encerrar"} onClose={close} />
      <EditarViagemModal viagem={v} isOpen={modal === "editar"} onClose={close} />
      <DespesaModal viagem={v} despesa={despesaSel} isOpen={modal === "despesa"} onClose={close} financeiroVisivel={fin} />
      <MotivoModal
        isOpen={modal === "cancelar"}
        onClose={close}
        title={`Cancelar viagem nº ${v.numero}?`}
        description="A viagem fica como cancelada (não é apagada). Despesas já lançadas continuam registradas."
        confirmLabel="Cancelar viagem"
        request={{ method: "POST", url: `/viagens/${v.id}/cancelar` }}
        successMessage="Viagem cancelada"
      />
      <MotivoModal
        isOpen={modal === "excluir"}
        onClose={close}
        title="Excluir despesa?"
        description={despesaSel ? `${despesaSel.categoria || "Despesa"} — ${despesaSel.descricao}. O lançamento sai da viagem e dos gastos, mas o registro completo fica no histórico.` : null}
        confirmLabel="Excluir despesa"
        request={despesaSel ? { method: "DELETE", url: `/viagens/${v.id}/despesas/${despesaSel.id}` } : null}
        successMessage="Despesa excluída"
      />
    </PageLayout>
  );
}
