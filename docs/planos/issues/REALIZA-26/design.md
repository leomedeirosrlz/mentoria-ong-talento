# REALIZA-26 — Design / UX

Histórico cronológico de reagendamentos no detalhe do encontro + contagem
discreta na agenda por mentorado. Framework:
`.devin/skills/ux-review/SKILL.md`.

## Persona & JTBD

**Coord/supervisor** — "esse encontro já foi remarcado quantas vezes? por
quem? tá virando padrão?" — a resposta define se há intervenção (o semáforo
já flagra atraso; o **padrão de remarcação** é o sinal qualitativo que faltava).

**Mentor** — "quando a gente combinou mesmo?" — a trilha de datas é a memória
da negociação da dupla. Ele não precisa de tabela — precisa da linha do tempo.

## Hierarquia no `EncontroDetalheDialog`

O dialog já empilha contexto (`encontro-detalhe-dialog.tsx:116+`): status,
datas, motivo atual, nota do mentor. O histórico entra **depois do motivo
atual** — responde a pergunta seguinte natural ("e antes disso?"). Mesmo
chrome `rounded-lg bg-muted/40 px-3.5 py-2.5` do bloco Plano do mentor
(`:186-193`) — consistência = zero custo de leitura.

```
Histórico de agendamento
  · remarcado    12/mai → 19/mai · conflito de agenda · mentor
  · remarcado    05/mai → 12/mai · mentorado pediu    · mentorado
  · agendado     pra 05/mai                          · mentor
```

- Ordem **cronológica reversa** (mais recente em cima) — o que o usuário quer
  saber primeiro é o último movimento.
- Label da ação em peso normal, datas muted, motivo muted, ator muted —
  uma linha, sem hierarquia visual competindo com o motivo atual.
- `motivo` via `MOTIVOS_REAGENDAMENTO` label lookup (`ciclo.ts:185-193`);
  `motivo='outro'` + `motivo_detalhe` → mostra o detalhe entre aspas.
- `ator_papel` via labels de papel; `ator_id null`/`sql_direto` → omite o
  sufixo (não inventar "sistema" — a ausência já diz "fora do app").

## Anatomia da linha

| `acao` | Texto |
|---|---|
| `agendado` | `Agendado pra {formatDiaHora(para)}` (+ ator) |
| `remarcado` | `{formatDiaHora(de)} → {formatDiaHora(para)} · {motivo}` (+ ator) |
| `desmarcado` | `Desmarcado (era {formatDiaHora(de)})` (+ ator) |

`formatDiaHora` de `ciclo.ts` — mesmo formato do resto do dialog
(`:1311-1321` da ficha usa o mesmo). Sem hora redundante: `formatDiaHora` já
inclui.

## Chip "N remarcações" na agenda por mentorado

`agenda-por-mentorado.tsx` — ao lado do nº do encontro na linha, só quando
`count > 1`:

- texto `· N remarcações` (muted, `text-xs`);
- 1 remarcação **não** mostra chip (uma remarcação é normal; o sinal é a
  repetição);
- sem cor de alerta — é informação, não alarme (o semáforo já cuida do risco);
- clicável? Não — o detalhe completo é no `EncontroDetalheDialog`, que já é
  o destino do clique na linha.

## Estados

| Estado | Render |
|---|---|
| Sem histórico | bloco não renderiza (o 1º agendamento já é uma linha; "histórico vazio" é ruído) |
| 1 linha (só `agendado`) | bloco renderiza com a linha única — é informação legítima ("quem agendou") |
| Carregando | o dialog abre com o restante instantâneo; o histórico pode chegar depois — `animate-pulse` muted placeholder ou simples omissão até o fetch (seguir o padrão do componente: se os dados já vêm via prop, sem estado de loading) |
| Fetch falhou / RLS negou | bloco some (query retorna `[]` via RLS sem erro — a UI não distingue "sem histórico" de "sem permissão", e não precisa) |
| Encontro sem row (ainda não agendado) | sem histórico → sem bloco (o dialog nem abre sem `encontros` row) |

## O que NÃO fazer

- Não mostrar como tabela — é linha do tempo, não dados tabulares.
- Não expor ao mentorado nesta versão (decisão de privacidade, ver sdr).
- Não criar alerta/badge separado de "muitas remarcações" — o semáforo da
  dupla já é o canal de risco; o histórico é contexto, não alarme.
- Não colocar na listagem principal (duplas-lista/agenda-minha) — o sinal
  "N remarcações" só na agenda-por-mentorado (onde a coord já olha); nas
  outras listas é poluição.
