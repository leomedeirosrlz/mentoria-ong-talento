# REALIZA-71 — Plano de implementação

## Contexto embutido

A micro-avaliação por encontro já existe dos dois lados (0071 +
`registros.avaliacao`). O que falta é **agregar no fechamento**: quando a
360º chega (checklist do encerramento, 0042 marca
`avaliacao_360_enviada`), a trajetória das micro-avaliações deve estar
visível junto — no resumo da jornada e na ficha de encerramento — em vez
de ficar enterrada por encontro.

## Passos

1. **Lib pura de agregação** — `src/lib/avaliacao-jornada.ts` [NOVO]:
   ```ts
   type SerieJovem = { encontroNumero: number; estrelas: number;
     sentimento: string|null; avancei: boolean|null; temas: string[] };
   type SerieMentor = { encontroNumero: number; avaliacao: Avaliacao };
   agregaJornada(avaliacoes: SerieJovem[], registros: SerieMentor[]): {
     jovem: { media:number|null; serie:SerieJovem[]; temasTop:string[];
              pedidosApoio:number; primeiroUltimo:[number,number]|null };
     mentor:{ media:number|null; serie:SerieMentor[] };
   }
   ```
   - `temasTop`: frequência de `temas` (array text) — top 3.
   - `primeiroUltimo`: estrelas do 1º vs último encontro avaliado
     (trajetória em uma linha).
   - Vitest `avaliacao-jornada.test.ts`: séries vazias, parciais, temas
     repetidos, quantização do mentor respeitada (ela é da query, não da
     lib — a lib recebe o que a query passou).

2. **Query** — estender `src/lib/queries.ts` (`getResumoJornada`-like /
   a query da ficha que alimenta `ResumoJornadaSection`): já seleciona
   `avaliacao_jovem:avaliacoes_encontro(*)` em algum ponto
   (`queries.ts:348` — **a verificar** exatamente qual fetch já traz isso
   pra ficha); garantir que o resumo receba a série do jovem
   (campos: encontro_numero via join encontros, estrelas, sentimento,
   avancei, temas, pedir_apoio, avaliacao_visivel_mentor) respeitando o
   escopo RLS atual:
   - coord/supervisor: série completa;
   - mentor DPP: só a quantizada existente (`avaliacao_media_dpp`) —
     **não** a série crua (ver BLOCKER do README);
   - jovem: já vê as próprias (`getJovemAvaliacoes`).

3. **Resumo da jornada** — `src/components/resumo-jornada.tsx`:
   novo mini-bloco "Voz do jovem na jornada" ao lado de "Avaliação média"
   (que hoje é a média dos registros do mentor — **renomear** o label pra
   "Avaliação do mentor" pra não confundir):
   - "★ média {x}/5 · {n} encontros avaliados" + linha "1º → último:
     3★ → 4★" quando n≥2 + "temas: {top3}" + "pediu apoio em {k}"
   - print-friendly (é o relatório final — manter compacto, `dl` igual
     aos demais tiles).
   - Mentor vendo a ficha: esse bloco mostra só a média quantizada
     (variante condensada) ou some — conforme BLOCKER; implementar
     condicional por papel (o resumo já é render condicional por dados).

4. **Encerramento** — `src/components/encerramento-dupla.tsx`: no item
   do checklist `avaliacao_360_enviada`, quando `feito`, anexar linha
   de contexto: "trajetória: média {x}★ em {n} encontros" — link "ver
   trajetória" abre `TrajetoriaAvaliacoes` (componente já existe — reuso).

5. **(Opcional, barato) — ficha**: se a ficha já mostra
   `TrajetoriaAvaliacoes` pra algum papel, nada novo; se não, o resumo
   cobre a necessidade da issue.

6. **Demo** — `src/lib/demo/data.ts`/`queries.ts`: fixture com série de
   avaliações do jovem pro resumo demo renderizar o bloco.

## Ordem de PR

PR único: lib+query+resumo+encerramento. Sem migration (só leitura).

## Rollback

Render condicional — remover o bloco volta ao resumo atual.
