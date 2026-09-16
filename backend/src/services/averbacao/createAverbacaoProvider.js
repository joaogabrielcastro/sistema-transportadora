import { AVERBACAO_PROVIDER } from "./averbacaoStatus.js";
import { AtmAverbacaoProvider } from "./providers/AtmAverbacaoProvider.js";

/**
 * Factory do provedor de averbação. Novos fornecedores entram aqui —
 * CteService / MdfeService não importam classes concretas.
 *
 * @param {string} provider
 * @param {import("./AverbacaoProvider.js").AverbacaoCredentials} credentials
 */
export function createAverbacaoProvider(provider, credentials) {
  const key = String(provider || "").trim().toLowerCase();
  if (key === AVERBACAO_PROVIDER.ATM) {
    return new AtmAverbacaoProvider(credentials);
  }
  const err = new Error(
    `Provedor de averbação "${provider}" não está implementado neste ambiente.`,
  );
  err.statusCode = 400;
  throw err;
}
