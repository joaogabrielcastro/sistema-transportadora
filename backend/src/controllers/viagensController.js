import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";
import { ViagemService } from "../services/viagens/ViagemService.js";
import {
  cancelViagemSchema,
  createViagemSchema,
  deleteDespesaSchema,
  despesaSchema,
  finishViagemSchema,
  listViagensQuerySchema,
  resumoViagensQuerySchema,
  startViagemSchema,
  updateDespesaSchema,
  updateViagemSchema,
} from "../schemas/viagemSchema.js";

const actor = (req) => req.context?.user || {};
const id = (req) => Number(req.params.id);

/** Multipart manda campos como texto e o campo do arquivo; só os do schema seguem. */
const despesaBody = (req) => {
  const b = { ...(req.body || {}) };
  delete b.comprovante;
  return b;
};

export const viagensController = {
  list: catchAsync(async (req, res) => {
    const q = listViagensQuerySchema.parse(req.query);
    const data = await ViagemService.list(requireTenantId(req), actor(req), q);
    res.json({ success: true, data });
  }),

  resumo: catchAsync(async (req, res) => {
    const q = resumoViagensQuerySchema.parse(req.query);
    res.json({ success: true, data: await ViagemService.resumo(requireTenantId(req), actor(req), q) });
  }),

  relatorio: catchAsync(async (req, res) => {
    const q = resumoViagensQuerySchema.parse(req.query);
    res.json({ success: true, data: await ViagemService.relatorio(requireTenantId(req), actor(req), q) });
  }),

  get: catchAsync(async (req, res) => {
    res.json({ success: true, data: await ViagemService.get(requireTenantId(req), actor(req), id(req)) });
  }),

  create: catchAsync(async (req, res) => {
    const body = createViagemSchema.parse(req.body);
    const data = await ViagemService.create(requireTenantId(req), actor(req), body);
    res.status(201).json({
      success: true,
      data,
      message: data.status === "em_andamento" ? `Viagem nº ${data.numero} iniciada` : `Viagem nº ${data.numero} planejada`,
    });
  }),

  start: catchAsync(async (req, res) => {
    const body = startViagemSchema.parse(req.body || {});
    const data = await ViagemService.start(requireTenantId(req), actor(req), id(req), body);
    res.json({ success: true, data, message: `Viagem nº ${data.numero} iniciada` });
  }),

  finish: catchAsync(async (req, res) => {
    const body = finishViagemSchema.parse(req.body);
    const data = await ViagemService.finish(requireTenantId(req), actor(req), id(req), body);
    res.json({ success: true, data, message: `Viagem nº ${data.numero} finalizada` });
  }),

  update: catchAsync(async (req, res) => {
    const body = updateViagemSchema.parse(req.body);
    const data = await ViagemService.update(requireTenantId(req), actor(req), id(req), body);
    res.json({ success: true, data, message: "Viagem atualizada" });
  }),

  cancel: catchAsync(async (req, res) => {
    const body = cancelViagemSchema.parse(req.body);
    const data = await ViagemService.cancel(requireTenantId(req), actor(req), id(req), body);
    res.json({ success: true, data, message: `Viagem nº ${data.numero} cancelada` });
  }),

  historico: catchAsync(async (req, res) => {
    res.json({ success: true, data: await ViagemService.historico(requireTenantId(req), actor(req), id(req)) });
  }),

  listDespesas: catchAsync(async (req, res) => {
    res.json({ success: true, data: await ViagemService.listDespesas(requireTenantId(req), actor(req), id(req)) });
  }),

  createDespesa: catchAsync(async (req, res) => {
    const body = despesaSchema.parse(despesaBody(req));
    const data = await ViagemService.createDespesa(requireTenantId(req), actor(req), id(req), body, req.file);
    res.status(201).json({ success: true, data, message: "Despesa registrada" });
  }),

  updateDespesa: catchAsync(async (req, res) => {
    const body = updateDespesaSchema.parse(despesaBody(req));
    const data = await ViagemService.updateDespesa(
      requireTenantId(req),
      actor(req),
      id(req),
      Number(req.params.despesaId),
      body,
      req.file,
    );
    res.json({ success: true, data, message: "Despesa atualizada" });
  }),

  deleteDespesa: catchAsync(async (req, res) => {
    const body = deleteDespesaSchema.parse(req.body || {});
    await ViagemService.deleteDespesa(requireTenantId(req), actor(req), id(req), Number(req.params.despesaId), body);
    res.json({ success: true, message: "Despesa excluída. O registro fica no histórico da viagem." });
  }),

  comprovante: catchAsync(async (req, res) => {
    const { stream, nome, mime } = await ViagemService.comprovante(
      requireTenantId(req),
      id(req),
      Number(req.params.despesaId),
    );
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(nome)}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    stream.on("error", (err) => res.destroy(err));
    stream.pipe(res);
  }),
};
