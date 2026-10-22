# REALIZA-71 — Critérios de aceite

1. **Agregado no resumo** — dupla com 6 encontros avaliados pela jovem:
   `ResumoJornadaSection` mostra tile "Avaliação do jovem" com média
   correta (reconferir no banco), n, trajetória 1º→último e temas top.
2. **Desambiguação** — o tile antigo passa a dizer "Avaliação do mentor"
   (era só "Avaliação média"); valores inalterados.
3. **Encerramento** — item `avaliacao_360_enviada` feito mostra a linha
   de trajetória; sem 360 respondida, agregado continua no resumo.
4. **0 avaliações** — tile ausente (sem "—"); layout não quebra (grid
   reajusta).
5. **1 avaliação** — média exibida; sem linha "1º→último".
6. **Privacidade do mentor** — logado como mentor DPP: nenhuma série
   crua de `avaliacoes_encontro` chega ao client (verificar payload da
   ficha/network); ele vê só a quantizada existente ou nada — nunca
   por-encontro.
7. **`avaliacao_visivel_mentor=false`** — avaliação com flag falsa não
   aparece em nada que o mentor veja (nem agregado diferente do que a
   RPC quantizada já dá).
8. **Print** — imprimir o resumo: bloco aparece compacto (média+n);
   detalhes qualitativos fora do print.
9. **Testes** — `avaliacao-jornada.test.ts`: médias, temas frequentes,
   pedidos de apoio, série vazia/única, ordenação por nº de encontro.
10. **Demo** — fixture: ficha demo mostra o tile (spec e2e demo).
11. **Qualidade** — `tsc`/`eslint`/`pnpm test` limpos; sem migration →
    schema-contract intacto.
