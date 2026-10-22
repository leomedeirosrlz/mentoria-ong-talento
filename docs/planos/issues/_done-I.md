# Cluster I — Instrumentos & Jornada do jovem — entrega de planejamento

Data: 2026-02 (sessão). Regra seguida: `_brief-planejador.md`; status
auditado contra o código real — vereditos podem divergir do manifest
quando o código discorda, e dizem por quê.

## Vereditos por issue

| Issue | Veredito | Docs |
|---|---|---|
| REALIZA-16 | **ABERTO** — âncora existe (`dest_mentorado_id`/`dupla_id`/`profile_id` 0066); falta auditoria executável + guard pra links genéricos órfãos | `REALIZA-16/` — README, plan, sdd, design, sdr, acceptance |
| REALIZA-20 | **ABERTO (delta)** — a espinha já é `formulario_links`+instrumentos (0080/0099); falta rascunho server-side, status aberto/iniciado, devolução. **Não** criar `atividade_links` — convergência em `formulario_respostas.status` + `formulario_links.visto_em` + RPCs definer | `REALIZA-20/` — doc set completo |
| REALIZA-19 | **FEITO** — "Construindo a Visão" entregue ponta a ponta (seed 0080, `Visao`, emissão, ficha, jornada, painel) | `REALIZA-19/README.md` — evidência, fechar no Jira |
| REALIZA-18 | **PARCIAL** — roda interativa+dois momentos existem; falta overlay antes/depois | `REALIZA-18/` — doc set completo |
| REALIZA-143 | **PARCIAL** — PR #50 fez nav verde/título/indicador; falta 16 rótulos no desktop + polish de hierarquia/controles | `REALIZA-143/` — doc set completo |
| REALIZA-51 | **ABERTO** — WhatsApp por link já existe; falta disparo em lote por e-mail (RPC `emitir_instrumento_lote` [NOVO] + tipo `'instrumento'` em `emails_enviados` + template + UI no painel coord) | `REALIZA-51/` — doc set completo |
| REALIZA-71 | **PARCIAL** — micro-avaliação por encontro existe dos dois lados (0071 + `registros.avaliacao`); falta agregado no fechamento (resumo da jornada + encerramento) | `REALIZA-71/` — doc set completo |
| REALIZA-140 | **FEITO** — "Minha jornada" entregue (jornada.ts, 0096/0099, painel coord) | `REALIZA-140/README.md` — evidência |
| REALIZA-152 | **FEITO** — acervo dinâmico por cronograma+jornada + autoemit | `REALIZA-152/README.md` — evidência |
| REALIZA-141 | **OBSOLETA → 181** | `REALIZA-141/README.md` (5 linhas) + `requisitos-para-181.md` (meta_ordem, sem meta_principal/rev_*, ~10 metas) |
| REALIZA-142 | **OBSOLETA → 181** | `REALIZA-142/README.md` (5 linhas) + `requisitos-para-181.md` (submetas recursivas ~20 via `pdm_itens.parent_id` compartilhado, prazo_alvo/atingida_em, retrospectiva) |

## BLOCKERS levantados (perguntas pro Thiago)

1. **REALIZA-16**: links `formulario_links` totalmente genéricos
   (dest=null ∧ dupla_id=null) ainda são necessários? Se não → check
   constraint `formulario_links_tem_ancora`; se sim → fluxo de
   reconciliação `vincularRespostaOrfa`.
2. **REALIZA-20**: devolução reabre a **mesma** resposta
   (`status='devolvida'`, recomendado) ou exige nova rodada de link?
3. **REALIZA-18**: visibilidade do overlay antes/depois — mesma matriz
   do instrumento (jovem/mentor DPP/coord/supervisor) ou restrita
   (coord+jovem)? Depende da decisão LGPD da roda.
4. **REALIZA-143**: a variante do mockup (REALIZA-137) — labels ao redor
   da roda × grade 2 colunas — ainda não está decidida? (Recomendação
   registrada: grade no desktop, labels-ao-redor progressivo.)
5. **REALIZA-51**: destinatário do e-mail do lote — jovem
   (`mentorados.email`, cobertura a verificar) com fallback pro mentor,
   ou sempre o mentor repassando?
6. **REALIZA-71**: o bloco agregado no fechamento mostra série completa
   pro mentor ou mantém a quantização (`avaliacao_media_dpp` ≥3)?
   Recomendado: série só coord/supervisor/jovem.

## Convergências importantes registradas

- **`atividade_links` não é tabela nova**: a espinha real é
  `formulario_links`; os deltas da 20 são `formulario_respostas.status`
  (rascunho/enviada/devolvida) + `formulario_links.visto_em` + RPCs
  definer. REALIZA-55 (editor PDF) e 181 (PDM nativo) herdam.
- **Identidade** (16): `mentorados.id` + `profile_id` (0066) já cobrem o
  essencial — a issue vira auditoria+guard, não modelagem.
- **Ordem de implementação sugerida**: 16 (audit+guard) → 20 (rascunho/
  status/devolução) → 18 (overlay) + 143 (layout) → 51 (lote) → 71
  (agregação). 19/140/152 fecham no Jira.
- **A verificar** recorrentes: nome/assinatura exata da RPC de submit em
  0036; `contexto.momento` carimbado na emissão da roda; cobertura de
  `mentorados.email`; se `instrumentos_da_dupla`/`jovem_jornada` já
  projetam `respostas`+`contexto` por link; se `interacoes.tipo` admite
  valor novo pra trilha de vínculo.

## Arquivos criados

```
docs/planos/issues/REALIZA-16/{README,plan,sdd,design,sdr,acceptance}.md
docs/planos/issues/REALIZA-20/{README,plan,sdd,design,sdr,acceptance}.md
docs/planos/issues/REALIZA-19/README.md
docs/planos/issues/REALIZA-18/{README,plan,sdd,design,sdr,acceptance}.md
docs/planos/issues/REALIZA-143/{README,plan,sdd,design,sdr,acceptance}.md
docs/planos/issues/REALIZA-51/{README,plan,sdd,design,sdr,acceptance}.md
docs/planos/issues/REALIZA-71/{README,plan,sdd,design,sdr,acceptance}.md
docs/planos/issues/REALIZA-140/README.md
docs/planos/issues/REALIZA-152/README.md
docs/planos/issues/REALIZA-141/{README,requisitos-para-181}.md
docs/planos/issues/REALIZA-142/{README,requisitos-para-181}.md
docs/planos/issues/_done-I.md
```
