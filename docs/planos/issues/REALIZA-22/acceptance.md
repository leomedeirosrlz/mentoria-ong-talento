# REALIZA-22 — Critérios de aceite

Formato: **dado** (pré-condição) → **quando** (ação) → **esperado**.
Papéis de fixture: mentor da dupla (M), coord (C), supervisor (S), mentorado (J).

## Posição estável do "Agendar encontro" na ficha

1. **Dado** M na ficha de dupla DPP ativa **com** `pendenteRegistro`
   (encontro passado sem registro) → **quando** abre a ficha → **esperado**
   `Agendar encontro` **visível na linha de ações** (variante outline),
   imediatamente após `Registrar encontro` (primário).
2. **Dado** o mesmo cenário → **quando** M abre o `⋯ Mais` → **esperado**
   nenhum item "Agendar encontro" no menu (somente formulário /
   encerramento quando aplicável).
3. **Dado** M na ficha **sem** pendência → **quando** abre a ficha →
   **esperado** `Agendar encontro` como primário (comportamento atual),
   sem duplicata outline ao lado.
4. **Dado** M numa dupla `pausada` ou `encerrada` → **esperado** nenhum
   `Agendar encontro` na linha nem no menu (`podeAgendar=false`, inalterado).
5. **Dado** C ou S na ficha da dupla supervisionada → **esperado** nenhum
   `Agendar encontro` em lugar nenhum (coord/sup não agendam — inalterado).
6. **Dado** trilha `especialista` → **esperado** `Remarcar`/`sessão de
   especialista` renderizando como hoje (`page.tsx:840-851` intocado).
7. **Dado** M com pendência → **quando** clica `Agendar encontro` →
   **esperado** o dialog abre com título "Nº encontro" e `numero` =
   `proximoNumero` (o mesmo caminho do trigger padrão).

## Responsividade

8. **Dado** viewport 360px → **quando** M com pendência abre a ficha →
   **esperado** `Registrar encontro` + `Agendar encontro` legíveis sem
   overflow horizontal (wrap para a 2ª linha do container `flex-wrap`,
   `:818`) e hit area ≥44px.
9. **Dado** viewport desktop → **esperado** mesma ordem visual; o outline do
   Agendar não compete com o primário (`outline` ≠ `default`).

## Microcopy "oficial = sugestão"

10. **Dado** M autenticado → **quando** abre `/agenda` em qualquer aba
    (minha / por-mentorado / calendário) → **esperado** subheader contendo
    `As datas oficiais do guia são sugestões — vocês combinam a real e
    registram aqui.` (uma vez, no subheader — não repetido por linha/card).
11. **Dado** M na aba `calendario` → **quando** abre a legenda → **esperado**
    linha `As datas oficiais são sugestões — vocês combinam e registram a
    real.` no rodapé da `LegendaAgenda`.
12. **Dado** C na mesma aba (`/agenda` coord) → **esperado** legenda **sem**
    a nota de sugestão (a instrução é operacional do mentor).
13. **Dado** M na ficha da dupla → **quando** olha a seção Encontros →
    **esperado** continua `datas sugeridas pelo guia` (`page.tsx:1315-1321`)
    — sem acréscimo duplicado.

## Demo (`/demo`)

14. **Dado** `/demo` papel mentor, dupla com fixture de registro pendente →
    **quando** abre a ficha → **esperado** `Agendar encontro` outline na
    linha de ações + `Registrar encontro` primário (critério 1 no demo).
15. **Dado** `/demo` papel mentor → **quando** abre `/agenda` → **esperado**
    a microcopy de sugestão no subheader (critério 10 no demo).

## Gates

16. `npx tsc --noEmit` limpo; `npx eslint src/` limpo.
17. `pnpm test` verde (sem teste novo obrigatório — mudança de JSX/copy).
18. e2e demo: spec existente de ficha (`tests/e2e/demo`) asserta critério 14;
    spec de agenda asserta critério 15.
19. e2e app (preview): spec de ficha com fixture `e2e00000-*` asserta
    critérios 1–3 (visível, não no Mais, primário sem pendência).
