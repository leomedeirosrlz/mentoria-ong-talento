# REALIZA-21 — Software design

Checklist de intenções por encontro. Decisão central: **tabela nova
`encontro_intencoes`** [NOVO], não extensão de `encaminhamentos` nem flag em
`encontro_notas`.

## Alternativas consideradas

### A) Estender `encaminhamentos` (descartada)

`encaminhamentos` (`0001_init.sql:95-106`) é o modelo dos **combinados**:
bilateral (`responsavel` mentor|mentorado), nasce do registro
(`registro_id`), tem `prazo`, o jovem lê via view `jovem_encaminhamentos`
(`0070`) e marca feito via `marcar_combinado`. Encaixar intenções exigiria:
nullable `responsavel` ou valor novo; um discriminador (`tipo`/`origem`);
excluir o tipo novo da view do jovem (intenção é privada do mentor); ignorar
`prazo` (intenção é escopada por encontro, não por data); e reinterpretar
`registro_id` nulo como "veio antes do registro" — que já é estado legítimo do
combinado. Resultado: semântica dos dois conceitos degradada nas duas
superfícies.

### B) Campos em `encontro_notas` (descartada)

`encontro_notas` é um row único `texto` por `(dupla_id, numero)` — checklist
exige N itens com estado próprio; jsonb de itens dentro da nota quebraria a
simplicidade do autosave de texto livre e impediria queries por pendência
(`where not feito`).

### C) `[NOVO] encontro_intencoes` (escolhida)

Espelha `encontro_notas`: chave `(dupla_id, numero)` **de propósito** — a
intenção pertence ao nº do guia, não ao row físico de `encontros`. Consequência
direta: remarcar, marcar "não aconteceu" ou desfazer **não toca** a checklist;
o item segue o número (mesmo comentário-justificativa da 0015). RLS idêntica
à nota (mentor escreve na própria dupla; coord tudo; supervisor lê; jovem
nunca) — a intenção é plano do mentor e pode citar o jovem ("perguntar da
briga com o pai"), então não pode vazar pra `jovem_encaminhamentos`.

## Modelo de dados

```sql
encontro_intencoes (
  id uuid pk default gen_random_uuid(),
  dupla_id uuid not null references duplas on delete cascade,
  numero smallint not null,
  texto text not null check (char_length(texto) between 1 and 280),
  feito boolean not null default false,
  feito_em timestamptz,          -- carimbo da transição; trigger, não caller
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

- **Sem `encontro_id`**: o row físico do encontro pode nem existir (intenção
  anotada antes de agendar — como a nota). `numero` é a âncora.
- **Sem enum de status**: `feito`+`feito_em` cobre o ciclo; "pendente" é
  `feito=false` derivado (a casa já evita enum-fantasma — ver o comentário de
  `jovem-combinados.tsx:16` sobre `'atrasado'`).
- **`feito_em` por trigger** `before update`: `feito false→true` carimba
  `now()`; `true→false` limpa. Idempotente independente do caller (action,
  PATCH futuro, coord corrigindo pelo painel).
- **Trigger `touch_updated_at`** — a função já existe (usada em
  `0015_encontro_notas.sql:46-48`).
- Índices: `(dupla_id)` e parcial `(dupla_id, numero) where not feito` — o
  carry-over e o aviso consultam exatamente esse recorte.

## Integrações

| Superfície | Como lê | Escreve? |
|---|---|---|
| Ficha `EncontroRow` (`page.tsx:1689-1698`) | `dupla.intencoes` embed no `DUPLA_SELECT` (`queries.ts:342-351`) | mentor: criar/marcar/remover |
| Carry-over (mesmo card) | `intencoes` com `numero < passo.numero && !feito` | marca ali mesmo |
| Minha agenda `avisosDaDupla` (`agenda-minha.ts:304`) | derivação pura sobre `d.intencoes` | — |
| `EncontroDetalheDialog` (`:186-193`) | mesmo embed, read-only | — |
| Demo | `client-stub.ts` case + fixtures em `data.ts` | UI local, sem action |

## Actions (contrato `{error}`/`{ok}`)

- `criarIntencao(duplaId, numero, texto)` — guardas idênticas a
  `salvarNotaEncontro` (`actions.ts:2985-3035`): papel mentor (dpp|esp), dupla
  `ativa`, `cronograma_id` presente no DPP, `numero` dentro do teto do
  cronograma da dupla. `texto` 1–280 após trim.
- `marcarIntencao(id, feito)` — update direto por id; RLS escopa.
- `removerIntencao(id)` — delete por id; RLS escopa.

Sem RPC definer: a policy `for all` do mentor já cobre os três verbos (não há
transição que precise de privilégio elevado — diferente de
`agendar_encontro_mentorado`/`marcar_combinado`, que existem porque o jovem não
tem grant/policy na tabela base).

## Invariantes

- Intenção **nunca** aparece pro mentorado (nenhuma view/RPC do jovem toca a
  tabela — mesmo contrato de `encontro_notas`).
- Remarcar/"não aconteceu"/desmarcar um encontro **não altera** intenções (a
  chave é `numero`, não `encontro_id`).
- Encerrar/pausar dupla congela a checklist: as actions barram por
  `status !== 'ativa'`; o componente entra em `somenteLeitura`.
- `realizado` segue imutável (0043) — intenções de encontro já realizado
  continuam marcáveis: "enviar vídeo depois do encontro" é justamente o caso
  de uso. O gate é `dupla.status`, não o status do encontro.

## Performance

- Embed `intencoes:encontro_intencoes(*)` no `DUPLA_SELECT` — cardinalidade
  baixa (alguns itens por encontro); mesmo peso do embed `notas` já existente.
- O aviso da agenda é derivação pura no array já buscado — zero query extra.
- Sem N+1: nenhuma tela itera chamando query por encontro.

## Questões em aberto

Nenhuma bloqueante. (Limite de 280 chars por item é escolha editorial —
checkbox não é textarea; ajustável na migration se o Thiago quiser mais.)
