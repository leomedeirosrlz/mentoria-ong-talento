# REALIZA-56 — critérios de aceite

## Blocos

1. Coord abre `/relatorios` → vê os 4 cards do topo (semáforo, aderência,
   apoio, documentos) + lista "precisam de atenção" + cards de contexto +
   digest + a grade atual intacta embaixo.
2. Semáforo: count por tom bate com `saudadeDaDupla` ao vivo (conferir 2-3
   duplas contra a ficha — motivo do card = `motivos[0]` da ficha).
3. Aderência: `Σfeitos/Σesperado` do recorte (conferir numa dupla: esperado
   por `encontroEsperado` desde `iniciada_em`); duplas <80% listadas.
4. Apoio: só pedidos abertos (sem `apoio_resolvido` depois); "mais antigo"
   = o primeiro `pedido_apoio` em aberto por `interacoes`.
5. Remarcações: conta encontros `agendado` com `motivo_reagendamento` +
   rodapé explicitando a limitação (não conta vezes).
6. Documentos: contagens por status batem com `assinaturas`; vencendo ≤7d
   listados.
7. Presenças: sem evento `formacao` no recorte → card some (não "0");
   mentors sem `formacao_ok` listados quando há eventos.
8. Instrumentos: taxa respondidos/enviados por formulário oficial; links
   expirados sem resposta listados.
9. Digest: texto = `textoResumoSemana` do recorte + "Copiar texto" põe no
   clipboard (toast de confirmação).

## Filtros

10. `?turma=T2 · 2026/2027` → todos os blocos + o builder recortam pra T2;
    URL compartilhada reabre o mesmo recorte.
11. `?status=encerrada` (só) → aderência/semáforo refletem só encerradas.
12. `?dupla=<id>` → lista de atenção mostra só aquela dupla; demais cards
    recalculam no escopo.
13. Recorte vazio (turma inexistente) → cards "Nenhuma dupla neste recorte"
    — sem NaN, sem crash.

## Tendência (182)

14. **Se** `dupla_saude_snapshots` tem dados → mini-série aparece no card do
    semáforo; se não (182 não mergeada) → bloco some sem erro.
15. `max(dia) < hoje-2` → badge "dados até <dia>" no card.

## Permissão / demo

16. Mentor/supervisor → não acessam (gate da página, inalterado). Anon →
    redirect pro login.
17. `/demo` papel coord → dashboard renderiza com dataset demo — números
    canned, sem queries reais.

## Qualidade

18. `tsc`/`eslint`/`vitest` limpos; cada `*Dash` com teste de borda (recorte
    vazio, dupla sem cronograma, zero presenças).
19. Nenhuma migration nova; nenhum grant novo.
20. Perf: TTFB da página comparável à atual (o fetch adicional é ~6 queries
    paralelas — medir no PR; >2× a atual pede revisão do dataset).
