// frontend/src/utils/validators.js

/**
 * Validar se campo é obrigatório
 */
export const required = (value, message = "Campo obrigatório") => {
  if (!value || value.toString().trim() === "") {
    return message;
  }
  return "";
};

/**
 * Validar comprimento mínimo
 */
export const minLength = (min, message) => (value) => {
  if (value && value.length < min) {
    return message || `Deve ter pelo menos ${min} caracteres`;
  }
  return "";
};

/**
 * Validar comprimento máximo
 */
export const maxLength = (max, message) => (value) => {
  if (value && value.length > max) {
    return message || `Deve ter no máximo ${max} caracteres`;
  }
  return "";
};

/**
 * Validar email
 */
export const email = (value, message = "Email inválido") => {
  if (!value) return "";

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return message;
  }
  return "";
};

/**
 * Validar CPF
 */
export const cpf = (value, message = "CPF inválido") => {
  if (!value) return "";

  const numbers = value.replace(/\D/g, "");

  if (numbers.length !== 11) {
    return message;
  }

  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(numbers)) {
    return message;
  }

  // Validar dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers.charAt(i)) * (10 - i);
  }

  let remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers.charAt(9))) return message;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers.charAt(i)) * (11 - i);
  }

  remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers.charAt(10))) return message;

  return "";
};

/**
 * Validar CNPJ
 */
export const cnpj = (value, message = "CNPJ inválido") => {
  if (!value) return "";

  const numbers = value.replace(/\D/g, "");

  if (numbers.length !== 14) {
    return message;
  }

  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(numbers)) {
    return message;
  }

  // Validar primeiro dígito verificador
  let sum = 0;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  for (let i = 0; i < 12; i++) {
    sum += parseInt(numbers.charAt(i)) * weights1[i];
  }

  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;

  if (digit1 !== parseInt(numbers.charAt(12))) return message;

  // Validar segundo dígito verificador
  sum = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  for (let i = 0; i < 13; i++) {
    sum += parseInt(numbers.charAt(i)) * weights2[i];
  }

  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;

  if (digit2 !== parseInt(numbers.charAt(13))) return message;

  return "";
};

/**
 * Validar placa de veículo
 */
export const placa = (value, message = "Placa inválida") => {
  if (!value) return "";

  const clean = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  // Formato antigo: ABC1234
  const oldFormat = /^[A-Z]{3}[0-9]{4}$/;

  // Formato Mercosul: ABC1D23
  const mercosulFormat = /^[A-Z]{3}[0-9]{1}[A-Z]{1}[0-9]{2}$/;

  if (!oldFormat.test(clean) && !mercosulFormat.test(clean)) {
    return message;
  }

  return "";
};

/**
 * Validar telefone
 */
export const phone = (value, message = "Telefone inválido") => {
  if (!value) return "";

  const numbers = value.replace(/\D/g, "");

  if (numbers.length < 10 || numbers.length > 11) {
    return message;
  }

  return "";
};

/**
 * Validar número positivo
 */
export const positiveNumber = (
  value,
  message = "Deve ser um número positivo"
) => {
  if (value !== "" && value !== null && value !== undefined) {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      return message;
    }
  }
  return "";
};

/**
 * Validar número inteiro
 */
export const integer = (value, message = "Deve ser um número inteiro") => {
  if (value !== "" && value !== null && value !== undefined) {
    const num = parseFloat(value);
    if (isNaN(num) || !Number.isInteger(num)) {
      return message;
    }
  }
  return "";
};

/**
 * Validar intervalo de números
 */
export const numberRange = (min, max, message) => (value) => {
  if (value !== "" && value !== null && value !== undefined) {
    const num = parseFloat(value);
    if (isNaN(num) || num < min || num > max) {
      return message || `Deve estar entre ${min} e ${max}`;
    }
  }
  return "";
};

/**
 * Validar data
 */
export const date = (value, message = "Data inválida") => {
  if (!value) return "";

  const dateObj = new Date(value);
  if (isNaN(dateObj.getTime())) {
    return message;
  }

  return "";
};

/**
 * Validar se data é futura
 */
export const futureDate = (value, message = "Data deve ser futura") => {
  if (!value) return "";

  const dateObj = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dateObj <= today) {
    return message;
  }

  return "";
};

/**
 * Validar se data é passada
 */
export const pastDate = (value, message = "Data deve ser passada") => {
  if (!value) return "";

  const dateObj = new Date(value);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (dateObj > today) {
    return message;
  }

  return "";
};

/**
 * Validador personalizado para combinar múltiplas validações
 */
export const combine =
  (...validators) =>
  (value) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return "";
  };
