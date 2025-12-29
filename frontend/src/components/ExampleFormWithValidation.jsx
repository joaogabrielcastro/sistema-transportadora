import React from "react";
import { useFormValidation, FieldError, validators, composeValidators } from "../hooks/useFormValidation.jsx";
import { Button, Input, Label } from "./ui";

/**
 * Exemplo de como usar o hook useFormValidation em um formulário
 * Este arquivo serve como referência e pode ser adaptado para seus formulários
 */

// Função de validação do formulário
const validateForm = (values) => {
  const errors = {};

  // Exemplo com validadores compostos
  const placaError = composeValidators(
    validators.required,
    validators.placa
  )(values.placa);
  if (placaError) errors.placa = placaError;

  const modeloError = composeValidators(
    validators.required,
    validators.minLength(2),
    validators.maxLength(50)
  )(values.modelo);
  if (modeloError) errors.modelo = modeloError;

  const anoError = composeValidators(
    validators.required,
    validators.number,
    (value) => {
      const year = Number(value);
      if (year < 1900 || year > new Date().getFullYear() + 1) {
        return "Ano inválido";
      }
      return null;
    }
  )(values.ano);
  if (anoError) errors.ano = anoError;

  const kmError = composeValidators(
    validators.required,
    validators.number,
    validators.positive
  )(values.km);
  if (kmError) errors.km = kmError;

  return errors;
};

const ExampleFormWithValidation = ({ onSubmit }) => {
  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleSubmit,
    getFieldProps,
  } = useFormValidation(
    {
      placa: "",
      modelo: "",
      ano: "",
      km: "",
    },
    validateForm
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <Label htmlFor="placa">Placa*</Label>
        <Input
          {...getFieldProps("placa")}
          id="placa"
          placeholder="ABC1D23"
          className={errors.placa && touched.placa ? "border-red-500" : ""}
        />
        <FieldError error={errors.placa} touched={touched.placa} />
      </div>

      <div>
        <Label htmlFor="modelo">Modelo*</Label>
        <Input
          {...getFieldProps("modelo")}
          id="modelo"
          placeholder="Volvo FH 540"
          className={errors.modelo && touched.modelo ? "border-red-500" : ""}
        />
        <FieldError error={errors.modelo} touched={touched.modelo} />
      </div>

      <div>
        <Label htmlFor="ano">Ano*</Label>
        <Input
          {...getFieldProps("ano")}
          id="ano"
          type="number"
          placeholder="2023"
          className={errors.ano && touched.ano ? "border-red-500" : ""}
        />
        <FieldError error={errors.ano} touched={touched.ano} />
      </div>

      <div>
        <Label htmlFor="km">Quilometragem*</Label>
        <Input
          {...getFieldProps("km")}
          id="km"
          type="number"
          placeholder="150000"
          className={errors.km && touched.km ? "border-red-500" : ""}
        />
        <FieldError error={errors.km} touched={touched.km} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
};

export default ExampleFormWithValidation;
