# REALIZA-49 — Grade tipo planilha nas respostas de formulários/intake

[Jira REALIZA-49](https://realizavc.atlassian.net/browse/REALIZA-49)

**Status: ABERTO** — a leitura atual de respostas é por pergunta (agregado)
+ accordions por respondente (`respostas-section.tsx`) e existe export
CSV. Falta a **grade respondente × campo** (o "Planilhas" do GForms) com
alternância grade ↔ cards.

## Já existe (reusar, não confundir)

- `src/components/relatorio-canvas.tsx` — grade estilo planilha de
  **relatório**: colunas configuráveis/redimensionáveis, cópia TSV,
  animação de coluna entrando/saindo. **Não é** a grade de respostas
  pedida — mas é o componente a adaptar/reusar.
- `src/app/(app)/formularios/respostas-section.tsx` — resumo por pergunta
  com barras/`{n}·{pct}%`, accordions por respondente (ordem
  `respondido_em` desc), cobertura de todos os tipos no resumo.
- `/api/export?tipo=respostas` — CSV coord-only (BOM/`;`/anti-fórmula,
  coluna por campo, órfãs no fim). A grade é a versão **em tela** disso.
- `formulario_respostas` + `formulario_links` (0036): cada resposta já
  carrega destinatário/contexto — a linha da grade sabe quem respondeu.

## Escopo

1. Toggle "Grade | Resumo" na seção Respostas da ficha do formulário
   (âncora `#sec-respostas` já existe).
2. Grade: **linha = respondente** (link/resposta), **coluna = campo**
   (pergunta), + colunas fixas de meta (Quem, Quando).
3. Mobile: cards continuam — a grade entra em scroll horizontal ou cai
   pro modo cards abaixo de breakpoint (decisão no design).
4. Somente coordenação (a rota `/formularios` já é coord-only).

## Dependências

- **Após REALIZA-36** — a grade precisa renderizar `arquivo`,
  `grid_disponibilidade`, "Outro", campos `visible_if` ocultos.
- Relacionada: REALIZA-69/70 (intake gera o volume que justifica a
  grade).

## Esforço estimado: **M**

Grade é adaptação de componente existente + serializadores por tipo +
toggle. Sem schema/RPC novos (query `React.cache` apenas).

## Riscos

- Células com valor longo (`texto_longo`, "Outro") — truncate+expande.
- Forms com muitos campos: scroll horizontal + coluna sticky do
  respondente.
- Dados de menores na grade: mesma régua coord-only — sdr curto.

## Documentos

`plan.md` · `design.md` · `sdr.md` · `acceptance.md` · `sdd.md` (leve —
query serializadora).
