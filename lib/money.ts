// Conversão entre reais (como o banco guarda, numeric) e centavos (como
// lib/pricing.ts calcula, sempre inteiro) — e formatação pt-BR.

export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

export function centavosParaReais(centavos: number): number {
  return centavos / 100;
}

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarPercentual(fracao: number, casasDecimais = 1): string {
  return `${(fracao * 100).toFixed(casasDecimais)}%`;
}

/**
 * Faz o inverso do que o usuário vê na tela: "1.234,56" (separador de
 * milhar com ponto, decimal com vírgula) -> 1234.56. `.replace(",", ".")`
 * sozinho quebra em qualquer preço >= R$1.000 (vira "1.234.56", parseFloat
 * para no segundo ponto e devolve 1.234 — cem vezes menor que o real).
 */
export function parsePtBrNumero(valor: string): number {
  const limpo = valor.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}
