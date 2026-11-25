# Auditoria — olho da Liza pequeno no desktop (REALIZA-447 reaberta)

Relato: "o olho da Liza ainda muda com a largura da viewport; no desktop
fica muito pequeno". O 447 trocou matchMedia por `useMedida`, mas o olho
continuava atrelado ao px medido — via `kOlho`, não mais via wrapper.

## Causa real (medida, não presumida)

`LizaBlob` recebe `tamanho` em px (do `useMedida` no modo `responsivo` ou da
prop) e dentro do viewBox `0 0 100 100` interpolava as medidas do olho por
`kOlho = clamp((tamanho-28)/36)`:

| medida | mini (k=0, ≤28px) | cheio (k=1, ≥64px) |
|---|---|---|
| rx | 14 | 13.3 |
| ry | 17.25 | 16.25 |
| cy | 48.5 | 45.5 |
| dx | 19.4 | 19 |

Ou seja: o olho **encolhia em proporção** à medida que o slot media mais —
rx 14→13.3 (−5%), e ainda subia no rosto. O px medido (que vem do container,
que por sua vez depende da viewport) vazava pra dentro da proporção da cara.

Medições (Playwright, `svg[viewBox="0 0 100 100"]`, `getBoundingClientRect`,
rx lido do `d` do path do olho — `M -<rx> 0C…`):

| contexto | slot medido | svg | antes (rx, olho/blob) | depois |
|---|---|---|---|---|
| FAB mobile 390 | 48px | 48px | 13.87 → 27.7% | 15.5 → 31% |
| FAB desktop | 44px | 44px | 13.75 → 27.5% | 15.5 → 31% |
| header | 32px (wrap `size-8`) | 34px | 13.84 → 27.7% | 15.5 → 31% |
| empty padrão | ~108px | ~108px | 13.3 → 26.6% | 15.5 → 31% |
| empty expandido | 160px | 160px | 13.3 → 26.6% | 15.5 → 31% |

O wrapper CSS estava correto (`size-auto` — o fix do FAB de 9e2ec3f4 segue
valendo; o svg nunca foi espremido pelo `[&_svg]:size-4` do Button). O slot
medido e o `tamanho` do SVG também estavam certos — o `useMedida` lia o px
real do container em todos os contextos. O único ponto que fazia a
proporção variar era o `kOlho`.

## Correção

`kOlho` removido: `olhoDims` é uma constante
`{ rx: 15.5, ry: 18.5, cy: 48.5, dx: 21 }` para toda a escala — cada olho é
sempre 31% da largura do blob e o par ocupa ~18% da área do rosto (antes:
26.6–27.7% de largura e ~14–15% de área).

O afastamento dos olhos ficou igual: `2·dx − 2·rx` segue ≈ 11 unidades de
viewBox (~2.4px no avatar de 22px) — os olhos crescem pra margem, não um
contra o outro, e não encostam no mini. Expressões (`pose`, arcos do
momento `aberto`, piscada, olhar) e os cílios (`ciliosMini` < 40px) não
mudaram — só as medidas-base.

## Provas

- `antes-*` / `depois-*`: FAB, painel padrão (header + empty) e expandido
  nos 3 viewports do DoD. `depois-<viewport>-mascote.png` é o empty state
  assentado (fim do momento `aberto`, 1.2s — olho oval).
- `tests/liza-smoke.test.ts` atualizado: o contrato deixou de ser "cresce
  abaixo de 64px" e virou "proporção constante" (rx idêntico em 48 e 160).
