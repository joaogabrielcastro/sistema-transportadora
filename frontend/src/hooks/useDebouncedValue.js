import { useEffect, useState } from "react";

/** Atrasa atualização de um valor (útil para filtros de busca). */
export function useDebouncedValue(value, delayMs = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timerId = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timerId);
  }, [value, delayMs]);

  return debounced;
}
