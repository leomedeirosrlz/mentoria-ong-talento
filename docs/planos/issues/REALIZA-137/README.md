# REALIZA-137 — Rodada de mockups: 3 variantes por tela + juízes UX + relatório

- **Jira:** `REALIZA-137` (projeto REALIZA, `kelyng.atlassian.net`)
- **Tier:** A → **veredito: FEITO — não replanejar.** Este doc é só a trilha de
  evidência pra fechar a issue no Jira.
- **Origem:** `docs/planos/ux-revisao-chamados.md` (Frente H, fases 1–3) —
  "3 variantes materialmente diferentes por tela, juízes UX pontuam, decisão
  sai do relatório".

## Evidência no disco

| Artefato | Onde | O que comprova |
|---|---|---|
| Brief das rodadas 1–2 | `docs/mockups/_brief.md` | Direções de design por variante, rubrica dos juízes, dataset |
| Brief da rodada final | `docs/mockups/_brief-final.md` | Dataset canônico único, regras de domínio, composição por tela, formato "Ver como:" |
| 26 HTMLs standalone | `docs/mockups/{agenda,duplas,materiais,chamados,jovem-especialistas,instrumentos}/v*.html` | Tokens do projeto (`--brand-lime` etc.), dados pt-BR realistas, seletor de papel por radio+CSS (ex.: `agenda/v6.html:357-358`) |
| 50 screenshots | `docs/mockups/<tela>/v{N}-{desktop,mobile}.png` | 1280px e 390px via Playwright (ausentes só em `duplas/v5`, gerada depois) |
| Relatório de decisão | `docs/mockups/RELATORIO.md` | R1 (15 variantes, 5 telas × 3, 5 juízes), R2 (+4 variantes de correção de domínio), rodada final composta (vencedora + resgates das perdedoras) |

## Cobertura dos critérios de aceite

- **~15 mocks + screenshots + relatório** ✅ — superado: 3 rodadas, 26 mocks.
- **Agenda mocka as duas visões E a alternância por persona** ✅ — `agenda/v6.html`
  tem "Ver como:" (5 papéis) e, dentro do mentor DPP, as abas "Minha agenda" ×
  "Por mentorado" (`v6.html:493` — radios `tdpp-a`/`tdpp-b`).
- **Thiago aprova a vencedora antes de virar implementação** ✅ — registrado em
  `docs/planos/implementacao-telas-finais.md:6` ("Revisão do stakeholder":
  Agenda **Final**, Duplas **v1**, Materiais **v3 narrativa**, Instrumentos
  **Final**, Especialistas **Final** + catálogo cardápio, Chamados **Final**).

## Downstream (o que a rodada virou)

- Plano de implementação: `docs/planos/implementacao-telas-finais.md`
  (WP0b–WP9; cada WP cita o mock-fonte, ex.: "DuplasLista — spec no mock
  `docs/mockups/duplas/v5.html`").
- Telas reais já implementadas a partir dos mocks vencedores: `/agenda`
  (modos Minha/Por mentorado/Calendário, auxiliar Por turma/Consolidada,
  coord Monitoramento — `src/app/(app)/agenda/page.tsx`), `/chamados`,
  `/jovem/especialistas`, `/jovem/materiais` (hub jornada), instrumentos
  nativos e o sistema de chamados.

## Pendência que sobra (fora do escopo desta issue)

- Os HTMLs **não estão commitados** (nota no fim do `RELATORIO.md`) e não são
  alcançáveis de dentro do produto — é exatamente o gap da **REALIZA-138**
  (viewer de variantes na demo, registry `src/lib/demo/mockups.ts` [NOVO] previsto
  em `implementacao-telas-finais.md` WP9 mas nunca criado).

## Ação

Fechar `REALIZA-137` no Jira com comentário apontando `docs/mockups/` +
`RELATORIO.md` + `docs/planos/implementacao-telas-finais.md`.
