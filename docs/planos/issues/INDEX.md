# Esteira de planejamento — Índice e reconciliação final

Gerado pela pipeline multi-agent (11 clusters de planejamento + 6 personas de
revisão + checker automático). Fontes: `_manifest.md`, `_issues.json`,
`_contexto-agentes.md`, `_recon/{schema,telas,ops,issues-status}.md`,
`_reviews/{produto-coord,tech-lead,qa,seguranca,ux,dba}.md`.

## Placar de revisão (personas × issues revisadas)

| Persona | Aprovado | C/ajustes | Reprovado | Revisadas |
|---|---|---|---|---|
| produto-coord | 62 | 25 | 0 | 87 |
| tech-lead | ~35 | 12 | 1 (143) | 48 |
| qa | 38 | 13 | 0 | 51 |
| seguranca | ~12 | 7 | 2 (169, 182) + 171 sem plano | 22 |
| ux | 24 | 12 | 2 (16, 56) | 38 |
| dba | 5 | 12 | 5 (51, 70, 159, 167, 171) | 22 |

## Bloqueios a resolver antes de implementar (ordenados por impacto)

### Sistêmicos (afetam várias issues)

1. **`/api/jobs/*` inalcançável pelo cron** (169, 182 REPROVADAS; afeta 168, 178):
   `middleware.ts:50-77` não tem `/api/jobs/` em `isPublic` → 307→/login mata o
   job antes do Bearer check. Fix único: allowlist + 401 JSON + criar
   `vercel.json` (ausente do repo; plano Hobby = 1 cron/dia → **consolidar os 3
   jobs num `/api/jobs/tick` dispatcher** que chama as RPCs — resolve o limite).
2. **`x-forwarded-for[0]` é spoofável** — afeta evidência de assinaturas HOJE +
   170 (rate-limit) + 183 (ip_hash). Fix: último elemento do XFF ou
   `x-vercel-forwarded-for`. Ação real no código pendente.
3. **Colisões de migration 0106–0110** — número trava na ordem de merge (todos
   os planos já marcam como indicativo). Ordens documentadas: **167 → 183 → 170**;
   **36 → 70 → 69**.
4. **CHECKs compartilhados** — `notificacoes.tipo` (fonte viva = 0103, 31
   valores; 35/168/169 alargam), `emails_enviados.tipo` (51+178 → superset de 7),
   `ia_eventos.canal` (CHECK + corpo de `registrar_ia_evento` mudam juntos — 0108
   da 178 cobre), `interacoes.tipo` (16 quer 'vinculo_resposta'). Quem mergear
   2º relê `pg_get_constraintdef` e leva o superset.
5. **`submeter_resposta_formulario` reescrita por 3 planos** (20 + 70 + 181):
   último merge carrega todos os branches + wiring 360 + gate 0070.
6. **Conflito 16 × 70**: check de âncora `num_nonnulls>=1` precisa exceção
   `or multi_uso or origem='intake'` — nem um nem outro cita a relação (está
   registrado em `_reviews/dba.md` §4-5; ordem 20 → 70 ou mecanismo novo).

### Issues reprovadas (precisam de revisão do plano antes de codar)

| Issue | Persona | Correção |
|---|---|---|
| 143 | tech | default variante B (grade 2-col, menos risco pro SVG); A vira follow-up |
| 169 | seg | fix sistêmico 1 (middleware) |
| 182 | seg | fix sistêmico 1 (middleware) |
| 16 | dba+ux | exceção multi_uso no check; especificar picker (Select real, não Command) |
| 56 | ux | redesenhar blocos como conteúdo das seções da 178 (não página alternativa) |
| 51 | dba | grant `(text, uuid[])` — assinatura certa |
| 70 | dba | índice substituto em link_id + advisory lock no guard + conflitos 16/20 |
| 159 | dba | 2 inserts em pessoa_notas (XOR); `profile_papeis` direto, `profiles.role` deriva |
| 167 | dba | seed por email/nome (`insert...select`) não uuid literal de prod |
| 171 | seg+dba | sem plano — README-stub criado com spec mínima |

### Decisões externas (BLOCKERs legítimos pro Thiago)

- **33/53/65/67** — decisões de produto/jurídico documentadas em `decisao.md`.
- **52/178/179/180** — provider de IA com DPA+retenção zero: gate absoluto.
- **32** — auxiliar vê turma toda vs só designadas (designação é o deliverable).
- **62** — "sem prazo definido" resolve o bug original? (sweep `rg` mandatório).
- **70** — comportamento exato do grid 2×/template.
- **138** — variante A vs B do demo switcher.
- **159** — elegibilidade alumni: só `concluido` ou inclui desistentes? (plano
  assume concluído; confirmar).
- **170** — audiência do relatório público; respostas brutas fora da v1
  (confirmado pelo design).
- **183** — retenção do log de acesso; comportamento sem salt em prod.
- **51** — destino do e-mail (Resend transacional?) e escopo WhatsApp.

## Achados de produto que mudam escopo

- **~25 issues FEITO** no código (15, 19, 30, 31, 38, 40, 46, 61, 63, 64, 72,
  99, 100, 101, 102, 103, 137, 140, 147, 152, 153, 154, 162…) — fechar no Jira
  com evidência, não replanejar. Auditoria: `_recon/issues-status.md`.
- **Roda da Vida contém Art. 11 LGPD** (saúde mental/relacionamento) — flagado
  na 33 e no inventário; tratamento de visibilidade já no plano.
- **`terceiros_contatos` guarda nome+WhatsApp de não-titulares** sem registro
  de consentimento — inventário da 33.
- **`mentorados.notas` legível por mentor/supervisor** — decisão pendente 33.
- **Retenção/anonimização não existe** — follow-up C da 33.
- **`avatares` bucket público com foto de menores** — decisão consciente
  registrada na /privacidade; confirmar na revisão jurídica da 33.
- **E-mail é síncrono** (sem fila) — 51/178 dependem de `EMAIL_ENVIO_LIBERADO`
  como kill-switch; queue real não existe.

## Componentes citados nos planos que NÃO existem no repo

`Command`/busca-pessoa (16) · `Checkbox` em ui/ (51) · `getTurmas()`/
`getTurmasAtivas()` (32/159 → `getCronogramas`) · `type="range"` na roda (143 →
`AreaSlider`) · bottom-sheet do dropdown (181) · `EstadoCard` dentro de página/
dialog autenticado (178, 180 — renderiza h1). Ver `_reviews/ux.md` §transversais.

## Estado do checker

`node scripts/check-planos.mjs` → **0 problemas** (após fixer f2d5…):
paths corrigidos, `[NOVO]` marcados, classificação evidence/absorbed/decision
respeitada.

## Próximos passos sugeridos (ordem de valor)

1. Aplicar os ~10 fixes sistêmicos acima nos planos afetados (scriptable na
   maioria — ou um fixer pass).
2. Fechar no Jira as ~25 issues FEITO com link pra evidência.
3. Decisões externas listadas — só Thiago resolve.
4. Merge order das migrations quando começar a implementar: **167 → 183 → 170**
   (relatórios); **36 → 70 → 69** (forms); **98 antes de 171** (rematch);
   **20 → 70** (unique link_id); **178 leva o CHECK de canais** (superset).
5. Revisão dos planos reprovados → re-review pela persona que reprovou.
