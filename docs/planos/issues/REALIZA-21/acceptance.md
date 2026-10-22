# REALIZA-21 — Critérios de aceite

Formato: **dado** (pré-condição) → **quando** (ação) → **esperado**.
Papéis de fixture: mentor da dupla (M), coord (C), supervisor da dupla (S),
mentorado (J).

## Schema

1. **Dado** migration `0106_encontro_intencoes.sql` aplicada → **quando**
   `\d encontro_intencoes` → **esperado** colunas `id, dupla_id, numero,
   texto, feito, feito_em, created_by, created_at, updated_at`; CHECK
   `char_length(texto) between 1 and 280`; índice parcial em `(dupla_id,
   numero) where not feito`.
2. **Dado** a tabela existe → **quando** `select * from pg_policies where
   tablename='encontro_intencoes'` → **esperado** exatamente 2 policies
   (select + for-all), nenhuma mencionando `mentorado` ou `jovem_duplas`.
3. **Dado** item com `feito=false` → **quando** `update encontro_intencoes
   set feito=true` (qualquer caminho) → **esperado** `feito_em ≈ now()`.
   **Quando** `set feito=false` de novo → **esperado** `feito_em = null`.
4. **Dado** insert com `texto=''` ou 281+ chars → **esperado** erro de CHECK,
   nenhuma row.

## Actions (Vitest/integration)

5. **Dado** M autenticado, dupla ativa DPP com cronograma → **quando**
   `criarIntencao(duplaId, 3, "enviar vídeo")` → **esperado** `{ok:true}` e
   row com `numero=3, feito=false, created_by=M`.
6. **Dado** o mesmo → **quando** `criarIntencao(duplaId, 99, "x")` (nº acima
   do teto do cronograma da dupla) → **esperado** `{error:"Escolha um
   encontro da lista."}` e zero insert.
7. **Dado** dupla `pausada`/`encerrada` → **quando** `criarIntencao` →
   **esperado** `{error:"Essa dupla não está ativa."}`.
8. **Dado** C ou J autenticado → **quando** `criarIntencao` → **esperado**
   `{error:"A nota do encontro é do mentor da dupla."}` ou equivalente de papel.
9. **Dado** M de outra dupla → **quando** `marcarIntencao(idDeOutraDupla,
   true)` → **esperado** RLS bloqueia (0 rows afetadas → a action devolve erro
   de "não encontrado", nunca sucesso silencioso).
10. **Dado** `demoAtivo` → **quando** qualquer action → **esperado**
    `{error: DEMO_MSG}` sem escrita.

## UI — ficha (`/duplas/[id]`)

11. **Dado** dupla DPP com encontro 3 sem itens → **quando** M abre a ficha →
    **esperado** bloco `Intenções` colapsável no card do 3º encontro, abaixo
    das Anotações, com copy de vazio e input "Adicionar intenção…".
12. **Dado** o mesmo → **quando** M digita "perguntar do ENEM" + Enter →
    **esperado** item aparece com checkbox desmarcado; após refresh o item
    persiste.
13. **Dado** 2 itens no 3º encontro → **quando** M marca o 1º → **esperado**
    `line-through` + persistência; o sufixo do trigger passa a `· 1 pendente`.
14. **Dado** item pendente no encontro 2 e encontro 3 sem itens → **quando**
    M abre o card do encontro 3 → **esperado** bloco "DE ANTES" com o item
    taggeado `do 2º encontro`, marcável ali mesmo.
15. **Dado** o item de 14 → **quando** marcado feito no card do 3 →
    **esperado** some do "De antes" após refresh e `feito_em` preenchido.
16. **Dado** dupla `encerrada` com itens → **quando** C abre a ficha →
    **esperado** lista visível, sem checkboxes nem input (read-only).
17. **Dado** J autenticado → **quando** qualquer superfície do jovem
    (`/jovem`, `/jovem/agenda`) → **esperado** nenhum texto de intenção em
    nenhum lugar (não existe superfície — critério de ausência).

## UI — Minha agenda (`/agenda`, aba minha)

18. **Dado** dupla com 3 intenções pendentes (mais antiga do encontro 2) →
    **quando** M abre `/agenda` → **esperado** 1 aviso "Intenções em aberto"
    na seção hoje com "3 itens — o mais antigo é do 2º encontro", CTA pra
    ficha.
19. **Dado** todas feitas → **esperado** nenhum aviso `int-*`.
20. **Dado** dupla pausada → **esperado** nenhum aviso (`status !== 'ativa'`
    zera `avisosDaDupla`).

## UI — detalhe do encontro

21. **Dado** encontro com 2 intenções (1 feita) → **quando** C/S abre o
    `EncontroDetalheDialog` → **esperado** bloco "Intenções do mentor" com
    os 2 itens (feito riscado), sem checkbox.

## Casos de borda

22. Remarcação: encontro agendado pra outra data → intenções **permanecem**
    no mesmo `numero` (a chave é o nº do guia).
23. "Não aconteceu" + desfazer: idem — nada muda na checklist.
24. Encontro `realizado` → intenções ainda marcáveis (o gate é a dupla
    ativa, não o status do encontro).
25. Item com 280 chars → aceito; 281 → rejeitado pelo CHECK; espaços só →
    trim vazio → erro da action.
26. Dupla especialista: `numero` limitado ao teto da trilha (mesma regra da
    nota — especialista segue o passo, não tentativa).

## Demo (`/demo`)

27. **Dado** `/demo` papel mentor → **quando** abre ficha da dupla com
    fixture de intenções → **esperado** checklist renderiza, criar/marcar/
    remover funcionam em estado local, nenhum toast `DEMO_MSG`, carry-over
    visível quando houver pendente antiga no fixture.

## Gates

28. `npx tsc --noEmit` limpo; `npx eslint src/` limpo; `pnpm test` verde
    incluindo o teste novo de `avisosDaDupla` (critérios 18–20).
29. `schema-contract` CI verde com `database.types.ts` regenerado após a
    migration no remoto.
30. e2e demo: spec de ficha cobre renderização da checklist (critério 27);
    e2e app: fluxo criar→marcar persiste após reload (critérios 12–13).
