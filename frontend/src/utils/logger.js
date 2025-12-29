/**
 * Logger utility para gerenciar logs em diferentes ambientes
 */

const isDevelopment = import.meta.env.DEV;

const logger = {
  /**
   * Log de informações gerais
   */
  info: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log de avisos
   */
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Log de erros
   */
  error: (...args) => {
    if (isDevelopment) {
      console.error(...args);
    } else {
      // Em produção, enviar para serviço de monitoramento
      // Exemplo: Sentry.captureException(args[0]);
    }
  },

  /**
   * Log de debug (apenas em desenvolvimento)
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Log de tabelas (apenas em desenvolvimento)
   */
  table: (...args) => {
    if (isDevelopment) {
      console.table(...args);
    }
  },
};

export default logger;
