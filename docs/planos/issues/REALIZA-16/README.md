# REALIZA-16 — Preservação de dados do mentorado: identidade estável pra futura conta sem perda

- **Jira**: REALIZA-16 (migrada de REALIZA-49) · Tarefa · High
- **Veredito**: **ABERTO — parcial estrutural**. A âncora de identidade existe e é boa; o que falta é o fechamento sistemático do checklist da issue (auditoria de cobertura + regra pra links genéricos + garantia de que nada novo nasça órfão).

## O que já existe (verificado no código)

- `mentorados.id` é a identidade de participação estável — tudo do jovem pendura nela (`0066_mentorado_identidade.sql`, comentário header).
- `mentorados.profile_id uuid unique` (0066) — liga a identidade à conta quando ela existir; nullable → jovem sem login segue por links tokenizados; sem `on delete set null` (preservação > conveniência). A coord vincula no cadastro/convite (`src/lib/actions.ts:851` comenta o vínculo).
- `my_mentorado_id()` (0066) — resolvedor definer identidade≠autorização.
- `formulario_links.dest_mentorado_id` + `dupla_id` (0036) — respostas de forms/instrumentos ancoram no mentorado via link.
- `avaliacoes_encontro.dupla_id` + `respondido_por_profile_id` (0071) — micro-avaliações ancoram na dupla.
- `assinaturas.mentorado_id` (0033) — termos ancoram direto.
- Anexos de evidência: `registro_anexos → registros → encontros → duplas.mentorado_id` — cadeia completa.
- Intake/matching: `mentorados` + `form_bruto` na própria linha de identidade (0054).

## Escopo restante (o que a issue ainda pede)

- Auditoria executável do checklist "respostas forms, instrumentos, anexos, assinaturas, intake" — uma consulta/teste que prova que 100% dos artefatos coletados por token resolvem pra `mentorado_id` (direto ou via `dupla_id`).
- **Lacuna real encontrada**: `formulario_links` admite `dest_profile_id` e `dest_mentorado_id` **ambos null** (link "genérico", `src/lib/forms/actions.ts` — `dest.tipo === "generico"`). Se `dupla_id` também for null, a resposta fica **órfã de identidade** — viola a regra da issue.
- Garantia de forward-compat: toda superfície de coleta nova (REALIZA-20 rascunhos, editor PDF 55, instrumentos novos) precisa nascer ancorada — checklist de revisão + guard de schema.

## Dependências / bloqueios

- Alinha com REALIZA-20 (rascunho server-side herda a mesma âncora) e REALIZA-181 (PDM nativo: `pdm_*` precisa `dupla_id`/`mentorado_id`).
- BLOCKER: links genéricos (`dest=null, dupla_id=null`) ainda são necessários pra algum fluxo em produção (ex.: form aberto de divulgação)? Se não, restringir; se sim, definir como a resposta genérica é reconciliada com um mentorado depois.

## Esforço: **P** (auditoria + uma migration de endurecimento + testes)

## Riscos

- Restringir links genéricos pode quebrar fluxo legado de divulgação de forms — verificar uso real antes do check constraint.
- Dados históricos órfãos já podem existir — a auditoria precisa rodar antes de endurecer.

## Implementação (corrigindo os motivos da reprovação)

- **BLOCKER respondido** (revisão dba §4): links genéricos são necessários,
  mas só os de campanha — o link de intake público (0115, `multi_uso` /
  `origem='intake'`) é anônimo por desenho e reconcilia por
  `promovido_profile_id`. O check de âncora (0116) exige
  `num_nonnulls(...) >= 1` **com essa exceção** e nasce `NOT VALID`
  (validate após a auditoria zerar — risco 2 coberto).
- **Picker real** (revisão ux): reconciliação do órfão legado usa `Select`
  de `src/components/ui/` (padrão `nova-dupla-dialog`), não `Command`.
- Entregue: migration 0116 (check + `interacoes.tipo` 'vinculo_resposta'),
  `vincularRespostaOrfa` coord-only com trilha, badge "sem vínculo" +
  "Vincular a um jovem" na ficha do formulário, matriz
  `src/lib/identidade-ancora.ts` + teste × `database.types.ts`, auditoria
  `scripts/auditoria-identidade-mentorado.mjs` (`pnpm audit:identidade`).
