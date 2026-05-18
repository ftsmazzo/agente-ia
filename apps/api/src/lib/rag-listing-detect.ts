/** Indica se texto do RAG ou bloco injetado contém anúncios (códigos AP, etc.). */
export function textHasPropertyListings(text: string): boolean {
  return (
    /\bAP\d{4}\b/i.test(text) ||
    /Referência:\s*AP/i.test(text) ||
    /Valor da Venda/i.test(text)
  );
}
