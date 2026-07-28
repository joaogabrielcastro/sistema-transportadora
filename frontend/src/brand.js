/**
 * Marca do produto (SaaS) — independente da empresa/tenant logada.
 */
export const PRODUCT_NAME = "ATrack";
export const PRODUCT_TAGLINE = "Gestão de Frotas";
export const PRODUCT_LOGO_SRC = "/images/logo.png";
export const PRODUCT_LOGO_ALT = "ATrack — gestão de frotas";

/** Cadastro público de empresas (alinhar com ALLOW_PUBLIC_REGISTER no backend). */
export const PUBLIC_REGISTER_ENABLED =
  import.meta.env.VITE_ALLOW_PUBLIC_REGISTER !== "false";
