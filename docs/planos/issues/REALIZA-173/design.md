# REALIZA-173 — design

> Método: `.devin/skills/ux-review/SKILL.md` — hierarquia, carga, estados,
> Gestalt, tipografia/espaço, componentes, cor semântica, valor operacional.

## Persona & JTBD

**Persona**: coordenação/auxiliar executivo — mantém o catálogo e precisa
saber "o que falta" antes de cada semana.

**JTBD**: "quando a semana do encontro N se aproxima, quero ver se os
materiais dela estão no ar (e agir em 1 clique se não estiverem)".

**Pergunta dos primeiros 5 s**: "quais encontros estão cobertos e quais
estão vazios?". Hoje a resposta exige scroll + leitura linha a linha.

## Hierarquia — observação × proposta

**Observação (atual)**: grupos por `encontro_num`/`tipo` renderizam como
seções sequenciais idênticas — sem noção de "completo × vazio"; cada linha
repete contexto (badge de tipo, audiência, estado). A filtragem por
audiência existe mas não há visão de cobertura.

**Proposta**:

1. **Faixa de cobertura** (topo): trilha 1-16 como chips/colunas compactas
   (`size-7` numerados, padrão `NoEstacao`/`PainelJornada`) — lime = tem
   material na audiência atual, neutro tracejado = vazio, amarelo = só
   "em breve" (material sem path/url). `aria-label` por célula.
2. **Hub por encontro** (corpo): linhas `<details>` colapsadas por padrão —
   summary = `Encontro N` + `K materiais` + pill do pior estado. Expandir
   mostra as linhas de material (compactas, ~44px).
3. **Transversais** (rodapé): Guias/Modelos/Conteúdos/Links (sem
   `encontro_num`) num `<details>` único ou seção única — mesma anatomia.
4. `PainelJornada` segue acima do hub pra coord (contexto sem mudar).
5. `NovoMaterialDialog` + `MaterialActions` inalterados — ação por linha e
   no header de cada encontro expandido ("adicionar aqui" pré-preenche
   `encontro_num=N`).

## Anatomia

**Célula da cobertura** (`size-7`, `rounded-md`, tabular-nums): número do
encontro + `title`/`aria-label` "Encontro 3 — 2 materiais" / "— sem
material". Sem texto extra dentro.

**Linha `<details>` de encontro**: `Encontro N` (semibold 13px) ·
`K materiais` (muted 12px) · pill de estado (lime `var(--ok)` quando
todos com conteúdo; amarelo `var(--warn)` se algum "em breve"; neutro
tracejado se K=0 → summary vira "sem material ainda" sem pill).

**Linha de material** (dentro do expandido): ícone por `tipo` (`TIPO_ICONE`
já existe) · título · estado (`em breve`/`link`/`arquivo`) ·
`MaterialActions` trigger (…).

## Densidade & Gestalt

- Altura-alvo da linha expandida: `min-h-11` (touch) → ~`py-2` (36px) em `lg`.
- Proximidade: materiais de um encontro dentro do mesmo `<details>` —
  fechamento > linhas soltas hoje.
- Semelhança: células da trilha de cobertura compartilham forma/tamanho —
  cor carrega o estado (lime=coberto, tracejado=vazio, amarelo=parcial).
- Região comum: o `<details>` fecha o grupo — nada de `space-y-*` entre
  materiais de encontros diferentes.

## Estados

- **Vazio**: catálogo sem nenhum material → `EstadoVazio` + CTA
  `NovoMaterialDialog`. Encontro vazio (K=0) → tracejado, não ausência.
- **Loading**: server component — fallback é a página; dentro do `<details>`
  nada assíncrono.
- **Erro**: fetch falha → padrão das páginas (`return null` + log) —
  manter; `MaterialActions` já devolve `{error}` com toast.
- **Permissão**: `MaterialActions`/`NovoMaterialDialog` coord-only (RLS nas
  actions); mentor/especialista veem hub read-only (a faixa de cobertura
  continua útil pra eles: "o que tem pro encontro N").
- **Sucesso**: pós-upload/edit → `router.refresh()` + toast (padrão actions);
  a célula da trilha atualiza no refresh.

## Breakpoints

- Mobile (`<sm`): trilha de cobertura vira scroll-x (`overflow-x-auto`) de
  chips; `<details>` abrem na vertical — já é o layout.
- `lg+`: trilha em linha única de 16 chips; `<details>` lado a lado? Não —
  empilhados (são listas), mas o resumo horizontal economiza altura.

## Componentes existentes

`Card`, `Badge`, `Button`, `Collapsible`/`details` (padrão já usado na
`agenda-coordenacao` com `marker:hidden`), `EstadoVazio`, `Avatar` (autor
do upload), `DropdownMenu` (ações), `Dialog*` (edição/upload).

## Microcopy pt-BR

- Trilha: `title="Encontro 3 · 2 materiais"` / `"Encontro 5 · sem material"`.
- Summary: `Encontro N` + `K materiais` + `"em breve"` quando parcial.
- Vazio: `"Nenhum material ainda — o primeiro upload aparece aqui."`
- Link "em breve": `"em breve"` (existente, manter).

## Cor semântica

- `var(--brand-lime)` = coberto/completo.
- `var(--warn)` = "em breve" (material existe, conteúdo não).
- Neutro tracejado = encontro sem material (não é erro — é "a preencher").
- Vermelho só se um dia entrar "vencido"/"inválido" — hoje não aplicar.

## Feedback pós-ação

Upload/remove/edit já seguem o padrão `useTransition` + toast das actions;
a trilha de cobertura re-renderiza no refresh — nenhum optimistic state
necessário (server action → `revalidatePath`/`router.refresh`).

## Ordem de implementação

1. Componente `CoberturaTrilha` (16 células) dentro de `page.tsx` ou
   `src/components/materiais-cobertura.tsx`.
2. Converter os grupos em `<details>` (summary + linhas compactas) —
   reutiliza o JSX de linha de material existente.
3. "Adicionar aqui" pré-preenchendo `encontro_num` no `NovoMaterialDialog`.
4. Transversais num `<details>`/seção única.
5. Limpar copy redundante (uma descrição por grupo → nenhuma por linha).

## Observação × recomendação

| Observação (hoje) | Recomendação |
|---|---|
| Grupos sequenciais sem estado agregado | `<details>` com pill de cobertura no summary |
| Linhas repetem tipo/audiência/estado | linha compacta (ícone+título+estado+ações) |
| Sem noção de cobertura | trilha 1-16 lime/neutro/amarelo |
| Envio manual por e-mail presente | preservar — usado pra casos fora do auto |

## Pergunta de fechamento

A proposta reduz "detectar → entender → agir"? Detectar: trilha de cobertura
(olhar 1 vez). Entender: summary `<details>` com K + pill. Agir:
`MaterialActions` na linha / "adicionar aqui" no encontro vazio. Sim —
a resposta dos 5 s vira literal: "encontro 7 e 9 estão vazios".
