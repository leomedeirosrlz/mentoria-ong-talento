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

2. **Decisão sobre genéricos** (depende do BLOCKER do README):
   - **Se genérico não é necessário**: migration `010x` adiciona
     `check (num_nonnulls(dest_profile_id, dest_mentorado_id, dupla_id) >= 1)`
     em `formulario_links` — todo link nasce com pelo menos um vínculo.
     Impacto em `gerarLinksFormulario` (`src/lib/forms/actions.ts`): o ramo
     `tipo === "generico"` passa a exigir `contexto.dupla_id` ou vira erro —
     ajustar a UI de emissão (`src/app/(app)/formularios/`) pra exigir escopo.
   - **Se genérico é necessário** (divulgação aberta): a resposta genérica fica
     marcada e a **reconciliação** entra no fluxo — quando o respondente se
     identificar (primeiro campo do form ou claim posterior), a coord vincula
     `dupla_id`/`dest_mentorado_id` retroativamente numa action
     `vincularRespostaOrfa(linkId, mentoradoId)` [NOVO] coord-only com log.
   - Recomendação: primeira opção — mais simples e fiel à regra "nada órfão".

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
