/**
 * Calcula KM rodados e % de vida útil restante do pneu.
 *
 * Convenção do sistema:
 * - `km_instalacao` = odômetro do **caminhão** no momento da instalação
 * - KM rodados no pneu = km_atual_caminhao − km_instalacao
 * - Para pneu novo, km_instalacao deve ser ≈ km atual do caminhão (restante ≈ 100%)
 *
 * @param {number|null|undefined} kmAtualCaminhao
 * @param {number|null|undefined} kmInstalacao
 * @param {number|null|undefined} vidaUtilKm
 */
export function calcularVidaUtilPneu(
  kmAtualCaminhao,
  kmInstalacao,
  vidaUtilKm,
) {
  const kmAtual =
    kmAtualCaminhao == null || kmAtualCaminhao === ""
      ? null
      : Number(kmAtualCaminhao);
  const kmInst =
    kmInstalacao == null || kmInstalacao === "" ? null : Number(kmInstalacao);
  const vida =
    vidaUtilKm == null || vidaUtilKm === "" ? null : Number(vidaUtilKm);

  if (
    kmAtual == null ||
    kmInst == null ||
    Number.isNaN(kmAtual) ||
    Number.isNaN(kmInst)
  ) {
    return {
      kmRodado: null,
      vidaUtilRestante: null,
      percentualVidaUtil: null,
    };
  }

  const kmRodado = Math.max(0, kmAtual - kmInst);

  if (vida == null || Number.isNaN(vida) || vida <= 0) {
    return {
      kmRodado,
      vidaUtilRestante: null,
      percentualVidaUtil: null,
    };
  }

  const vidaUtilRestante = vida - kmRodado;
  const percentualVidaUtil = Math.max(
    0,
    Math.min(100, (vidaUtilRestante / vida) * 100),
  );

  return {
    kmRodado,
    vidaUtilRestante,
    percentualVidaUtil,
  };
}
