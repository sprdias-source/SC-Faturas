// Faturas de cartão trazem linhas que são ajuste administrativo do próprio
// banco — não uma receita de verdade pra categorizar junto com o resto:
//   - "Pagamento ..." = débito em conta que quitou a fatura anterior
//   - "Crédito Anuidade ..." = devolução/isenção de anuidade dada pelo banco
// Tratamos as duas à parte: entram confirmadas, sem pedir conta/rateio.
const BANK_ADJUSTMENT_PATTERNS = [/^pagamento\b/i, /^cr[ée]dito\s+anuidade\b/i]

export function isBankAdjustmentDescription(description: string): boolean {
  const trimmed = description.trim()
  return BANK_ADJUSTMENT_PATTERNS.some((re) => re.test(trimmed))
}
