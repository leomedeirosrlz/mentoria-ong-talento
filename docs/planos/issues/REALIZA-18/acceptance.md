# REALIZA-18 — Critérios de aceite

1. **Overlay renderiza** — dupla com roda inicial (enc. 1) e formal
   respondidas: na ficha, o resultado da formal mostra polígono preenchido
   + contorno tracejado da inicial + legenda + linha de delta médio.
2. **Só um momento** — só inicial respondida: render atual intacto, hint
   discreto "o comparativo aparece quando a roda formal chegar".
3. **Jovem vê o dela** — "Rever resposta" na estação `roda_formal` mostra
   overlay com a própria leitura inicial; copy em primeira pessoa.
4. **Caso por campo_id** — form editado entre momentos (eixo renomeado):
   eixos casados comparam; órfãos aparecem recolhidos + nota de rodapé.
5. **Sem "antes" inventado** — resposta formal sem inicial na dupla: zero
   overlay, zero placeholder fantasma.
6. **Input intacto** — a tela de resposta (`/f`) da formal mostra roda
   limpa, sem camada anterior influenciando o input.
7. **Visibilidade** — mentor de outra dupla não vê; supervisor só o escopo
   dele; anon nunca (definer-only segue).
8. **a11y** — leitor de tela anuncia comparativo; tabela sr-only cobre os
   16 pares.
9. **Testes** — `roda-compara.test.ts`: deltas corretos, null handling,
   eixo órfão, quadrante agregado. `pnpm test` verde.
10. **Demo** — fixture demo com as duas rodas: overlay visível no modo
    demo coord (spec e2e demo).
11. **Regressão** — `instrumento-resultado` das outras respostas
    (visao/metas/pdm) inalterado; `tsc`/`eslint` limpos.
