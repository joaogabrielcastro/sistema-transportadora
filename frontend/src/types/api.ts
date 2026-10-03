/** Tipos do contrato REST — alinhados com backend/src/types/api.ts */

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  pagination?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: string[] | Array<{ field?: string; message?: string }>;
  nota_id?: number;
  nota_numero?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface ApiFetchConfig {
  method?: string;
  url: string;
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: "json" | "blob" | "arraybuffer" | "text";
  skipSuccessToast?: boolean;
  skipErrorToast?: boolean;
  skipLoading?: boolean;
}

export interface ParsedApiError extends Error {
  status: number | null;
  fieldErrors: Record<string, string> | null;
  notaId: number | null;
  notaNumero: string | null;
}

export interface UseApiMutationOptions {
  onSuccess?: (data: ApiSuccessResponse, variables: ApiFetchConfig) => void;
  onError?: (err: ParsedApiError, variables: ApiFetchConfig) => void;
}
