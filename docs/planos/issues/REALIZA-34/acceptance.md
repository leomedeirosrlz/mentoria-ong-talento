# REALIZA-34 — acceptance.md (QA-executável)

## Unidade (Vitest)

1. `extrairTextoETabelas` lê CSV fixture → `tabelas` com rows corretas.
2. `normalizar` sobre texto do PDF real T1 (fixture transcrita) → ≥16 `encontro` numerados + etapas de preparação + recesso + encerramento, datas `YYYY-MM-DD` válidas.
3. Casos-edge: etapa "Concluída" sem data → `data:null` (válido pelo CHECK); recesso com período → `data`+`data_fim`; dia-da-semana variável (terça/quinta) → datas corretas; fase metodológica mapeada pra `FASES_DPP`.
4. `validaEventos` rejeita saída malformada (mesmo contrato de hoje).

## Action / API

5. `POST` action `importarCronogramaRascunho` como mentor/anon → `{error}` (coord-only).
6. Arquivo >10MB ou extensão fora da lista → `{error}` claro, nada no bucket.
7. Sem `GEMINI_API_KEY`: retorna rascunho determinístico + `avisos` contendo "normalização IA indisponível".
8. Com key e texto de alta confiança: Gemini **não** é chamado (economia) — verificar por log/mock.
9. Com key e texto não-estruturado: rascunho final contém campos marcados `origem='ia'`.

## E2E / demo

10. Demo: "Importar de um arquivo" aparece em `/turmas/novo`; upload simulado leva à revisão pré-preenchida; submit final retorna `DEMO_MSG`.
11. App staging: upload do CSV fixture → revisão → "Criar cronograma" → cronograma aparece em `/turmas` com status rascunho; eventos conferem com o arquivo.
12. **Nada é gravado antes do submit**: fazer upload, fechar a aba, conferir `cronogramas`/`ciclo_eventos` inalterados via REST.

## Edge cases

13. PDF escaneado sem texto selecionável → aviso "imagem/escaneado não suportado ainda" (até a 180 prover visão) + fallback manual visível.
14. Arquivo com zero blocos reconhecidos → builder abre com lista vazia + aviso, não quebra.
15. Dois blocos "recesso" → ambos entram como `recesso` (evento repetido é legítimo — a verificar regra; se único, o segundo vira aviso).

## Rollout

16. `GEMINI_API_KEY` em Vercel prod+preview antes do merge do PR 3; sem ela o deploy não quebra (degrada).
17. Remover a entrada "Importar" desativa o fluxo — zero resíduo (persistência só via `criarCronograma`).
