# REALIZA-180 — Pipeline de importação inteligente

**Jira:** [REALIZA-180](https://kelyng.atlassian.net/browse/REALIZA-180) ·
Tier A (doc set completo)

## Resumo

Evolui o importador de registros em 3 camadas **sobre o que já existe**:
**(1)** extração por visão (PDF/imagem → linhas no formato do CSV de hoje),
**(2)** match semântico por LLM nas linhas que o match determinístico marcou
`manual`, com confiança + razões, **(3)** revisão humana em linguagem
natural — a coordenadora digita "é a outra Nicolly, a do whatsapp 41 9xxxx"
e a IA traduz em ação tipada sobre a linha. **Escrita continua sendo só
pela RPC `importar_registros` existente** — IA nunca escreve no banco.

## Veredito de status

**BASE SÓLIDA ENTREGUE.** `src/lib/importar-registros.ts` (~1.5k linhas,
puro e testado — `tests/importar-registros.test.ts`) já faz: parse+canon de
header, normalização (datas/nomes/acentos), `scoreLinha` 0–100 com
`Evidencia[]` explicáveis, placeholders genéricos ("Mentorada") nunca
auto-matcheados, ano errado corrigido+flag `revisar`, `sem-par` detectado,
dedup. `previewImportRegistros`/`executarImportRegistros`
(`actions-importar-registros.ts`) são coord-only com gate demo e escrevem
só via RPC `importar_registros`. Dialog de revisão
(`importar-registros-dialog.tsx`) já tem seleção de dupla por linha,
`IGNORAR`, tags de confiança e preview de encontro (`novo`/`anexa`/
`atualiza`). O script CLI `scripts/importar-registros.mjs` reusa a lib com
`--resolve` manual.

**Não existe:** extração por visão, match semântico, interpretação de
correção em NL, canal `importacao` no `ia_eventos` (CHECK hoje só
`chat`/`mcp` — migration `0108_ia_canais.sql` da 178 carrega o superset),
nada de IA no pipeline.

## Escopo

1. **`extrairLinhasDeDocumento`** [NOVO] — input aceita `.pdf/.png/.jpg/
   .webp` além de `.csv`. Não-CSV → provider (visão, `provider.ts` da 179)
   com schema de saída = `LinhaRegCsv` + `confianca` por campo → alimenta
   o **mesmo** `processaLinhas` de hoje (determinístico roda sempre).
2. **`matchSemantico`** [NOVO] — depois do determinístico: linhas
   `nivel='manual'` ou `status='revisar'` vão ao LLM com
   `{mentorTxt, mentoradoTxt}` + top-5
   candidatos (só nomes + índice — nunca `dados_civis`). Resposta: índice
   escolhido **ou** nenhum + confiança + razão. Pode subir `manual`→
   `provavel`; **nunca** vira `auto` — humano sempre confirma sugestão
   semântica.
3. **`interpretarRevisao`** [NOVO] — texto livre da coord → tool-call com
   saída tipada `{acao: escolher_candidato|corrigir_numero|corrigir_data|
   ignorar|editar_campo|renumerar_lote|criar_dupla, alvo, valor}`.
   Aplica na linha e re-score. Casos reais do Jira: typo, "Mentorada"
   genérico, ano errado, **renumeração por narrativa** ("numera a partir
   do 3º encontro"), **par sem dupla** → ação `criar_dupla` propõe abrir o
   `NovaDuplaDialog`/`rematch` existentes — a criação em si passa pelo
   fluxo humano normal, não pela IA.
4. **Auditoria** — cada chamada LLM do lote grava `ia_eventos` com
   `canal='importacao'` [NOVO — superset da 0108], `tool` ∈
   `{extrair_visao, match_semantico, interpretar_revisao}`, `args` =
   `{lote, linha,…}` metadados (não o conteúdo do documento).
5. **UI** — `importar-registros-dialog.tsx` estendido (ou um
   `ImportarInteligenteDialog` irmão — decisão no plan): dropzone de
   arquivo, passo de extração, badge "sugerido por IA" + razão, caixa de
   correção NL por linha + instrução em lote, `sem-par` → botão "Criar
   dupla" (fluxo existente).

## Dependências / bloqueios

- **REALIZA-179** (`src/lib/ia/provider.ts` [NOVO] + rate-limit) — dep dura.
- **Migration `0108_ia_canais.sql`** (superset canal) — da 178; quem
  mergear primeiro carrega (idempotente, mesma convergência).
- **BLOCKER compartilhado**: provider DPA/zero-retention — aqui é mais
  sensível ainda: **o documento inteiro vai ao provider** (pode conter
  texto livre sobre menores). Ver sdr §2 — exigência absoluta antes de
  habilitar visão.

## Esforço

| Item | Est. | Risco |
|---|---|---|
| Visão → linhas (provider schema + dialog) | M | Médio — qualidade OCR do provider |
| Match semântico | M | Médio — calibrar confiança |
| NL review (interpretarRevisao) | M–G | Alto — casos de domínio |
| Auditoria/lote + UI | P | Baixo |

Total: **G** — fatiável: CSV-semântico primeiro, visão depois, NL por último.

## Riscos

- Visão erra campo silenciosamente → confiança por campo + flag `revisar`;
  nenhum campo de visão entra sem passar pela tabela de revisão humana.
- Match semântico "convence" errado → nunca `auto`; razão sempre visível;
  determinístico continua primeiro filtro.
- Custo/latência de lote grande → `MAX_IMPORT=500` já limita; visão cobra
  por página; cap de páginas (≤20) + rate-limit compartilhado da 179.
