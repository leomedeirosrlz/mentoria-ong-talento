# REALIZA-18 — Roda da Vida interativa: 16 eixos, radar, overlay antes/depois

- **Jira**: REALIZA-18 (migrada de REALIZA-20) · Feature · Medium
- **Veredito**: **PARCIAL — a roda interativa existe; falta o overlay antes/depois.** O radar de 16 eixos (4 quadrantes), entrada por gesto/teclado e os dois momentos do ciclo já funcionam; a promessa "vê o antes × depois" ainda não renderiza — hoje cada resposta é vista isolada.

## O que já existe (verificado)

- **16 eixos / 4 quadrantes**: `src/lib/forms/instrumentos.ts` (`extraiEstruturaRoda`/`extraiRodaDaVida`) — lê a definição do form `roda_vida` (seed 0080).
- **Radar SVG**: `src/components/instrumentos/roda-svg.tsx` — ângulo→eixo, raio→nota, polígono preenchido, números nas pontas, rótulos de quadrante.
- **Entrada interativa**: `src/components/instrumentos/roda-vida.tsx` — gesto de ponteiro no SVG + lista acessível de sliders (setas, Home/End, PageUp/Down).
- **Dois momentos**: `roda_inicial` (enc. 1) e `roda_formal` (enc. 12–14) como estações em `jornada.ts`; `contexto.momento` nos links; autoemit sabe que a formal segue devendo após a inicial (0099).
- **Resultado**: `instrumento-resultado.tsx` renderiza a roda respondida.

## O que falta

- **Overlay comparativo**: quando a roda formal existe respondida, renderizar **as duas sobrepostas** — polígono inicial (fantasma/contorno) + formal (preenchido), com legenda e leitura de delta por eixo/quadrante.
- **Superfícies do comparativo**: ficha da dupla (`instrumento-resultado`), "Rever resposta" da jovem na estação `roda_formal`, e opcionalmente no resumo da jornada/relatório de encerramento.
- Copy da estação já promete ("Você refaz a Roda e vê o antes × depois") — a entrega precisa honrar.

## Dependências / bloqueios

- Depende de REALIZA-20 na manifest — na prática a espinha já existe; o overlay só precisa das **duas respostas da mesma dupla** (query, não schema).
- BLOCKER: LGPD — a roda é autorretrato íntimo de menor. Visibilidade do comparativo segue a regra atual do instrumento (jovem dono, mentor DPP da dupla, coord, supervisor)? Ou o comparativo é coord-only? (Ver decisão LGPD referenciada na issue.)

## Esforço: **P**

## Riscos

- Overlay com polígono antigo por cima pode esconder o novo — resolver com contorno tracejado/transparência (decisão visual em design.md).
- Rodas com eixo divergente (form editado entre os dois momentos) — comparador precisa casar por `campo_id`, não por posição.
