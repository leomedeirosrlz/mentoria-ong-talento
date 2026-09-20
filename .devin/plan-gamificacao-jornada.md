# Plano — gamificação da jornada: mapa do ciclo, marcos, ritmo e registro no tempo

Pedido: gamificar a plataforma como **jornada individual da dupla**. Decisões
travadas com o usuário (não reabrir): nunca competição entre duplas, sem
pontos/moedas/prêmios, sem leaderboard, sem comparação visível pro mentor; a
coordenação segue com visão de monitoria (semáforo) — no máximo um agregado
informativo, nunca placar.

Os 4 elementos aprovados: **mapa do ciclo** (trilha de nós na home do mentor e
na ficha da dupla), **marcos** (celebração discreta: 1º realizado, metade,
reta final, ciclo completo — ícone Phosphor, sem confete, sem emoji),
**ritmo** (contagem de realizados consecutivos, só positivo — quebrou, some
quieto) e **registro no tempo** (nó realizado+registro = "completo"; realizado
sem registro = estado intermediário).

> **Alinhamento pós-plano (Thiago):** ritmo/streak **cortado** ("meio inútil")
> — sem chip `Fire`, sem `streak` em `JornadaDupla`. Staff vê a trilha
> read-only na ficha. Verificação visual com dados de exercício na dupla de
> teste. Implementado: "proximo" deixou de ser um `EstadoNoJornada` (não
> sobrescreve a situação real — um limbo como passo atual segue âmbar); é
> `proximoNumero` + anel lime por fora do disco.

## 0. Estado atual (mapa com refs)

**Dados (verificado no remoto via MCP):**
- `ciclo_eventos`: `id, ciclo, tipo, numero, data, data_fim, titulo, fase,
  instrumentos`. **Não existe coluna `faixa`** — só `fase` (texto livre).
- 16 encontros (`numero` 1–16) em **6 fases** (não 4 — o exemplo "fase 2 de 4"
  era hipotético): 1–4 "Criar vínculo e construir o PDM" · 5–7 "Colocar o
  plano em prática" · 8–9 "Consolidar a autonomia" · 10–11 "Aprofundar vínculo
  e aprendizado" · 12–14 "Roda da Vida" · 15–16 "Encerrar e celebrar".
  Agrupamento desbalanceado (4,3,2,2,3,2) e nomes longos — derivar, nunca
  hardcodar.
- Não-encontro: 2 `formacao` (03–04/09, antes do ciclo), 1 `recesso`
  (16/12→04/01), 1 `marco` "Evento de encerramento do programa" (15/01). Não
  são passos da trilha.
- `duplas.iniciada_em` é `date`. Banco: 1 dupla ativa, 0 encontros, 0
  registros — ciclo recém-começado.

**Domínio (`src/lib/ciclo.ts`):**
- `saudadeDaDupla` (ciclo.ts:209) — semáforo com `esperado`, `feitos`,
  `proximo`, `registroPendente`; o "limbo" (agendado vencido sem registro)
  já é modelado (ciclo.ts:214-221).
- `alvoAgendamento` (ciclo.ts:357) — `proximoNumero`, `encontroAlvo`,
  `faltantes`, `cicloCompleto`; janela `>= iniciada_em` já aplicada.
- `totalEncontros` (ciclo.ts:71), `encontroEsperado` (ciclo.ts:76),
  `formatDate/formatDateTime/formatDiaMes` (ciclo.ts:436-477), `toDateStr`,
  `diffDias`.

**Gramática visual já estabelecida (reusar, não inventar):**
- **Rail do ciclo** (`agenda-calendario.tsx:695-747`): trilha horizontal
  1–16 dos encontros **oficiais** — lime cheio = data passada, ring = semana
  atual, muted = futuro, conector lime só no trecho percorrido,
  `overflow-x-auto` + `scrollIntoView` no nó atual. É trilha de **calendário**
  (onde o ciclo está), não de **progresso da dupla** — coexistem, não
  confundir nem unificar.
- **Disco do nº** (`duplas/[id]/page.tsx:486-499`): lime = realizado,
  muted+`line-through` = não aconteceu, muted = futuro.
- **Dots de status** (`corDotEncontro`, `agenda-calendario.tsx:196-202`):
  `bg-[var(--ok)]` realizado+registro · `bg-[var(--warn)]` realizado sem
  registro · `ring-1 ring-muted-foreground/60` agendado ·
  `bg-muted-foreground/40` não rolou. A mini-legenda `ChaveDotsDupla`
  (agenda-calendario.tsx:298) explica os dots onde eles aparecem (PV-2).
- **`TrajetoriaAvaliacoes`** (`trajetoria-avaliacoes.tsx`): 16 dots de
  avaliações — precedente de "mini-trilha por dupla", mas outro dado (notas)
  e com `TOTAL_ENCONTROS = 16` hardcoded (l. 5 — débito, não replicar).
- **Tokens** (`globals.css`): `--brand-lime`, `--brand-ink`, `--ok/--ok-text`,
  `--warn/--warn-text`, `--danger`, `muted`, `border`, `shadow-border`,
  `animate-ping-once` (ping único 700ms — loop infinito é proibido fora o
  shimmer), `animate-enter`, guard global de `prefers-reduced-motion`.
- **Toasts**: sonner com `toast.success/.warning` + `description`; `icon`
  customizável por chamada.
- **Momentos de escrita que viram realizado**: `salvarRegistro`
  (actions.ts:875) e `registrarEncontroRetroativo` (actions.ts:807) — os
  únicos dois caminhos que criam `status=realizado`.

## 1. Decisões

**D1 — Jornada é derivação pura: zero backend, zero migration.** Nenhuma
tabela/coluna (sem `marcos_atingidos`, sem `pontos`), nenhuma action
alterada, nenhuma query nova — `DUPLA_SELECT` já traz `encontros(registro)`,
`iniciada_em`, `status`; `getCicloEventos` já traz fase/número/data. Tudo
deriva em `jornadaDaDupla(dupla, eventos, hoje)` dentro de `ciclo.ts`, junto
dos helpers de domínio. O estado persiste implicitamente: o mapa reflete o
que já está gravado.

**D2 — A trilha é escopada na janela da dupla (`iniciada_em`).** Nós =
encontros oficiais com `numero != null` e `data >= iniciada_em` (mesmo filtro
de `encontroEsperado`/`faltantes`). Encontros oficiais anteriores ao início
da dupla **não aparecem** — buraco no início leria como perda ("você perdeu
4 encontros"), violando o só-positivo. Denominadores (total, metade, reta
final, caption) = tamanho da janela, não 16. `iniciada_em` null → janela
cheia.

**D3 — Gramática de nó reusa a do app; "próximo" é destaque estático + um
ping, nunca pulso infinito.** O spec proíbe loop novo (shimmer é o único) —
"pulsando" vira: anel lime persistente + `aria-current="step"` + legenda
textual, e `animate-ping-once` no mount pra atenção única (mesmo token do
semáforo em risco). Discos numerados `size-6 sm:size-7` com conectores —
mesma família do rail e do `EncontroRow`, só que semântica de progresso:

| Estado do nó | Visual | Quando |
|---|---|---|
| `realizado_completo` | `bg-[var(--brand-lime)] text-[var(--brand-ink)]` | `status=realizado` + `registro` |
| `pendente_registro` | `bg-[var(--warn)] text-[var(--brand-ink)]` | `realizado` sem `registro` |
| `limbo` | `ring-2 ring-inset ring-[var(--warn)]/70 text-[var(--warn-text)]` (vazado) | `agendado` vencido sem `registro` — pode ter rolado; oco = não confirmado, âmbar = precisa de ação |
| `agendado` | `ring-1 ring-muted-foreground/60 text-muted-foreground` | `agendado`/`remarcado` futuro |
| `nao_aconteceu` | `bg-muted text-muted-foreground/60 line-through` | `nao_aconteceu`/`cancelado` |
| `proximo` | `ring-2 ring-[var(--brand-lime)] ring-offset-2 ring-offset-card` + `animate-ping-once` | 1º nó da janela não realizado (o "você está aqui") |
| `futuro` | `bg-muted text-muted-foreground` | demais nós |

Conector entre nós: `h-px flex-1` `bg-[var(--brand-lime)]` quando ambos os
lados são `realizado_completo`/`pendente_registro`/`limbo` (percorrido),
senão `bg-border` — mesma regra do rail.

A distinção `pendente_registro` (âmbar cheio) vs `limbo` (âmbar vazado) é a
mesma oposição fill=aconteceu / ring=incerteza dos dots da agenda. O âmbar
aqui não é punição — é o mesmo "registro pendente" que o semáforo já trata
como `atencao` e que a agenda já pinta de warn.

**D4 — Marcos: 4 limiares sobre `feitos`, com marcador persistente no nó e
toast único por marco.** Limiares derivados (nunca por `numero` fixo — a
jornada pode começar no meio do ciclo):

- `primeiro` — `feitos >= 1` → Flag
- `metade` — `feitos >= ceil(total/2)` (8 de 16) → Medal
- `reta_final` — `feitos >= total - 3` (13 de 16) → FlagCheckered; **só existe
  se `total - 3 > ceil(total/2)`** — na trilha de 5 do especialista (quando
  modelada), `2 > 3` é falso e o marco não entra (metade já cobre o trecho)
- `completo` — `feitos >= total` → Trophy

**Marcador no mapa**: o nó na *posição* do limiar (1, ⌈total/2⌉, total−3,
total) ganha um mini-ícone `size-3.5` do marco acima do disco — **só depois
de atingido**. Antes disso nada é desenhado: marco futuro não vira cadeado
(nada de "locked" = framing de falta).

**Toast**: componente client `MarcoNotifier` (§3) com `localStorage`
(`realiza:marco:{duplaId}` guarda o último `feitos` visto). No mount/mudança
de prop, `marcosEntre(visto, feitos, total)` → dispara **só o marco mais
alto** cruzado (registrar 3 de uma vez = 1 toast, os demais ficam marcados no
mapa); grava o novo baseline. Razões: (a) cobre **todos** os caminhos —
retroativo, follow-up, correção da coordenação — sem tocar actions nem furar
props em 3 dialogs; (b) `localStorage` (não session) dispara o marco feito
pela agenda na próxima visita à home/ficha; (c) storage indisponível → sem
toast, sem erro. Fallback documentado: retornar `feitos` das actions e
disparar nos submit-success — rejeitado por exigir prop drilling e não cobrir
mudança passiva.

**D5 — Ritmo: streak por adjacência de posição, exibido só a partir de 3.**
`streak` = quantidade de nós `realizado*` consecutivos **terminando na
posição do último realizado** (posição na janela, não numero absoluto).
Ex.: fez 1,2,3,5,6 → último realizado na posição 6, anda pra trás 6,5 e para
no buraco 4 → streak 2 → **oculto** (< 3). "Seguidos" = passos sequenciais da
trilha — reposição que deixa buraco quebra honestamente. Chip `Fire` +
"{n} encontros seguidos". Nunca mostra 1–2, nunca mostra "perdeu o ritmo" —
quebrou, o chip some (só-positivo). Esconder em pausada/encerrada: streak é
ritmo ativo; histórico fica nos nós.

**D6 — Fase: derivada dos encontros da janela; caption dinâmica, sem grid de
rótulos.** `fasesDoCiclo` = fases distintas em ordem de primeira ocorrência.
Caption: "Fase {i} de {n} — {nome}" = fase do nó `proximo` (ou do último nó
quando completa). Com 6 fases de nomes longos ("Criar vínculo e construir o
PDM"), rótulo por grupo não cabe no mobile — a separação visual entre grupos
é só um gap maior no conector (`min-w-3` vs `min-w-1.5`) e a fase corrente
vive na caption. Grupos ficam implícitos; nenhum label por segmento na v1.

**D7 — Staff vê a trilha read-only na ficha; toast de marco é só do mentor.**
A ficha (`duplas/[id]/page.tsx`) é a mesma tela pra todos os papéis e a
trilha é visualização **factual** de dados que staff já vê (feitos/total,
status de cada encontro) — não é placar nem comparação entre duplas, então
não fere o princípio; esconder criaria duas fichas. Streak também é fato —
visível. O `MarcoNotifier` só monta quando `souMentor` — celebração é
motivação do mentor; pra staff seria ruído. Dashboard de coord/sup
(`dashboard-coordenacao.tsx`): **zero gamificação** — nem chip de streak, nem
agregado de marcos; monitoria segue semáforo + cobertura.

**D8 — Nós não são interativos na v1.** A trilha é mapa, não navegação —
`role="img"` + `aria-label` + `title` por nó (padrão `SemaforoDot`/
`TrajetoriaAvaliacoes`), `aria-current="step"` no `proximo`. Linkar o nó ao
card do encontro exigiria `id` por número nas rows (hoje só existe
`#registrar-{id}` das pendências) — fica fora, anotado em anti-escopo.

## 2. Derivações novas — `src/lib/ciclo.ts`

```ts
export type EstadoNoJornada =
  | "realizado_completo"   // realizado + registro
  | "pendente_registro"    // realizado sem registro (estado intermediário)
  | "limbo"                // agendado vencido sem registro — pode ter rolado
  | "agendado"             // agendado/remarcado ainda por vir
  | "nao_aconteceu"        // nao_aconteceu/cancelado
  | "proximo"              // 1º não realizado da janela — o passo atual
  | "futuro";              // outline, a caminho

export type MarcoJornada = "primeiro" | "metade" | "reta_final" | "completo";

export type NoJornada = {
  posicao: number;            // 1..total dentro da janela da dupla
  numero: number;             // nº oficial do encontro no ciclo
  evento: CicloEvento;
  estado: EstadoNoJornada;
  encontro: Encontro | null;  // row da dupla pra esse numero
  marco: MarcoJornada | null; // marco cuja posição-limiar é este nó
};

export type JornadaDupla = {
  nos: NoJornada[];
  total: number;              // encontros na janela (pode ser < 16)
  feitos: number;             // nós realizado* na janela
  comRegistro: number;        // dos feitos, com registro entregue
  pendentesRegistro: number;  // pendente_registro + limbo
  streak: number;             // consecutivos terminando no último realizado
  proximoNumero: number | null;  // null quando completa ou inativa
  faseAtual: { indice: number; total: number; nome: string } | null;
  completa: boolean;
  janelaCortada: boolean;     // iniciada_em podou encontros do início do ciclo
};

export function jornadaDaDupla(
  dupla: Dupla,
  eventos: CicloEvento[],
  hoje = new Date()
): JornadaDupla
```

Semântica:

- **Janela**: `tipo==="encontro" && numero!=null &&
  (!iniciada_em || data>=iniciada_em)`, ordenada por `numero`. `janelaCortada`
  = `iniciada_em` excluiu ≥1 encontro oficial.
- **Estado por nó**: `realizado` → `completo`/`pendente` pelo `registro`;
  `agendado`/`remarcado` → `limbo` se `data_hora` < agora e sem registro
  (mesma regra do semáforo, ciclo.ts:214), senão `agendado`;
  `nao_aconteceu`/`cancelado` → `nao_aconteceu`; sem row → `futuro`.
  Depois do mapa, o **primeiro nó não-realizado** vira `proximo`
  (substitui `agendado`/`limbo`/`futuro`/`nao_aconteceu` nesse nó — o passo
  atual pode ser um atraso a recuperar). `proximoNumero` = numero dele;
  null se `completa` **ou** `dupla.status !== "ativa"` (trilha congela, §7).
- **`feitos`** = nós `realizado*` — encontros realizados fora da janela não
  contam (coerente com o denominador).
- **`streak`**: varre de trás pra frente a partir do último nó `realizado*`,
  contando enquanto `estado` for `realizado_completo|pendente_registro`.
  `limbo` e `nao_aconteceu` quebram; `agendado`/`futuro` depois do último
  realizado não afetam (o streak mora no rabo dos feitos).
- **`faseAtual`**: fase do nó `proximo`; completa → fase do último nó.
  `indice`/`total` = posição da fase na lista ordenada de fases da janela.
- **`marcosEntre(antes, depois, total): MarcoJornada[]`** — puro, retorna os
  marcos cujo limiar ∈ (antes, depois]; usado pelo `MarcoNotifier` (e
  testável sem DOM).

Comentário-jusjustificativa no cabeçalho das funções, padrão do arquivo.

## 3. Componentes novos

### `src/components/trilha-jornada.tsx` — `"use client"`

Client porque repete o efeito do rail: `scrollIntoView` no nó `proximo`
quando a strip estoura a viewport (16 nós × ~30px ≈ 470px > 375px mobile),
respeitando `matchMedia("(prefers-reduced-motion: reduce)")` — mesmo padrão
de `agenda-calendario.tsx:449-459`. Props serializáveis:

```ts
{ jornada: JornadaDupla; statusDupla: DuplaStatus }
```

Estrutura:

```tsx
<section aria-label="Jornada da dupla">
  {/* linha overline: rótulo + chip de ritmo à direita */}
  <div className="flex items-center justify-between gap-2">
    <p className="overline-padrão">Jornada</p>
    {streak >= 3 && ativa && chip Fire}
  </div>
  <ol className="flex items-center overflow-x-auto pb-1">
    {nos.map(no => <li className="flex items-center">
      {i>0 && <span aria-hidden conector (gap maior na virada de fase) />}
      <span role="img" aria-label={rotuloNo(no)} title={rotuloNo(no)}
            aria-current={estado==="proximo" ? "step" : undefined}
            className={discoPorEstado}>
        {numero}
        {no.marco && atingido && <IconeMarco size-3.5 acima />}
      </span>
    </li>)}
  </ol>
  {/* caption: contagem + fase + próximo */}
  <p className="text-xs text-muted-foreground">…</p>
  {/* mini-chave — a mesma ideia de ChaveDotsDupla, contextual */}
  <p className="flex gap-x-3 text-xs text-muted-foreground">…</p>
</section>
```

`rotuloNo` monta o label sr por estado (§5). A caption junta: `{feitos} de
{total} encontros` · `Fase {i} de {n} — {nome}` · estado do próximo
("Próximo: 10º — sugerido 11 nov" ou "agendado 11 nov, 19h") · sufixo
`janelaCortada` ("a trilha conta a partir do início da dupla"). Completa:
"Ciclo completo — {total} encontros realizados."

### `src/components/marco-notifier.tsx` — `"use client"`

```ts
{ duplaId: string; feitos: number; total: number }
```

`useEffect`: lê `localStorage["realiza:marco:{duplaId}"]` (default =
`feitos` → baseline sem toast), `marcosEntre(visto, feitos, total)` →
`toast(titulo, { icon: <IconeMarco>, description })` do **mais alto**;
sempre regrava `feitos`. `try/catch` no storage. Ícone por marco: Flag /
Medal / FlagCheckered / Trophy (`@phosphor-icons/react`, `weight="fill"` —
celebração merece o peso cheio; resto do app usa regular/bold). Sem emoji,
sem confete, `duration` default.

## 4. Pontos de montagem

### `src/components/mentor-home.tsx` (server — filhos client ok)

Dentro do `Card` de cada dupla (`map` em l. 68), **primeiro filho de
`CardContent`** (l. 121, antes do banner `semRegistro` l. 122): a trilha é o
mapa do card inteiro e a pendência de registro embaixo já explica o nó
âmbar. No mesmo `map`: `const jornada = jornadaDaDupla(dupla, eventos, hoje)`
+ `<TrilhaJornada jornada={jornada} statusDupla={dupla.status} />` +
`<MarcoNotifier duplaId={dupla.id} feitos={jornada.feitos}
total={jornada.total} />` (invisível, um por dupla).

O contador `{feitos}/{total}` do header ink (l. 110) fica — número compacto
no chrome, estados detalhados na trilha.

### `src/app/(app)/duplas/[id]/page.tsx` (server)

Entre `</header>` (l. 247) e `<div className="grid … lg:grid-cols-…">`
(l. 249): `<section>` de largura total com `<TrilhaJornada>` em superfície
`rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)]`.
`const jornada = jornadaDaDupla(dupla, eventos)` junto dos derivados do topo
(l. 87-91). `<MarcoNotifier>` **só quando `souMentor`** (l. 85) — staff vê a
trilha, não o brinde. Visível pra todos os papéis que abrem a ficha
(coord/supervisor/mentor), read-only pra todos — nada na trilha escreve.

## 5. Microcopy pt-BR

**Overline:** "Jornada" (ficha e home — o contexto "Sua dupla"/o h1 já dá o
dono). **Chip de ritmo:** `{n} encontros seguidos`.

**Labels sr por nó** (sempre "Nº encontro, situação"):
- `realizado_completo`: "{n}º encontro, realizado em {formatDate(realizado_em ?? data_hora)}, registro entregue"
- `pendente_registro`: "{n}º encontro, realizado em {data}, registro pendente"
- `limbo`: "{n}º encontro, agendado para {data}, já passou — falta confirmar"
- `agendado`: "{n}º encontro, agendado para {formatDate(data_hora)}"
- `nao_aconteceu`: "{n}º encontro, não aconteceu"
- `proximo`: "{n}º encontro, próximo passo — sugerido {formatDate(evento.data)}"
- `futuro`: "{n}º encontro, a realizar — sugerido {formatDate(evento.data)}"
- + sufixo " · marco: {metade do caminho|reta final|último encontro}" quando o
  nó carrega marco atingido.

**Caption:** "{feitos} de {total} encontros · Fase {i} de {n} — {fase}" ·
"Próximo: {n}º encontro — sugerido {data}" / "— agendado {formatDateTime}".
`janelaCortada`: " · a trilha conta a partir do início da dupla
({formatDate(iniciada_em)})". Completa: "Ciclo completo — {total} encontros
realizados." Pausada: "Jornada pausada — a trilha segue onde a dupla parou."

**Mini-chave:** "com registro" (dot lime) · "falta registro" (dot warn) ·
"a caminho" (anel).

**Toasts de marco:**
- primeiro — Flag — "Primeiro encontro realizado" / "A jornada de vocês
  começou."
- metade — Medal — "Metade do caminho" / "{feitos} de {total} encontros
  feitos."
- reta_final — FlagCheckered — "Reta final" / "Faltam só {total-feitos}
  encontros pra fechar o ciclo."
- completo — Trophy — "Ciclo completo" / "{total} encontros realizados —
  jornada concluída."

## 6. Acessibilidade

- `<ol>` ordenada — a ordem dos nós é informação (trilha não é só cor):
  cada nó tem número dentro do disco + `aria-label` com situação e data.
- `aria-current="step"` no `proximo`; leitor de tela anuncia "Nº encontro,
  próximo passo…".
- Distinção cor/texto: `nao_aconteceu` tem `line-through`; `limbo` é vazado
  vs `pendente` cheio; `proximo` tem anel + caption textual — nenhum estado
  depende só de hue.
- `title` como redundância (padrão do app — não é o único canal).
- Motion: `animate-ping-once` e o scroll estão sob o guard de
  `prefers-reduced-motion` (ping vira instantâneo; scroll usa `instant`).
- Contraste: número `text-[var(--brand-ink)]` sobre lime/warn (~AA); chips
  de texto em `muted-foreground`/`warn-text` sobre fundo claro.
- Toasts: sonner já anuncia via live region; ícone `aria-hidden`, o texto
  carrega o marco.

## 7. Edge cases

- **Pausada/encerrada**: trilha **congela** — nós mantêm o estado do
  momento; `proximoNumero = null` (sem anel, sem ping — nada pede ação);
  streak escondido (ritmo é ativo); marcos ficam (histórico); caption
  "Jornada pausada"/"Ciclo encerrado". Não some — a ficha continua contando
  o que aconteceu.
- **Dupla criada no meio do ciclo**: janela corta o início (D2); total
  menor, marcos sobre a janela; caption declara o corte.
- **`feitos` fora da janela** (row realizada com data < iniciada_em):
  não é nó nem conta — a trilha mostra só a jornada oficial.
- **Buracos de reposição** (fez 4º sem 3º): nó 3 fica `pendente`/`futuro`
  conforme o caso; `proximo` aponta o buraco — honesto e acionável.
- **Ciclo completo**: trilha cheia, `proximo` null, Trophy no último nó,
  caption de conclusão; chip de streak some (não há mais ritmo a manter).
- **0 encontros**: tudo outline, `proximo` = 1º, sem streak, fase = a do
  nó 1.
- **Cruzamento de vários marcos de uma vez** (retroativo em lote): um toast
  só — o mais alto (D4); os demais ficam no mapa.
- **`feitos` diminuir** (correção da coordenação apagando row): `marcosEntre`
  só dispara em aumento — storage fica no valor maior; marco não "des-atinge"
  (o ícone no nó sai se o nó deixar de ser realizado, o que é correto).
- **`remarcado`/`cancelado`**: enum existe mas as actions só escrevem
  `agendado`/`realizado`/`nao_aconteceu` — mapeados mesmo assim
  (`remarcado`→agendado, `cancelado`→nao_aconteceu).
- **`mentor_especialista` (trilha de 5, backlog)**: a jornada deriva `total`
  dos eventos — funciona automaticamente quando a trilha for modelada;
  `reta_final` se auto-exclui (D4). **Caveat pré-existente**:
  `getCicloEventos` não filtra `ciclo` — com 2 ciclos no banco, TODA a app
  mistura eventos (mesma caveat de `totalEncontros`); a jornada herda, não
  resolve.
- **Sem eventos / sem numero**: `<ol>` com < 2 nós → não renderiza (igual ao
  rail, `encontrosRail.length >= 2`).

## 8. Visão da coordenação/supervisor

- `dashboard-coordenacao.tsx`: **nada entra** — monitoria segue semáforo,
  resumo da semana, cobertura. Nenhum agregado de marcos/streak na v1 (o
  "agregado informativo" permitido fica de possível follow-up, não deste
  plano).
- Ficha da dupla: trilha **visível e read-only** pra staff (D7) — é a mesma
  informação que `feitos/total` + as rows já dão, em forma de mapa; `warn`
  nos nós aponta exatamente o que a coordenação monitora (registro pendente).
- Toast de marco e framing motivacional: só mentor (`souMentor`).

## 9. Anti-escopo (o que NÃO construir)

- Pontos, XP, moedas, níveis, badges colecionáveis, avatar de conquista.
- Leaderboard, ranking, comparação entre duplas — nada em `/duplas`, na home
  de staff, nem agregado competitivo no dashboard.
- Tabela/coluna nova no banco (nada de `marcos`, `streaks`, `pontos`).
- Confete, emoji, animação em loop, som.
- Nós clicáveis/deep-link por número (rows não têm `id` por encontro — v2
  candidata junto com `id`/`#encontro-{n}` nas rows).
- Rótulos de fase por grupo na strip (não cabem — v2 candidata ≥lg).
- Separar "registro tardio" no nó (badge já existe na row — granularidade
  demais pro mapa).
- Gamificação visível pro mentorado (ele não tem conta) ou pra staff.
- Alterar o rail da agenda (trilha de calendário ≠ trilha de progresso) e o
  `TrajetoriaAvaliacoes` (outro dado; alinhar o `TOTAL_ENCONTROS` hardcoded
  dele à janela fica de débito separado).

## 10. Riscos / decisões abertas

- **6 fases reais, não 4** — confirmar que "fase do guia" = `ciclo_eventos.fase`
  como está (sem renomear/curtar nomes). Se o guia tiver divisão oficial em 4
  macro-fases, `fase` precisa de dados novos — alinhar antes de implementar.
- **Streak por posição adjacente vs "semana sem falta"**: a adjacência é mais
  simples e honesta com buracos de reposição; alternativa (toda semana
  elegível com encontro) é mais generosa mas mistura calendário com
  sequência. Proposta: adjacência, limiar 3 — confirmar.
- **`limbo` vazado-âmbar**: distinção sutil; alternativa = mesmo warn cheio
  do `pendente` (um estado visual só pra "precisa de ação"). Leve preferência
  pela distinção (espelha fill/ring da agenda) — revisável em PR.
- **`proximo` com ping-once vs pulso lento contínuo**: spec proíbe loop —
  proposta é anel + ping único; se quiser mais presença, `title`/caption
  resolvem sem animação.
- **Toast via localStorage vs retorno das actions**: notifier cobre todos os
  caminhos e mudança passiva; actions dariam timing exato mas furam 3 call
  sites e perdem o caso "coord corrigiu". Manter notifier — confirmar.
- **`MarcoNotifier` por `souMentor`**: staff não recebe brinde — confirmar.
- **Dados reais vazios** (0 encontros): verificação visual só quando o ciclo
  andar ou com dupla de teste — combinar com Thiago se cria dados de
  exercício (banco é real; não re-seedar).

## 11. Ordem de implementação

1. `ciclo.ts`: `EstadoNoJornada`, `MarcoJornada`, `NoJornada`, `JornadaDupla`,
   `jornadaDaDupla`, `marcosEntre` (+ mapa de limiares).
2. `trilha-jornada.tsx`: strip, estados, caption, chave, scroll ao `proximo`.
3. `marco-notifier.tsx`: storage + toasts.
4. `mentor-home.tsx`: `jornadaDaDupla` no map + montagem no `CardContent`.
5. `duplas/[id]/page.tsx`: seção entre header e grid + `MarcoNotifier` gated.
6. `npx tsc --noEmit` · `npx eslint src/` — ambos limpos.

## 12. Como verificar

- `tsc`/`eslint` limpos; zero queries/actions/migrations novas (diff mostra
  só `ciclo.ts` + 2 componentes + 2 mounts).
- **Estados do nó** (dev com dupla real quando houver encontros, ou dupla de
  exercício): realizado+registro = lime; realizado sem registro = âmbar;
  agendado vencido = anel âmbar; futuro = outline; próximo com anel lime +
  `aria-current`; conector lime só até o último feito.
- **Marcos**: registrar 1º → toast Flag; chegar a 8 → Medal; 13 →
  FlagCheckered; 16 → Trophy; retroativo em lote → 1 toast do mais alto.
  Recarregar: não repete (storage).
- **Ritmo**: 3+ seguidos → chip; quebrar (nao_aconteceu/pular) → some; nunca
  negativo.
- **Fase**: caption muda na virada (encontro 5 = "Fase 2 de 6").
- **Janela**: dupla com `iniciada_em` no meio → trilha começa no primeiro
  encontro elegível + nota do corte; total/marco respeitam a janela.
- **Pausada/encerrada**: trilha congelada, sem anel, sem streak.
- **Papéis**: coord/supervisor veem a trilha na ficha, sem toast, e
  dashboard idêntico a hoje; mentor vê trilha na home e na ficha.
- **A11y**: leitor de tela lê "3º encontro, realizado em 22 de setembro,
  registro entregue"; `prefers-reduced-motion` zera ping e smooth scroll;
  tabulação não para em nós (não-interativos).
- **Mobile**: strip rola horizontal e ancora no `proximo` no mount.
