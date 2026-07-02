/** Objeto único em respostas { success, data }. */
export function extractApiData(res) {
  if (
    res?.data != null &&
    typeof res.data === "object" &&
    !Array.isArray(res.data)
  ) {
    return res.data;
  }
  return res;
}

/** Normaliza respostas da API (array direto ou { success, data }). */
export function extractApiArray(res) {
  if (Array.isArray(res)) return res;
  if (res?.data && Array.isArray(res.data)) return res.data;
  if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data;
  return [];
}
