# REALIZA-71 — Design

## Persona / JTBD

- **Coord/supervisor no encerramento**: "antes de ler a 360, quero a linha
  da jornada — ela foi bem? pediu apoio? piorou no fim?".
- **Mentor** (se visível pra ele): trajetória quantizada — tendência, não
  vigilância.

## Composição (reuso)

- `ResumoJornadaSection` (`resumo-jornada.tsx`): novo tile no `dl` já
  existente (mesmo padrão visual dos 4 tiles — `bg-muted/40` etc.):
  - label: "Avaliação do jovem" (e renomear o tile atual "Avaliação
    média" → "Avaliação do mentor" — desambiguação honesta).
  - dd: "★ 4,1 / 5" + sub "{n} encontros" + linha "1º→último 3★→5★"
    + "temas: estudos, família" + "pediu apoio 1×".
- `encerramento-dupla.tsx`: dentro do item `avaliacao_360_enviada`,
  microcopy extra quando feito: "trajetória {media}★ em {n} encontros".
- `TrajetoriaAvaliacoes` (existente) como detalhe/drill-down se a ficha
  já o mostra pro papel — reuso, não recriar.

## Estados

- 0 avaliações: tile some (não mostra "—" vazio) — espaço cede.
- 1 avaliação: média + sem linha de trajetória (n≥2 pra "1º→último").
- Mentor vendo: tile mostra a quantizada ("média por fase") ou some —
  conforme BLOCKER; nunca série crua.
- Resposta 360 ausente: agregado aparece mesmo assim (é da jornada).
- Print: tile dentro do grid existente, sem quebra de página indesejada
  (o CSS print do resumo já isola o bloco).

## Microcopy pt-BR

- "Voz do jovem" ou "Avaliação do jovem" — label do tile (decidir: manter
  simétrico "Avaliação do mentor" × "Avaliação do jovem" — recomendado).
- "1º → último: 3★ → 4★" — trajetória instantânea.
- "pediu apoio em {k} encontro{s}" — sinal de cuidado.
- Encerramento: "como foi cada encontro aos olhos dela".

## a11y

- `dl`/`dt`/`dd` semântico (padrão do componente); estrelas com
  `aria-label` numérico ("4,1 de 5"), não só glyphs.
- Cores não carregam sentido único (semáforo proibido — a trajetória é
  neutra).
