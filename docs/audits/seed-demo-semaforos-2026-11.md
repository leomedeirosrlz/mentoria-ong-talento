# Auditoria ws34 — seed demo × cenários de semáforo (REALIZA-459)

**Data:** 19/nov/2026 · **Branch:** `chore/seed-cenarios` · **Base:** `staging`
**Método:** `db reset` + `seed:e2e` + `seed:demo` no stack local (`:54321`),
cada dupla `de000000-*` computada por `saudadeDaDupla` + `montarPlanoEmDia`
com os mesmos eventos do cronograma, e conferida na UI com login
`mentor@realiza.test`. Veredito: o dataset cobre os 5 gatilhos pedidos,
todos evergreen (datas derivadas de `new Date()`), e o mentor@ (Otávio,
capacidade 3) passa a ver uma dupla em atenção e uma em risco — o card
"Para ficar em dia" abre na conta dele.

## Mapa dupla → cenário

| id | dupla | dados | semáforo | sinal principal |
|---|---|---|---|---|
| …0300 | **Otávio × Ana** (mentor@) | 6 realizados, enc 5 sem registro, enc 7 marcado | **atenção** | `Encontro realizado sem registro` — estável a semana toda; a âncora segue completa |
| …030c | **Otávio × Larissa** (mentor@) | 3 realizados, encs 4–6 devendo | **risco** + card | `2–3 encontros em atraso` — 2 passos agendáveis dom–seg, 3 de terça em diante |
| …0301 | Sabrina × Pedro Lucas | 5 realizados + registro, enc 6 vencido sem row | **atenção** | `Encontro 6 ainda não aconteceu` (dom–seg lê `preventivo`) |
| …0306 | Tiago × Lucas | 3 realizados, encs 4–6 devendo | **risco** + card | `3 encontros em atraso` — 3 passos agendáveis no "ficar em dia" |
| …030a | Rodrigo × Kaique | enc 5 realizado >24h sem registro | **atenção** | `Encontro realizado sem registro` — estável a semana toda |
| …0304 | Ricardo × Gabriela | último registro (enc 5) `baixa` + dificuldade, enc 7 marcado | **risco** | `Avaliação baixa e dificuldade de organização/rotina` — combo sempre ligado; a atraso-1 do 6º e o combinado vencido somam de terça em diante |
| …0152 | Diego × Arthur (T3, sábado) | 5 realizados, enc 6 = sábado da semana sem row | **atenção** | `O 6º encontro é sábado e ainda não foi agendado` — preventivo seg–sáb, `atraso-1` dom/seg |
| …0151 | Elisa × Luna (T2) | 2 realizados, encs 3–4 devendo | **risco** + card | `2 encontros em atraso` — o sem_data do "Para acompanhar" |
| …0150 | Mônica × Davi (T2) | 3 realizados, enc 4 vigente agendado p/ sábado | **atenção** | `Encontro 4 ainda não aconteceu` — reposição marcada não cobre a oficial |

Congeladas (pausada/concluída/encerrada: …0307, 0308, 030b, 030e, 030f,
trilha2) e a …0302 (apoio aberto — fora do semáforo) seguem `ok`, como o
mapa no topo do `scripts/seed-demo-staging.mjs` documenta.

## Por que a d13 perdeu o enc 4–6 (e não levou o combo)

O gatilho em falta era o da visão do **mentor@**: o card só abre com ≥2
passos agendáveis (`devidos`), então o combo baixa+dificuldade — que já
existe na …0304 e não rende passo nenhum — não resolveria. Com
`feitos: 3` a d13 deve os encs 4–6: ≥2 atrasos em qualquer weekday (o
esperado é 5 antes da terça, 6 depois) → risco estável e card aberto a
semana toda. A …0300 ficou de fora disso de propósito: ela carrega a
avaliação pendente da Ana (link do enc 6), o PDM e a jornada completa —
um atraso removeria a row do enc 6 e derrubaria esses estados. O
`pendente: 5` dá a atenção sem tocar em mais nada (mesma receita da
…030a). Capacidade intacta: o Otávio segue com 2 duplas de 3.

## Verificação (19/nov/2026, quinta)

`saudadeDaDupla` + `montarPlanoEmDia` sobre o stack local:

```
ATEN   -    0150 Mônica × Davi            esp4/fei3 agend:0  Encontro 4 ainda não aconteceu
RISCO CARD 0151 Elisa × Luna              esp4/fei2 agend:2  2 encontros em atraso
ATEN   -    0152 Diego × Arthur           esp5/fei5 agend:0  preventivo — enc 6 sábado sem agendamento
ATEN   -    0300 Otávio × Ana             esp6/fei6 agend:0  pend:5 Encontro realizado sem registro
ATEN   -    0301 Sabrina × Pedro          esp6/fei5 agend:1  Encontro 6 ainda não aconteceu
RISCO  -    0304 Ricardo × Gabriela       esp6/fei5 agend:1  avaliação baixa + dificuldade (+2 sinais)
RISCO CARD 0306 Tiago × Lucas             esp6/fei3 agend:3  3 encontros em atraso
ATEN   -    030a Rodrigo × Kaique         esp6/fei6 agend:0  pend:5 Encontro realizado sem registro
RISCO CARD 030c Otávio × Larissa          esp6/fei3 agend:3  3 encontros em atraso
OK     -    demais duplas DPP                          sem sinais (pausada/concluída/encerrada congeladas)
```

UI (`next dev :3200` + login `mentor@realiza.test`):

```
OK  home lista Larissa e Ana (risco primeiro na ordenação)
OK  d13 ficha: badge "Risco" + "3 encontros em atraso"
OK  d13 card "Para ficar em dia" visível, 3 passos (4º→20/11, 5º→27/11, 6º→04/12)
OK  d1 ficha: badge "Atenção" + "Encontro realizado sem registro"
OK  d1 sem card (0 passos agendáveis — a pendência tem superfície própria)
```

Gatilho do card "ficar em dia" (REALIZA-459): ≥2 passos agendáveis →
…030c (2–3), …0306 (3) e …0151 (2) mostram o card; …0152/…030a/…0300/
…0304 ficam fora dele por enquanto (1 ou 0 passos) — os sinais deles
testam os outros estados do semáforo.
