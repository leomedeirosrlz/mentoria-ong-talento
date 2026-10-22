# REALIZA-71 — SDD

## Onde a agregação vive

**A. Dentro do formulário 360** — injetar a série no contexto da resposta.
Rejeitada: o form oficial é imutável (`sistema=true`, campos seed 0042 —
vinculo/evolucao_jovem/pdm_roda/regularidade/experiencia_programa/
apoio_coordenacao/o_que_leva/melhorar/disponivel_proximo_ciclo/capacidade);
misturar agregado no payload da resposta sujaria um instrumento
padronizado.

**B. Superfície adjacente** (escolhida) — o agregado aparece onde a 360 é
consumida: `ResumoJornadaSection` (relatório print) +
`encerramento-dupla.tsx` (checklist). A resposta 360 segue pura; o leitor
vê a série ao lado. É também a leitura mais útil: o agregado serve mesmo
sem 360 respondida.

**C. View/RPC de agregação** — `dupla_avaliacao_resumo` definer. Só se a
query em camadas ficar custosa; começar em TS (a série é ≤16 linhas) —
YAGNI. Se o painel coord um dia precisar de N duplas, aí vira RPC
(não-bloqueante).

## Modelo de dados

Nenhum. Leitura de `avaliacoes_encontro` (0071) + `registros.avaliacao`
— ambos existem com RLS correta.

## Contratos

```ts
// src/lib/avaliacao-jornada.ts [NOVO] — puro, testável
agregaJornada(avaliacoes, registros): JornadaAvaliacaoResumo
// queries.ts — o fetch do resumo ganha a série do jovem
//   (escopo: RLS já filtra; mentor recebe a quantizada existente)
```

## Invariantes

1. `avaliacao_visivel_mentor=false` na avaliação → nunca entra em bloco
   visto pelo mentor (a quantização já esconde; a série crua jamais é
   servida a ele — a query do mentor **não** seleciona
   `avaliacoes_encontro` cru).
2. Média exibida = `estrelas` 1–5; `sentimento`/`avancei`/`temas` são
   qualitativos (frequência, não média).
3. Bloco só aparece com ≥1 avaliação; 360 não respondida não esconde o
   agregado (ele é da jornada, não da 360).

## Performance

≤16 rows por dupla — join em `encontros` pelo `encontro_id`; sem query
nova se o fetch da ficha já traz `avaliacao_jovem` (verificado parcial:
`queries.ts:348` já embute `avaliacoes_encontro(*)` numa seleção — ligar
ao resumo).
