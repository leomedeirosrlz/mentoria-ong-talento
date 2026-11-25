# Backlog 2026-11 — contexto e convenções das specs

Specs por item do backlog, no formato casa (`docs/planos/spec-realiza-30.md`). Cada spec é o contrato da implementação: recon feito, decisões tomadas, blast radius mapeado, critérios de aceite verificáveis.

## Formato obrigatório

```
# REALIZA-NN — <título da feature>

Issue: <labels>. Fonte: <doc/issue de origem>. Status: <a fazer | em implementação | em review>.

## O que exige vs. o que existe
<estado atual com file:line verificados + o que falta>

## Decisões
<escolhas tomadas e porquê — uma por item; alternativas descartadas com razão>

## Schema
<migrations se houver — número reservado, shape, blast radius; "nenhuma" se não houver>

## Domínio (src/lib/)
<actions/queries/helpers tocados, comportamento novo>

## UI
<componentes/telas, copy em pt-BR, regras de texto/estado do AGENTS.md>

## Seed + demo
<fixtures que precisam mudar>

## Testes
<vitest e/ou e2e specs a criar/ajustar>

## Critérios de aceite
- [ ] <afirmação verificável por teste ou inspeção>

## Fora de escopo
<o que explicitamente não entra>
```

## Convenções globais (binding)

- `AGENTS.md` do repo é lei (hierarquia de texto, copy sem travessão, motion, container queries, RLS `my_role()`/`my_profile_id()`, actions `{error}/{ok}`).
- Identifiers/comentários em inglês; UI copy pt-BR; sem travessão em texto de UI.
- Server components importam Phosphor de `@phosphor-icons/react/dist/ssr`.
- Migration numbers: staging está em 0182; reservados 0183/0184 (jovem-consistencia), 0185 (materiais), 0186 (dupla anexos). Specs novas que precisem de migration usam **0187+** sequencial sem colisão — declarar o número na spec.
- Commits: autor thisux1, conventional, SEM tags [deploy]/[e2e-preview].
- Nada vai a prod sem preview verde + ok explícito do Thiago.

## Status dos itens em implementação (specs retroativas — servem de checklist de review)

| Batch | Branch | Issues |
|---|---|---|
| wizard-pessoas | `thiago/wizard-pessoas-fixes` | 374, 370 |
| dupla-fixes | `thiago/dupla-fixes` | 364, 351, 353, 54 |
| mobile-ui | `thiago/mobile-ui-fixes` | 367, 365 |
| jovem-consistencia | `thiago/jovem-consistencia` | 372 (sub-itens 1,3–8) |
| materiais-upload | `thiago/materiais-upload` | 362, 66, 368 |
| login-liza | `thiago/login-liza-polish` | 35, 363 |
| audit-fixes | `thiago/audit-fixes` | 8 achados da auditoria (ver `_audit-findings.md`) |

## Itens fora do escopo de código

- OPS/pessoas reais: REALIZA-272..277, -65, -53 (Drive), -33 (LGPD revisão jurídica), -75 (meta)
- Decisão pendente do Thiago: REALIZA-138 (demo switcher — documentar pergunta, não implementar)
