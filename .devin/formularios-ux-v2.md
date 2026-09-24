# Formulários UX v2 — paradigma Google Forms

Sprint 2 de UX em formulários. Relatórios de 3 críticos (público, builder, coord)
consolidados aqui: o que entra, em qual frente, e o que fica de fora.

**Princípio:** adotar a *estrutura/interação* do GForms (que os usuários já sabem
usar), mantendo a linguagem visual Realiza (lime/graphite, radius, Phosphor).
Copy pt-BR. Sem mudança de schema ou contrato de actions — salvo onde indicado.

## Seleção — entra agora

### Público (`/f/[token]`) — Frente A

1. **Um card por pergunta + card de título** (ALTA): hoje é um card único
   gigante. Separar: card de título (Olá/h1/meta/descrição/privacidade) e cada
   `CampoRenderer` dentro de `rounded-xl bg-card shadow-[var(--shadow-border)]
   p-4 sm:p-5`. Gap entre cards `space-y-3`. `data-campo` sobe pro wrapper (o
   scrollIntoView de erro continua funcionando).
2. **Faixa lime no card de título** (MÉDIA): `h-1.5` na borda superior com
   `overflow-hidden` — ecoa `themeColor` sem clonar Material.
3. **Progresso standalone sticky** (MÉDIA): sai de dentro do card; pill
   `sticky top-2 rounded-full bg-card/90 backdrop-blur` com barra + "N de M".
   Manter `role="progressbar"`/`aria-valuetext`. Safe-area: `top-[max(0.5rem,
   env(safe-area-inset-top))]`.
4. **Label da pergunta 15–16px** (ALTA): `Rotulo` vai de `text-sm` pra
   `text-[15px] sm:text-base font-medium leading-snug`. Manter `N.` muted +
   `(opcional)`.
5. **Erro = card contornado** (MÉDIA): um tratamento só — `ring-2
   ring-destructive/60` no card + `ErroCampo`. Remove os rings internos
   divergentes (segmento, `p-2` do multi_select que causa layout shift, borda
   do checkbox). Elimina o shift de 8px.
6. **Limpar banner ao corrigir** (MÉDIA, bug de estado): quando o mapa de erros
   esvaziar e `erro` for o de validação → `setErro(null)`. Não limpar erro de
   servidor/rede.
7. **Fill lime no selecionado** (MÉDIA): `sim_nao`/`escala_1_5` selecionado =
   `has-checked:bg-primary has-checked:text-primary-foreground` (manter
   `has-focus-visible:ring-3` — foco ≠ seleção; manter redundância em forced-
   colors). Checkbox do multi_select `size-5 rounded` + `active:bg-muted` na
   linha.
8. **Remover âncoras hardcoded da escala** (MÉDIA): "Muito ruim/Muito bom" são
   semanticamente errados pra metade das perguntas e a coord não pode mudar.
   Os números 1–5 já comunicam — remover as pontas (labels por campo ficam no
   backlog como schema novo).
9. **`aria-describedby` no fieldset, uma vez** (MÉDIA): hoje cada radio/checkbox
   do grupo anuncia "inválido + mensagem". Só no primeiro input ou no fieldset.
10. **Linha que ensina a convenção** (MÉDIA): no card de título — "Você pode
    pular as perguntas marcadas (opcional)." Não adotar `*` vermelho (quebra a
    convenção da casa, marcada como decisão certa).
11. Misc: `scrollIntoView({block:"center"})` determinístico no sucesso;
    `env(safe-area-inset-*)` no `px` do main (padrão do onboarding); submit
    `h-11 md:h-10`; botão Enviar `disabled` em `preview`; "Instrumento oficial"
    vira chip separado da meta line; meta sem quebrar em 2 linhas no mobile.

### Builder — Frente B

Anatomia alvo do card (GForms traduzido):

```
┌──────────────────────────────────────────┐
│ [ enunciado — flex-1 ]   [ tipo ▾ w-44 ] │
│ [ linhas de opção: ○ texto ✕ ]           │
│ [ ou mock estático do tipo ]             │
│ ──────────────────────────────────────── │
│ ⧉ dup   ↑   ↓   🗑          ◯ Obrigatória│
└──────────────────────────────────────────┘
```

1. **Opções como lista de linhas** (P1 — a maior divergência): mata a textarea
   "uma por linha". `DraftCampo.opcoes: string → string[]` (só client — payload
   já emite array). Linha = marcador do tipo (`Circle`/`CheckSquare`) + Input +
   `X` ghost; "Adicionar opção" ghost no fim; Enter cria+foca próxima; cap 30
   desabilita o botão.
2. **Overline "PERGUNTA N" fora** (P1): decoração sem função + slop tipográfico.
   O enunciado vira o topo. Erros ancoram no card.
3. **Ações pro rodapé** (P1): hoje ↑↓🗑 ficam antes do input na tab order.
   Rodapé `border-t`: esquerda duplicar/mover/excluir, direita toggle.
4. **Enunciado + tipo na mesma linha** (P2): `flex gap-3`, `flex-col` mobile.
5. **Switch "Obrigatória"** (P2): criar `ui/switch.tsx` sobre
   `@base-ui/react/switch` (já instalado). Checkbox cru morre.
6. **Duplicar** (P2): `Copy` no rodapé, insere em i+1 com **`novoId()`** —
   respostas apontam pro id, duplicar id corrompe leitura. Foco no clone.
7. **`+` entre cards** (P1): botão circular sempre visível na gap, insere em
   i+1, foco no enunciado novo. Manter o do fim.
8. **Validação client-side por card** (P1): hoje erro volta do servidor como
   string única no rodapé. Espelhar `validaCampos` → `erros: Record<id,string>`
   inline + scroll+focus no 1º inválido + `aria-invalid`; `role="alert"` vira
   resumo. Erro de action → `toast.error`.
9. **Mock do tipo no card** (P2): pra select/multi_select/escala/sim_nao/data/
   texto mostrar mock estático inerte (não extrair CampoRenderer — mock simples
   basta e não acopla).
10. **Ícones no select de tipo** (P2): Phosphor por tipo.
11. Misc: dirty guard `beforeunload` (rascunho localStorage = backlog);
    `aria-busy`+disabled no miolo durante save; autofocus título em `/novo`;
    atualizar `novo/loading.tsx` se divergir; título input `text-lg
    font-semibold`; setas ↑↓ continuam (teclado/mobile). **Drag Reorder:
    opcional**, só se sobrar — `motion/react` já está no projeto.
12. **Preview do rascunho** (P2, opcional): toggle dentro do builder renderiza
    `FormularioPublico preview` com o draft — resolve a armadilha "preview
    mostra a versão salva". Se complicar, backlog.

### Coord — Frente C1 (distribuir/acompanhar)

1. **Pendente em form encerrado = ação morta** (ALTA, duas superfícies):
   ficha: suprimir Copiar/WhatsApp nos pendentes quando `!ativo` + hint
   "encerrado — reative pra voltar a coletar"; lista: `pendentes` sem warn-color
   quando `!ativo`.
2. **Lista: meta sem zeros** (MÉDIA): suprimir contagens 0; `linksTotal===0` →
   "nenhum link gerado ainda" em warn-text; "última resposta em …" via
   `max(usado_em)` na query (fallback "criado em").
3. **Âncoras na ficha** (MÉDIA): linha sob a faixa de status — "Perguntas ·
   Links (N) · Respostas (N)" linkando `#sec-*` (ids já existem).
4. **Faixa lidera com completude** (MÉDIA): "2 de 5 responderam" primeiro.
5. **Links**: ordenar pendente→expirado→respondido; esconder NudgeButton em
   `dest_tipo==="generico"` (hoje diz "sem WhatsApp" — razão falsa); renomear
   "Link genérico" → "Copiar link genérico" + hint "o genérico não identifica
   quem respondeu — use pra divulgação aberta"; detalhe por linha só quando
   difere do grupo (corta "Mentor DPP" repetido sob o título do grupo).
6. **Dialog**: chip "já respondeu" (além do "já tem link"); "Selecionar todos"
   puro em 0 (sem "0 de 6"); "Copiar todos" (`nome — URL` por linha) em
   LinksProntos.
7. Misc: `generateMetadata` com `f.titulo`; summary "Editar perguntas" →
   "Editar formulário"; explainer sem jargão `/f/<token>` → "a pessoa responde
   sem login, num endereço só dela".

### Respostas — Frente C2 (ler o que voltou)

1. **Resumo cobre texto/data/checkbox** (ALTA — a maior dor): `agregaRespostas`
   hoje só agrega escala/sim_nao/select/multi_select → Autoavaliação (5×
   texto_longo) renderiza ZERO resumo. Por campo não-agregado: enunciado +
   "N respostas" + lista de textos com nome do respondente em muted — é a vista
   "Por pergunta" do GForms dentro do resumo. `checkbox` agrega {Sim, Não};
   `data` vira lista simples.
2. **"N de M responderam"** (MÉDIA): `ag.respondidas` é calculado e não
   renderizado — pergunta opcional com 3/30 lê como consenso.
3. **% nas barras** (MÉDIA): `{n} · {pct}%`; `aria-label="{n} de {total}"`.
4. **Média por faixa** (MÉDIA): não pintar 1,8/5 de verde — ≥4 ok, <2,5 warn,
   resto neutro.
5. **Export CSV** (MÉDIA — o "Planilhas" do GForms): `/api/export?tipo=
   respostas&id=<uuid>` coord-only; padrão inteiro já existe (BOM/`;`/
   anti-formula). Uma linha por link respondido: destinatário/dupla/
   respondido_em + uma coluna por campo. Botão na seção de respostas.
6. **Ordem**: accordions por `respondido_em` desc (sort no componente, sem
   mexer na query); respostas exibidas na ordem dos `campos`, órfãs por último.
7. **Empty state** unifica com a caixa tracejada + aponta a ação ("gere links
   acima" / âncora `#sec-links`).

## Fica de fora (consciente)

- **Abas Perguntas|Respostas**: página única agora; gatilho pra split `?ver=`
  quando forms >15 respostas virarem norma. (Crítico recomendou NÃO fazer já.)
- **Grid de cards na home**: lista densa vence no volume atual (~6 forms).
- **Stepper "1 de N" nas respostas**: accordion + futuro "Expandir todas" é
  melhor pra N≤30.
- **`*` vermelho de obrigatório**: convenção "(opcional)" da casa é melhor —
  só ganha a linha que a ensina.
- **Rascunho localStorage no builder**, `ajuda`/rótulos de escala por campo
  (schema novo), "Duplicar formulário", busca na lista (~12+ forms), fusão
  links+individuais numa lista única — todos pra `BACKLOG.md`.
- Schema novo, contratos de actions/RPCs, visual Material.

## Frentes disjuntas

| Frente | Arquivos | Escopo |
|---|---|---|
| A — público | `src/app/f/[token]/**` | cards por pergunta, erros, progresso, campos |
| B — builder | `formulario-builder.tsx`, `novo/page.tsx`, `novo/loading.tsx`, `ui/switch.tsx` (novo) | editor estilo GForms |
| C1 — coord | `formularios/page.tsx`, `[id]/page.tsx`, `formulario-links.tsx`, `enviar-formulario-dialog.tsx`, `components/forms/**`, `lib/forms/queries.ts` | lista, ficha, links, dialog |
| C2 — respostas | `respostas-section.tsx`, `lib/forms/schema.ts` (só `agregaRespostas`), `api/export/route.ts` | resumo completo + CSV |

Regras: ninguém toca `globals.css`, `components/ui/*` existentes (exceto B que
cria `switch.tsx`), nem arquivos de outra frente. C2 ordena no componente —
`queries.ts` é só de C1.
