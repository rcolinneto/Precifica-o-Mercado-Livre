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
