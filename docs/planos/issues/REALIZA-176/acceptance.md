# REALIZA-176 — aceite

- Dado `coordenacao` em `/agenda`, quando a página carrega, então a **1ª
  seção visível** é "Para acompanhar" — a fila operacional.
- Dado ≥1 turma com encontro, quando olho "Semana do encontro", então cada
  turma é **uma linha** com `Tx · Encontro N · data · X/Y` + barra de
  progresso única `brand-lime`/`muted` — sem card alto, sem barra
  segmentada, sem número 3xl.
- Dado duas turmas, quando comparo, então ambas têm a mesma anatomia de
  linha — o olho varre por posição.
- Dado as seções, quando leio os `<h2>`, então não há `Tag` explicativa ao
  lado — a nota "por turma" vive dentro da seção em `text-xs muted`.
- Dado a fila com itens, quando clico "Lembrar", então a ação funciona como
  antes (notificação + WhatsApp) — comportamento preservado.
- Dado semana sem eventos oficiais, quando "Semana no programa" renderiza,
  então a mensagem tracejada existe (caso `:262-264` coberto).
- E2E: `tests/e2e/app/agenda-coordenacao.spec.ts` e specs demo de agenda
  seguem verdes (a verificar se algum assert busca texto da barra
  segmentada — atualizar se sim).
