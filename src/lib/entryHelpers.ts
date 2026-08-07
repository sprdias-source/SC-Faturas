// Faturas de cartão trazem uma linha "Pagamento ..." = o débito em conta que
// quitou a fatura anterior. Não é uma receita/crédito pra categorizar junto
// com o resto — é só a baixa do que já era devido, então tratamos à parte.
export function isInvoicePaymentDescription(description: string): boolean {
  return /^pagamento\b/i.test(description.trim())
}
