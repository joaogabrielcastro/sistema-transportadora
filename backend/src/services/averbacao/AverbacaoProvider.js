/**
 * Contrato de provedor de averbação.
 * O restante do ATrack depende só desta interface — nunca de AT&M/NDD/etc.
 *
 * @typedef {object} AverbacaoCredentials
 * @property {string} usuario
 * @property {string} senha
 * @property {string} [codigoAtm]
 * @property {'homologacao'|'producao'} ambiente
 *
 * @typedef {object} AverbacaoEnvio
 * @property {string} xml XML protocolado na SEFAZ
 * @property {'cte'|'mdfe'} tipoDocumento
 *
 * @typedef {object} AverbacaoProviderResult
 * @property {number|null} httpStatus
 * @property {object|null} response JSON do provedor (já parseado)
 * @property {boolean} timeout
 * @property {boolean} network
 * @property {string|null} rawBody
 */

export class AverbacaoProvider {
  /**
   * @param {AverbacaoCredentials} credentials
   */
  constructor(credentials) {
    if (new.target === AverbacaoProvider) {
      throw new Error("AverbacaoProvider é abstrato — use um provedor concreto.");
    }
    this.credentials = credentials;
  }

  /** @returns {Promise<{ ok: boolean, message?: string }>} */
  autenticar() {
    throw new Error("autenticar() não implementado");
  }

  /** @param {AverbacaoEnvio} _envio @returns {Promise<AverbacaoProviderResult>} */
  averbar(_envio) {
    throw new Error("averbar() não implementado");
  }

  /**
   * A AT&M REST v1.1 não documenta um endpoint de consulta.
   * Provedores que só são idempotentes no POST devem reenviar o XML.
   * @param {AverbacaoEnvio} _envio
   * @returns {Promise<AverbacaoProviderResult>}
   */
  consultar(_envio) {
    throw new Error("consultar() não implementado");
  }

  /** @param {AverbacaoEnvio} _envio @returns {Promise<AverbacaoProviderResult>} */
  cancelar(_envio) {
    throw new Error("cancelar() não implementado");
  }

  /** @returns {Promise<{ ok: boolean, message?: string }>} */
  testarConexao() {
    return this.autenticar();
  }
}
