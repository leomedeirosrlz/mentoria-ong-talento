# REALIZA-54 — Arquivos da dupla: anexos + PDM + estado vazio

**Jira:** REALIZA-54 · **Tier:** B · **Status:** parcial — anexos de
registro já agregam; falta PDM + empty state

## Contexto

A seção "Arquivos" da ficha da dupla (`src/components/arquivos-dupla.tsx:5-53`)
lista hoje **só** `registro_anexos` (evidências de encontro), achatados em
`duplas/[id]/page.tsx:403-412` com metadado de número do encontro. Dois
buracos confirmados:

1. **PDM não aparece.** `duplas.pdm_url` foi **removida** em
   `supabase/migrations/0098_remove_pdm_url.sql` — não existe mais link de
   PDM na dupla. Hoje o PDM vive como **instrumento** (`sistema='pdm'`)
   entregue via `formulario_links` e respondido em `formulario_respostas`
   — o card "Instrumentos" (`duplas/[id]/instrumentos-dupla.tsx`) mostra
   status e abre `InstrumentoResultado`, mas a seção Arquivos não menciona.
2. **Sem arquivos → a seção some** (`arquivos-dupla.tsx:14-15` retorna
   `null`). O gestor não distingue "sem arquivos ainda" de "seção não
   carregou".

## Dependência leve: REALIZA-181 (PDM nativo)

REALIZA-181 propõe PDM nativo (`pdm_metas`/`pdm_submetas` — tabelas
**[NOVO]**, não existem hoje). Se/quando sair, a "fonte do PDM" muda. Este
plano cobre as duas opções de forma intercambiável — o componente recebe
uma lista normalizada `ArquivoDaDupla`, então **trocar a fonte do item
PDM é local**: basta trocar o item que o page monta.

| Opção | Fonte do "arquivo PDM" | Quando |
|---|---|---|
| **A — instrumento (interino, recomendada agora)** | `getInstrumentosDaDupla` → entrega `sistema='pdm'` respondida → item "PDM — Plano de Desenvolvimento Mútuo" que abre o `InstrumentoResultado` (mesmo dialog do card Instrumentos) ou ancora nele | Implementável **já**, sem migration |
| **B — nativo (REALIZA-181)** | documento PDM nativo (view/print da `pdm_*` — a definir lá, provável rota `/duplas/[id]/pdm` ou export) | Quando 181 aterrissar: substituir o item A mantendo a mesma shape |

**Não inventar** tabela/coluna de anexo de PDM nesta issue — a fonte é a
opção A agora, B depois; ambas entram como `kind: 'pdm'` no array.

## Proposta

1. **`ArquivoDaDupla` vira union discriminada** [NOVO-shape]:
   `{kind:'anexo', anexo: RegistroAnexo, encontroNumero}` (comportamento
   atual, download via `/api/anexo/[id]` — privado, signed URL 300s,
   convenção de `ops-mapa.md`) | `{kind:'pdm', titulo, subtitulo,
   respondido_em, resposta_id}` (abre leitura, sem download de storage).
2. **Empty state real**: quando `arquivos.length===0`, renderizar bloco
   discreto: "Nenhum arquivo ainda — evidências enviadas nos registros e o
   PDM respondido aparecem aqui." (ícone `FileDashed`/`FolderOpen`,
   padrão dos empty states do codebase — ver `pessoas-listas.tsx:579`).
3. **Proveniência clara**: item anexo mantém "Encontro N · data"; item PDM
   mostra "PDM · respondido em dd/mm/aaaa" (ou "última resposta" se >1).
4. Page: montar o item PDM a partir de `instrumentos` (já carregados na
   página — `page.tsx:231-252`, sem query nova) e concatenar antes de
   `<ArquivosDupla>` (`:1051`).

## Sem mudança de segurança

Nenhuma rota/storage/policy nova: anexos seguem `/api/anexo/[id]`; PDM é
dado já carregado pela RPC `instrumentos_da_dupla` (escopo dela — coord,
mentor da dupla, supervisor, mentorado conforme 0080). Como a seção usa o
mesmo dado do card Instrumentos, a audiência do item PDM = a mesma do
card — **não alarga exposição**. (Se `InstrumentoResultado` for coord+
mentor e a seção Arquivos aparecer pro mentorado, esconder o item PDM
pra `mentorado` — conferir audiência real no código ao implementar.)

## Esforço

**S** — tipagem da union, 1 item extra no page, empty state, testes.
