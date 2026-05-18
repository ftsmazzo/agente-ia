/** Formata inteiro de centavos/reais vindos da planilha (ex.: 165000 → R$ 165.000). */
export function formatBrlFromSheet(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
