# Auditoria ws34 — seed demo × cenários de semáforo (REALIZA-459)

**Data:** 19/nov/2026 · **Branch:** `chore/seed-cenarios` · **Base:** `staging`
**Método:** `db reset` + `seed:e2e` + `seed:demo` no stack local (`:54321`),
cada dupla `de000000-*` computada por `saudadeDaDupla` + `montarPlanoEmDia`
com os mesmos eventos do cronograma. Veredito: o dataset cobre os 5
gatilhos pedidos e todos evergreen (datas derivadas de `new Date()`).

## Mapa dupla → cenário

| id | dupla | dados | semáforo | sinal principal |
|---|---|---|---|---|
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

## Por que a T3 existe

O `preventivo` só acende quando o oficial da semana está a ≤5 dias e a
dupla não marcou nada. Com calendário de terça (T1/T2), depois que a
terça passa o vazio vira `atraso`, não `preventivo`. A T3 ancora os
encontros no sábado — então de seg a sáb a dupla …0152 mostra o sinal
puro e dom/seg o mesmo buraco relê como atraso-1.

## Verificação (19/nov/2026, quinta)

```
ATEN   -  0150 Mônica × Davi      esp4/fei3  Encontro 4 ainda não aconteceu
RISCO CARD 0151 Elisa × Luna      esp4/fei2  2 encontros em atraso (devidos 3,4)
ATEN   -  0152 Diego × Arthur     esp5/fei5  preventivo — enc 6 sábado sem agendamento
ATEN   -  0301 Sabrina × Pedro    esp6/fei5  Encontro 6 ainda não aconteceu (devido 6)
RISCO  -  0304 Ricardo × Gabriela esp6/fei5  avaliação baixa + dificuldade (+ atraso-6, combinado vencido)
RISCO CARD 0306 Tiago × Lucas     esp6/fei3  3 encontros em atraso (devidos 4,5,6)
ATEN   -  030a Rodrigo × Kaique   esp6/fei6  Encontro realizado sem registro (pend: 5)
OK     -  demais duplas DPP       esp6/fei6  sem sinais
```

Gatilho do card "ficar em dia" (REALIZA-459): ≥2 passos agendáveis →
…0306 (3) e …0151 (2) mostram o card; …0152/…030a/…0304 ficam fora dele
por enquanto (1 ou 0 passos) — os sinais deles testam os outros estados
do semáforo.
