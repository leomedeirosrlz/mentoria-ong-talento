# REALIZA-16 — Plano de implementação

## Contexto embutido

A issue garante que nada coletado do mentorado via token se perca quando a conta
dele existir. O padrão já está correto: `mentorados.id` é a identidade estável,
`mentorados.profile_id` (0066) liga à conta depois, e cada artefato ancora por
`dest_mentorado_id` ou `dupla_id → duplas.mentorado_id`. O que falta é **provar**
isso de forma executável e fechar o buraco dos links genéricos.

## Matriz de âncora (auditada — fonte: migrations)

| Artefato | Tabela | Âncora estável | Coberto? |
|---|---|---|---|
| Respostas de forms | `formulario_respostas` | via `link_id → dest_mentorado_id` ou `dupla_id` | ⚠ só se o link for nominado |
| Instrumentos (visão/metas/PDM/roda) | idem (são `formularios.sistema`) | idem | ⚠ idem |
| Micro-avaliação de encontro | `avaliacoes_encontro` | `dupla_id` + `respondido_por_profile_id` (0071) | ✅ |
| Assinaturas/termos | `assinaturas` | `mentorado_id` direto (0033) | ✅ |
| Anexos de evidência | `registro_anexos` | `→ registros → encontros → duplas` | ✅ |
| Intake/matching | `mentorados`/`form_bruto` | na própria linha | ✅ |
| Terceiros | `terceiros_contatos` | `dupla_id` (verificar migration de origem — a verificar) | ⚠ |
| Rascunhos (REALIZA-20) | a criar | herdar âncora do link | planejar lá |

## Passos

1. **Auditoria executável** — `scripts/auditoria-identidade-mentorado.mjs`
   `[NOVO]` (padrão `scripts/check-schema-contract.mjs`): roda contra o
   PostgREST/service-role e conta, por tabela da matriz, quantas linhas **não**
   resolvem pra `mentorados.id`:
   ```sql
   -- respostas sem âncora nenhuma
   select count(*) from formulario_respostas r
     join formulario_links l on l.id = r.link_id
    where l.dest_mentorado_id is null
      and l.dupla_id is null;  -- genérico E sem contexto = órfão
   ```
   Saída: relatório por tabela + exit≠0 se órfão > 0 (roda em CI/staging antes
   de endurecer — prod precisa estar limpo ou saneado).
   Arquivos: `scripts/auditoria-identidade-mentorado.mjs` [NOVO].

2. **Decisão sobre genéricos** (BLOCKER respondido na revisão — dba §4):
   genéricos SÃO necessários, mas só os de campanha. Migration `0116`
   adiciona `check (num_nonnulls(dest_profile_id, dest_mentorado_id,
   dupla_id) >= 1 or multi_uso or origem = 'intake')` **NOT VALID** em
   `formulario_links` — a exceção cobre o link de intake (0115), reconciliado
   por `promovido_profile_id`; o `validate` roda após a auditoria zerar.
   `gerarLinksFormulario` perde o ramo `"generico"` (union `DestinoLink` sem
   ele + guard de payload com erro amigável) e a UI deixa de oferecer o
   "Copiar link genérico". Órfãos legados são saneados por
   `vincularRespostaOrfa(linkId, mentoradoId)` [NOVO] coord-only — carimba
   `dest_mentorado_id` + dupla DPP quando houver e registra trilha
   (`interacoes.tipo` 'vinculo_resposta' — CHECK drop/add na 0116; sem dupla,
   `pessoa_notas` na ficha).

3. **Guard de futuro** — checklist de revisão em `CLAUDE.md`/PR template
   (ou comentário na migration): "toda tabela que guarda dado do jovem expõe
   `mentorado_id` ou `dupla_id`; exceção exige justificativa". A auditoria do
   passo 1 roda no CI pra segurar isso sozinha.

4. **Teste Vitest** — `src/lib/identidade-ancora.test.ts` [NOVO]: matriz
   declarativa `{tabela, coluna âncora, cadeia}` exercitada contra
   `database.types.ts` (a coluna declarada existe) — pega regressão de schema
   em tempo de typecheck/test sem banco.

5. **Doc da política** — 1 seção em `docs/planos/` ou comentário no topo de
   `0066` referenciando: identidade=`mentorados.id`, autorização=role,
   link=posse-ainda-não-identidade.

## Ordem de PR

Único PR pequeno: auditoria (1) pode ir antes e independente; a migration (2)
só depois do saneamento do relatório e da decisão.

## Rollback

- Migration de check: `alter table formulario_links drop constraint …` —
  reversível (check não apaga dado).
- Se surgir genérico legítimo em produção, a auditoria continua rodando e a
  constraint pode ser relaxada pra `dupla_id is not null OR (dest é null AND
  contexto->>'canal' = 'divulgação')`.
