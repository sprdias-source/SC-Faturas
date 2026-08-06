/** Erros do Supabase (Postgrest/Auth) não são instâncias de Error nativo,
 *  então `err instanceof Error` falha silenciosamente pra eles. Isso pega a
 *  mensagem de qualquer formato razoável. */
export function getErrorMessage(err: unknown, fallback = 'Não deu certo, tenta de novo.'): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return fallback
}
