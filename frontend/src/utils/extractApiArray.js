/** Normaliza respostas da API (array direto ou { success, data }). */
export function extractApiArray(res) {
  if (Array.isArray(res)) return res;
  if (res?.data && Array.isArray(res.data)) return res.data;
  if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data;
  return [];
}
