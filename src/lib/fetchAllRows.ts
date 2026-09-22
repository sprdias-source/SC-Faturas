// O Supabase/PostgREST corta silenciosamente qualquer select em 1000 linhas
// por padrão — sem paginar, uma consulta que devolveria mais que isso perde
// as linhas excedentes sem erro nenhum. `fetchPage` recebe from/to e devolve
// uma query nova a cada chamada (o builder do supabase-js não pode ser
// reusado depois de um await).
export async function fetchAllRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const pageSize = 1000
  let offset = 0
  const all: T[] = []
  for (;;) {
    const { data, error } = await fetchPage(offset, offset + pageSize - 1)
    if (error) throw error
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < pageSize) break
    offset += batch.length
  }
  return all
}
