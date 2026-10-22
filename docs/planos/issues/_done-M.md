# Cluster M — planejamento concluído

Cluster M do `_clusters.md`: pessoas, matching e gestão de pares.
Planejado em cima do código atual (schema até `0105_review_fixes.sql`).

## Entregas

### FEITO — READMEs de evidência (veredito, sem replanejamento)

| Issue | Título | Veredito | Arquivo |
|---|---|---|---|
| REALIZA-38 | Perfil canônico rico + dados civis | FEITO | `REALIZA-38/README.md` |
| REALIZA-99 | Coordenação aceita como `supervisor_id` | FEITO | `REALIZA-99/README.md` |
| REALIZA-100 | Remanejamento atômico de dupla | FEITO | `REALIZA-100/README.md` |
| REALIZA-101 | Fila de espera derivada | FEITO | `REALIZA-101/README.md` |
| REALIZA-102 | Import CSV de pareamento | FEITO | `REALIZA-102/README.md` |

### ABERTO — planos completos

| Issue | Título | Tier | Docs | Esforço |
|---|---|---|---|---|
| REALIZA-98 | `duplas.dupla_dpp_id` self-FK | A | README, plan, sdd, design, sdr, acceptance | M |
| REALIZA-159 | Promoção ex-mentorado → mentor | A | README, plan, sdd, design, sdr, acceptance | M |
| REALIZA-37 | ViaCEP no endereço de dados civis | B | README, plan, design, sdr, acceptance | S-M |
| REALIZA-54 | Arquivos da dupla: PDM + empty state | B | README, plan, design, acceptance | S |

## Decisões tomadas pelo planejador

- **98: adotar a coluna.** Ganho real = linhagem sobrevive ao rematch
  (hoje `rematch_dupla` perde o vínculo DPP→esp) + query direta; a
  solicitação segue como proveniência do pedido. Migration **`0106`** —
  o `0063` do texto Jira já é `0063_dupla_remanejada_de.sql`.
- **159: mesmo profile, nunca profile novo.** `mentorados.profile_id`
  permanece como identidade; `my_role()` fecha as superfícies jovem
  (invariante 0066). RPC `security definer` atômica em `0107` (número a
  confirmar na hora — depende se 98 saiu primeiro).
- **159 elegibilidade:** só `situacao='concluido'`.
- **54: PDM como item de leitura** (instrumento respondido — opção A
  interina), com `kind:'pdm'` na union pra troca limpa quando REALIZA-181
  trouxer PDM nativo (opção B). Sem tabela nova nesta issue.
- **37: fetch server-side** (action `buscarCep`) — não expõe IP do
  usuário ao ViaCEP e serve o token público `/assinar/[token]`; fixture
  interna em demo pra e2e determinístico.

## BLOCKERs abertos (pra Thiago)

1. **REALIZA-159:** desistente pode ser promovido a mentor? Default do
   plano: **não** (só `concluido`; desistente que voltar passaria por
   reversão de saída + conclusão). Confirmar.

## Verificações pendentes na implementação (registradas nos planos)

- `pg_get_functiondef`/`information_schema` antes de escrever SQL (RPCs
  gordos de 0101/0105, colunas de `mentorados`/`profile_papeis`,
  `mentor_profiles.tipo`, unique de `profiles.email`).
- Versão viva de `aceitar_solicitacao` (98): ainda gera dupla ou `sol_efetivar`
  cobriu?
- `grep my_mentorado_id` nas migrations (159): confirmar que só views
  `jovem_*` consomem a identidade.
- Projeção de `jovem_duplas` (98): omitir `dupla_dpp_id` se for `select *`.
- Audiência do card `InstrumentosDupla` por papel (54): item PDM segue a
  mesma regra.
- Campos exatos de `InstrumentoEntrega` (54) e `Mentorado` na lista
  "Fora do programa" (159 — e-mail chega?).

## Gates obrigatórios citados nos acceptance.md

`npx tsc --noEmit` · `npx eslint src/` · `pnpm test` · schema-contract CI
(`scripts/check-schema-contract.mjs`) · migration no staging antes do
push · e2e `tests/e2e/demo` + `tests/e2e/app` no preview · 2 revisores
nos diffs substanciais (98 e 159 — escalação/RLS/RPC gorda).
