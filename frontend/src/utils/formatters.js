// frontend/src/utils/formatters.js

/**
 * Formatar data no padrão brasileiro
 */
export const formatDate = (date, options = {}) => {
  if (!date) return "";

  const dateObj = typeof date === "string" ? new Date(date) : date;

  const defaultOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  };

  return dateObj.toLocaleDateString("pt-BR", { ...defaultOptions, ...options });
};

/**
 * Formatar data e hora no padrão brasileiro
 */
export const formatDateTime = (date) => {
  return formatDate(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Formatar moeda brasileira
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return "R$ 0,00";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

/**
 * Formatar número com separadores de milhares
 */
export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || isNaN(value)) return "0";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Formatar placa de veículo
 */
export const formatPlaca = (placa) => {
  if (!placa) return "";

  // Remove caracteres não alfanuméricos
  const clean = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  // Formato antigo (ABC-1234) ou Mercosul (ABC1D23)
  if (clean.length >= 7) {
    const letters = clean.substring(0, 3);
    const numbers = clean.substring(3);

    // Verifica se é formato Mercosul (letra na 5ª posição)
    if (numbers.length >= 4 && /[A-Z]/.test(numbers.charAt(1))) {
      return `${letters}${numbers.charAt(0)}${numbers.charAt(
        1
      )}${numbers.substring(2, 4)}`;
    } else {
      // Formato antigo
      return `${letters}-${numbers.substring(0, 4)}`;
    }
  }

  return clean;
};

/**
 * Formatar CPF
 */
export const formatCPF = (cpf) => {
  if (!cpf) return "";

  const numbers = cpf.replace(/\D/g, "");

  if (numbers.length <= 11) {
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  return cpf;
};

/**
 * Formatar CNPJ
 */
export const formatCNPJ = (cnpj) => {
  if (!cnpj) return "";

  const numbers = cnpj.replace(/\D/g, "");

  if (numbers.length <= 14) {
    return numbers.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }

  return cnpj;
};

/**
 * Formatar telefone
 */
export const formatPhone = (phone) => {
  if (!phone) return "";

  const numbers = phone.replace(/\D/g, "");

  if (numbers.length === 10) {
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  } else if (numbers.length === 11) {
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  return phone;
};

/**
 * Formatar quilometragem
 */
export const formatKm = (km) => {
  if (km === null || km === undefined || isNaN(km)) return "0 km";
  return `${formatNumber(km)} km`;
};

/**
 * Formatar litros
 */
export const formatLiters = (liters) => {
  if (liters === null || liters === undefined || isNaN(liters)) return "0 L";
  return `${formatNumber(liters, 2)} L`;
};

/**
 * Capitalizar primeira letra de cada palavra
 */
export const capitalizeWords = (text) => {
  if (!text) return "";

  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Truncar texto com reticências
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;

  return text.substring(0, maxLength).trim() + "...";
};

/**
 * Formatar tamanho de arquivo
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
