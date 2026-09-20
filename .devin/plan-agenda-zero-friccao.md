# Plano — agenda 0 fricção: agendar/registrar encontro no detalhe do dia

Pedido: "a agenda ainda não tem a opção de marcar encontro/registrar encontro
de forma 0 fricção" + bug: erro de data passada aponta "'Registrar encontro'",
controle que não existe (o real é "Registrar passado", só na ficha da dupla).

Hoje `/agenda` é só leitura: calendário mensal, detalhe do dia com eventos do
ciclo + encontros das duplas + `NotaEncontro`. Os dados pra agir já chegam na
página (`getDuplas` RLS-scoped traz `encontros`, `status`, `iniciada_em`,
`notas` — `queries.ts:31-49`); falta só a superfície de ação.

## 1. Decisões

**D1 — CTAs no detalhe do dia, por contexto (só mentor; coord/sup seguem em
leitura).** O domínio é explícito: "quem agenda é a dupla · coordenação monitora
e faz nudge"; o nudge já vive no dashboard e na ficha (`NudgeButton`). v1 não
abre escrita pra staff na agenda — a cobertura de encontros já é a superfície
de monitoramento dela.

Regra por tipo de dia (`selecionado` vs `hoje` são strings "YYYY-MM-DD" no fuso
SP — comparação lexicográfica basta, sem `new Date()`):

- **Dia com encontro oficial Nº**: dentro do bloco do evento, entre a cobertura
  e as anotações, uma linha de ação por dupla ativa:
  - sem row Nº e `e.data >= hoje` → `AgendarEncontroDialog` (`numero=N`,
    `atual=null`, `sugerido=e.data`) — "Agendar encontro";
  - sem row Nº e `e.data <= hoje` e Nº ∈ faltantes → `RegistrarRetroativoDialog`
    (`numeroInicial=N`, `quandoPadrao=e.data`) — "Registrar passado";
  - row Nº `agendado`/`remarcado` → mesmo dialog com `atual=row` — "Remarcar";
  - realizado/`nao_aconteceu` → sem CTA (registro pendente já deep-linka pela
    `EncontroDuplaRow`).
- **Dia sem encontro oficial** (qualquer outro dia, inclusive
  formacao/recesso/marco): bloco de ações no rodapé do detalhe (depois de
  `itensDupla`), uma linha por dupla ativa:
  - `selecionado >= hoje` → "Agendar encontro" (`numero=alvo.proximoNumero`,
    `atual=alvo.encontroAlvo`, `sugerido=selecionado` — o dia clicado É a
    sugestão: a fricção zero está aqui). Some se `alvo.cicloCompleto`;
  - `selecionado <= hoje` e `faltantes.length > 0` → "Registrar passado"
    (`faltantes=alvo.faltantes`, `quandoPadrao=selecionado`);
  - hoje satisfaz os dois → os dois CTAs.
- `EncontroDuplaRow` é `<Link>` inteiro — não dá pra aninhar trigger de dialog.
  Os CTAs moram no bloco do evento e no rodapé, nunca dentro da linha.

**D2 — Multi-dupla: um CTA por dupla, rotulado pelo mentorado.** O padrão já
existe no mesmo painel: `NotaEncontro` ganha `rotulo={d.mentorado.nome}` quando
`duplasAtivas.length > 1`. Igual: com 1 dupla, botão nu; com >1, cada linha
carrega "· {mentorado.nome}". Sem select nem picker — mais um diálogo seria o
oposto de 0 fricção.

**D3 — O bug: fechar o caminho, não só corrigir o texto.** Adotado: o
`AgendarEncontroDialog` vira os dois. Sem `atual`, `min` sai do input e uma
data passada no submit chama `registrarEncontroRetroativo` (numero sem row ≡
"aconteceu sem agendar" — semântica exata). Sucesso replica a coreografia do
retroativo: toast "Encontro registrado — agora complete o follow-up." +
`push('/duplas/{id}#registrar-{id}')` + `realiza:hash` + refresh — o mentor
cai direto no follow-up, que é o desfecho certo. Com `atual`, data passada
segue proibida (mover agendado pro passado esconde atraso) e aí o erro
reordenado aponta o caminho certo ("registre como foi" / "não aconteceu" na
ficha). Link no toast — descartado: `toast.error` recebe string e o controle
de destino não está montado pra receber navegação.

**D4 — URL: `?dia=` vale, dialog aberto não.** `?dia=YYYY-MM-DD` (searchParam
server-side, validado por regex) pré-seleciona dia+mês — habilita deep-links
"ver na agenda" futuros e preserva contexto em reload. Estado de dialog aberto
fica fora da URL; `#` segue reservado ao contrato `#registrar-{id}` da ficha.

**D5 — Derivação única.** `proximoNumero`/`encontroAlvo`/`faltantes` já existem
duplicados em `duplas/[id]/page.tsx` e `mentor-home.tsx`. Extrair
`alvoAgendamento(dupla, eventos, hoje?)` em `ciclo.ts` e a agenda consome o
mesmo helper — três superfícies, uma regra.

## 2. Mudanças por arquivo

### `src/lib/ciclo.ts` — helper novo

```ts
export type EncontroFaltante = { numero: number; dataSugerida: string };
export type AlvoAgendamento = {
  proximoNumero: number;            // saude.proximo?.numero ?? 1º não realizado (cap total)
  encontroAlvo: Encontro | null;    // row real do nº — o que o dialog edita
  sugeridoProximo?: string;         // data oficial do nº (YYYY-MM-DD)
  faltantes: EncontroFaltante[];    // oficiais vencidos, >= iniciada_em, sem row
  cicloCompleto: boolean;           // feitos >= total — gate do CTA de agendar
};
export function alvoAgendamento(dupla: Dupla, eventos: CicloEvento[], hoje = new Date()): AlvoAgendamento
```

Corpo = a fusão fiel dos dois trechos existentes (ficha e mentor-home).
Semântica idêntica: `saude.proximo` primeiro, senão primeiro não-realizado;
`faltantes` = encontros oficiais `data <= hojeStr && >= iniciada_em && !comEncontro`.

### `src/lib/actions.ts`

- **`agendarEncontro`**: mover o fetch de `existente` pra antes do check de
  data e bifurcar a mensagem:
  - com row: `"Essa data já passou — se o encontro aconteceu, registre como foi
    ou marque 'não aconteceu' na ficha da dupla."`
  - sem row: `"Essa data já passou — use 'Registrar passado' na ficha da dupla
    ou na agenda do dia."`
  Ambas nomeiam controles que existem — corrige o bug reportado.
- **`revalidatePath("/agenda")`** em `agendarEncontro`,
  `registrarEncontroRetroativo`, `marcarNaoAconteceu`, `desfazerNaoAconteceu` e
  `salvarRegistro` — todos mudam o que os dots da agenda mostram;
  `salvarNotaEncontro` é o precedente.

### `src/components/agendar-encontro-dialog.tsx`

- Prop opcional `trigger?: React.ReactElement` — default = o `<Button>`
  atual, mesmo padrão do `RegistrarRetroativoDialog`. Call sites existentes
  intocados.
- Dual-submit (só `!atual`): ler `data_hora` do FormData no submit;
  `!atual && data <= agora` → `registrarEncontroRetroativo(duplaId, numero,
  local)`; sucesso → a mesma coreografia do retroativo (toast, fecha, push
  `#registrar-`, dispatch `realiza:hash`, refresh).
- `min`: remover quando `!atual` (data passada é input legítimo agora); com
  `atual` a lógica de `minimo` fica igual.
- Afordância do modo duplo: `valorData` em state (o `onChange` já existe);
  caption `text-xs text-muted-foreground` sob o campo quando `!atual`: "Se o
  encontro já aconteceu, escolha a data real — ele entra como realizado.";
  botão submit alterna "Confirmar agendamento" ↔ "Registrar encontro" conforme
  `valorData <= agora`. Resetar `valorData` no `onOpenChange`.
- `origem`/`link` no ramo retroativo são ignorados (o encontro nasce
  `origem:"externo"`, sem link — realizado não precisa de link de chamada) —
  o caption cobre a expectativa.

### `src/components/registrar-retroativo-dialog.tsx`

- `EncontroFaltante` vira import de `@/lib/ciclo` (o tipo sai daqui).
- `numeroInicial?: number` — ao abrir: se `faltantes` contém o nº,
  `escolherNumero(String(numeroInicial))`.
- `quandoPadrao?: string` ("YYYY-MM-DD") — em `escolherNumero`, `pre` usa
  `quandoPadrao ?? f.dataSugerida`. O dia clicado na agenda é a prior forte de
  "quando foi"; quem escolher outro nº ainda edita o campo.
- Ambos opcionais: ficha e home não mudam.

### `src/components/agenda-calendario.tsx`

- `const acoesPorDupla = useMemo(() => ehMentor ? new Map(duplasAtivas.map(
  (d) => [d.id, alvoAgendamento(d, eventos)])) : new Map(), […])`.
- Bloco do evento oficial (depois da cobertura, antes das `NotaEncontro`):
  `ehMentor && e.tipo==="encontro" && e.numero!=null` → `duplasAtivas.map` com
  a regra de D1. >1 dupla → sufixo `· {d.mentorado.nome}` no trigger.
- Rodapé do detalhe (após `itensDupla`): `ehMentor && duplasAtivas.length>0 &&
  numerosOficiais.size===0` → seção com overline + uma linha por dupla com os
  CTAs de D1. Hairline `border-t pt-4` quando já há conteúdo.
- `?dia=`: prop opcional `diaInicial?: string | null`; os initializers de
  `mes` e `selecionado` consultam ele primeiro (fora da janela, cai no fluxo
  atual).

### `src/app/(app)/agenda/page.tsx`

- `{ searchParams }` → `diaInicial` validado por `/^\d{4}-\d{2}-\d{2}$/` → prop
  no `AgendaCalendario`. Zero queries novas — `duplas` já vem completo.
- (Opcional) subtítulo menciona a ação pra mentor: "…sempre às terças-feiras —
  toque num dia pra agendar ou registrar."

### Call sites antigos (dedup, sem mudança de comportamento)

- `duplas/[id]/page.tsx` → `const alvo = alvoAgendamento(dupla, eventos)`;
  `podeRetroativo` vira `souMentor && ativa && alvo.faltantes.length>0`.
- `mentor-home.tsx` → idem (mantém `semRegistro` local).

## 3. Ordem de implementação

1. `ciclo.ts`: `EncontroFaltante` + `alvoAgendamento`.
2. `actions.ts`: reorder do `existente` + copy do erro; `revalidatePath("/agenda")` nas 5 actions.
3. `agendar-encontro-dialog.tsx`: `trigger` + dual-submit + caption/label.
4. `registrar-retroativo-dialog.tsx`: `numeroInicial`/`quandoPadrao` + import do tipo.
5. `agenda-calendario.tsx` + `agenda/page.tsx`: CTAs + `?dia=`.
6. Dedup nos call sites da ficha/home.
7. `npx tsc --noEmit` · `npx eslint src/`.

## 4. Riscos / edge cases

- **Permissões**: as actions não checam papel (RLS faz). Coord tem RLS de
  escrita ampla, mas a UI nunca expõe os CTAs (`ehMentor` gate) — decisão de
  domínio preservada.
- **Dupla pausada/encerrada**: `duplasAtivas` exclui as duas → zero CTAs.
  Server cobre: `agendarEncontro` rejeita `!= ativa`; `registrarEncontroRetroativo`
  rejeita só `encerrada` — assimetria já existente, mantida (pausada com
  encontro que rolou pode registrar).
- **`atual` + `sugerido`**: quando há row, o dialog abre com `valorAtual` —
  remarcar mostra a data real marcada, não o dia clicado.
- **`min` removido (`!atual`)**: data passada vira retroativo por dentro — o
  erro fica inalcançável pela UI no caso reportado; server segue guarda.
- **Fuso**: decisões de dia em string SP; `datetime-local` naïve → server
  interpreta -03:00 (`parseDataHora`).
- **`quandoPadrao < iniciada_em`**: server rejeita ("antes do início da
  mentoria") — prefill segue útil, erro claro.
- **Form de registro (follow-up) não entra na agenda**: o push pra
  `#registrar-{id}` na ficha é o padrão estabelecido e continua sendo o
  desfecho dos dois fluxos.
- **mentor_especialista** (trilha 5 encontros, backlog): helper usa
  `totalEncontros`/`max(numero)` — mesma caveat de todo o app.

## 5. Como verificar

- `npx tsc --noEmit` · `npx eslint src/` limpos.
- **Bug**: abrir "Agendar encontro", escolher data passada → cria realizado e
  cai no follow-up (`/duplas/{id}#registrar-{id}`) — sem erro. Com `atual`,
  data passada → erro novo que nomeia controle real.
- **Matriz de dia** (mentor, 1 e 2 duplas): terça oficial futura sem row →
  "Agendar encontro" prefilled 19h; terça oficial passada sem row →
  "Registrar passado" com nº pré-selecionado; dia vazio futuro → "Agendar";
  dia vazio passado com faltante → "Registrar passado" com a data do dia;
  hoje → ambos; dia com row agendado → "Remarcar".
- **Papéis**: coord/supervisor veem agenda idêntica a hoje; mentor sem dupla
  ativa → sem CTAs.
- **`?dia=`**: `/agenda?dia=2026-11-10` abre novembro com o dia selecionado.
- **Revalidação**: agendar/registrar a partir da agenda atualiza os dots sem
  reload manual.
