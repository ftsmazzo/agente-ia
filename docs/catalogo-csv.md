# Catálogo genérico (CSV)

O catálogo **não** usa layout fixo de imobiliária. Qualquer CSV com cabeçalho na primeira linha funciona.

## Fluxo

1. **Analisar** — lê o CSV, detecta colunas e tipos, mostra amostra.
2. **Confirmar** — você escolhe qual coluna é o código, título e status (opcional).
3. **Importar** — grava em `app.catalog_items` com todos os campos em JSON.

## Regras

- Delimitador: vírgula ou ponto-e-vírgula (detectado automaticamente).
- Código: coluna escolhida; se vazia, usa `LINHA-N`.
- Ativo: coluna de status opcional; valores como `inativo`, `vendido` desativam o item.
- Cada import **substitui** o catálogo inteiro (uma base por instalação).

## Env (startup opcional)

```env
CATALOG_CSV_PATH=/app/data/catalogo.csv
CATALOG_IMPORT_ON_START=true
```

## WhatsApp

- Mensagens com um **código** que existe no catálogo → ficha do item.
- Busca por bairro/quartos → procura em **qualquer coluna** do `search_text`.
