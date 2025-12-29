import { useState, useCallback } from "react";

/**
 * Hook para validação de formulários em tempo real
 * @param {Object} initialValues - Valores iniciais do formulário
 * @param {Function} validate - Função de validação que retorna objeto com erros
 * @returns {Object} - Objeto com valores, erros, handlers e métodos de controle
 */
export const useFormValidation = (initialValues, validate) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    
    setValues((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // Validar campo se já foi tocado
    if (touched[name]) {
      const fieldErrors = validate({ ...values, [name]: newValue });
      setErrors((prev) => ({
        ...prev,
        [name]: fieldErrors[name],
      }));
    }
  }, [values, touched, validate]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));

    // Validar campo ao perder foco
    const fieldErrors = validate(values);
    setErrors((prev) => ({
      ...prev,
      [name]: fieldErrors[name],
    }));
  }, [values, validate]);

  const handleSubmit = useCallback((onSubmit) => {
    return async (e) => {
      e.preventDefault();
      setIsSubmitting(true);

      // Marcar todos os campos como tocados
      const allTouched = Object.keys(values).reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {});
      setTouched(allTouched);

      // Validar todos os campos
      const validationErrors = validate(values);
      setErrors(validationErrors);

      // Se não houver erros, enviar
      if (Object.keys(validationErrors).length === 0) {
        try {
          await onSubmit(values);
        } catch (error) {
          console.error("Form submission error:", error);
        }
      }

      setIsSubmitting(false);
    };
  }, [values, validate]);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const setFieldValue = useCallback((name, value) => {
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const setFieldError = useCallback((name, error) => {
    setErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  }, []);

  const getFieldProps = useCallback((name) => ({
    name,
    value: values[name] || "",
    onChange: handleChange,
    onBlur: handleBlur,
  }), [values, handleChange, handleBlur]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldError,
    getFieldProps,
    isValid: Object.keys(errors).length === 0,
  };
};

/**
 * Componente para exibir erro de campo
 */
export const FieldError = ({ error, touched, className = "" }) => {
  if (!error || !touched) return null;

  return (
    <p className={`text-red-600 text-sm mt-1 animate-shake ${className}`}>
      {error}
    </p>
  );
};

/**
 * Validadores comuns
 */
export const validators = {
  required: (value) => {
    if (!value || (typeof value === "string" && !value.trim())) {
      return "Campo obrigatório";
    }
    return null;
  },

  email: (value) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "E-mail inválido";
    }
    return null;
  },

  minLength: (min) => (value) => {
    if (value && value.length < min) {
      return `Mínimo de ${min} caracteres`;
    }
    return null;
  },

  maxLength: (max) => (value) => {
    if (value && value.length > max) {
      return `Máximo de ${max} caracteres`;
    }
    return null;
  },

  number: (value) => {
    if (value && isNaN(Number(value))) {
      return "Deve ser um número";
    }
    return null;
  },

  positive: (value) => {
    if (value && Number(value) <= 0) {
      return "Deve ser um número positivo";
    }
    return null;
  },

  placa: (value) => {
    if (value && !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(value)) {
      return "Formato de placa inválido (ex: ABC1D23)";
    }
    return null;
  },
};

/**
 * Combinar validadores
 */
export const composeValidators = (...validators) => (value) => {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
};

export default useFormValidation;
