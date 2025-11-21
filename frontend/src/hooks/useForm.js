// frontend/src/hooks/useForm.js
import { useState, useCallback } from "react";

export const useForm = (initialValues = {}, validationRules = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Função de validação
  const validateField = useCallback(
    (name, value) => {
      const rules = validationRules[name];
      if (!rules) return "";

      // Required validation
      if (rules.required && (!value || value.toString().trim() === "")) {
        return rules.requiredMessage || `${name} é obrigatório`;
      }

      // Min length validation
      if (rules.minLength && value && value.length < rules.minLength) {
        return (
          rules.minLengthMessage ||
          `${name} deve ter pelo menos ${rules.minLength} caracteres`
        );
      }

      // Max length validation
      if (rules.maxLength && value && value.length > rules.maxLength) {
        return (
          rules.maxLengthMessage ||
          `${name} deve ter no máximo ${rules.maxLength} caracteres`
        );
      }

      // Pattern validation
      if (rules.pattern && value && !rules.pattern.test(value)) {
        return rules.patternMessage || `${name} tem formato inválido`;
      }

      // Custom validation
      if (rules.validate && typeof rules.validate === "function") {
        return rules.validate(value, values) || "";
      }

      return "";
    },
    [validationRules, values]
  );

  // Validar todos os campos
  const validateAll = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach((name) => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validateField, validationRules]);

  // Atualizar valor de campo
  const setValue = useCallback(
    (name, value) => {
      setValues((prev) => ({ ...prev, [name]: value }));

      // Validar campo se já foi tocado
      if (touched[name]) {
        const error = validateField(name, value);
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [touched, validateField]
  );

  // Handler para mudanças de input
  const handleChange = useCallback(
    (e) => {
      const { name, value, type, checked } = e.target;
      const newValue = type === "checkbox" ? checked : value;
      setValue(name, newValue);
    },
    [setValue]
  );

  // Handler para blur (quando campo perde foco)
  const handleBlur = useCallback(
    (e) => {
      const { name } = e.target;
      setTouched((prev) => ({ ...prev, [name]: true }));

      const error = validateField(name, values[name]);
      setErrors((prev) => ({ ...prev, [name]: error }));
    },
    [values, validateField]
  );

  // Reset do formulário
  const reset = useCallback(
    (newValues = initialValues) => {
      setValues(newValues);
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
    },
    [initialValues]
  );

  // Submit do formulário
  const handleSubmit = useCallback(
    async (onSubmit) => {
      if (isSubmitting) return;

      // Marcar todos os campos como tocados
      const allTouched = Object.keys(validationRules).reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {});
      setTouched(allTouched);

      // Validar todos os campos
      const isValid = validateAll();

      if (!isValid) return;

      setIsSubmitting(true);

      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, isSubmitting, validationRules, validateAll]
  );

  // Setar múltiplos valores
  const setMultipleValues = useCallback((newValues) => {
    setValues((prev) => ({ ...prev, ...newValues }));
  }, []);

  // Verificar se formulário é válido
  const isValid =
    Object.keys(errors).length === 0 &&
    Object.keys(validationRules).every(
      (key) =>
        !validationRules[key].required ||
        (values[key] && values[key].toString().trim() !== "")
    );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    setValue,
    setMultipleValues,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    validateField,
    validateAll,
  };
};
