# REALIZA-175 — design

## Persona & JTBD

**Persona**: coordenação lendo o feed de follow-ups dos mentores.

**JTBD**: "quero achar rápido os registros que pedem ação (apoio/tardio) e
ler o que uma dupla específica reportou — sem scroll infinito."

**5 s**: "quantos pedem ação? o que a dupla X reportou?" — o resumo clicável
já responde a primeira; a segunda pede agrupamento.

## Hierarquia — observação × proposta

**Observação**: coluna única `max-w-3xl`; a timeline por `<li>` mistura
todas as duplas na mesma sequência — ler "só da dupla Y" exige filtrar antes.

**Proposta**:

1. **Switcher de agrupamento** — segmented control inline acima da lista:
   `Agrupar: [por dupla · por semana · por avaliação]`. Default **dupla**
   (o caso de uso mais comum: "o que aconteceu com fulano"). Persistido via
   `?grupo=` (SSR, compatível com `scroll={false}` dos filtros).
2. **Header de grupo** — `text-[13px] font-semibold` + meta mutável:
   `Dupla X · K registros` / `Semana de dd/mm` / `Avaliação ★ N`. Sticky?
   Não — o rail da timeline já ancora; sticky competiria com o sub-nav.
3. **Densidade desktop** — container `max-w-3xl` → `max-w-5xl`; em
   `xl`, o corpo do `RegistroCard` pode crescer em 2 colunas internas
   (campos do form lado a lado) **ou** os grupos em `xl:grid-cols-2` —
   preferir grupos lado a lado, rail dentro de cada um.
4. **Dialog de filtro** — `sm:max-w-lg` → `sm:max-w-md`; fieldsets seguem
   em coluna única (o conteúdo é pílulas, `grid-cols-4` já compacto).

## Anatomia

**Segmented control**: `role="group"` + `Link` por opção (server nav,
`scroll={false}`), ativo = `bg-muted font-semibold` — mesmo padrão dos
links de ordem (`registros-filtros.tsx:405-413`).

**Header de grupo**: borda superior `border-t` (exceto o primeiro) +
`pt-4` — separação por espaçamento+hairline, não por card.

**RegistroCard**: sem mudança interna — o agrupamento é do `<ol>` externo.

## Estados

- **Vazio por grupo**: grupo não renderiza (só grupos com itens) —
  `EstadoVazio` global já cobre "nenhum registro".
- **Busca+filtro**: o agrupamento aplica sobre os `itens` filtrados —
  combina com `?q=`, chips, ordem.
- **Permissão**: mentor vê só as próprias duplas (RLS) — switcher idem.
- **Demo**: agrupar funciona com o dataset demo — sem estado novo.

## Breakpoints

- `<xl`: grupos em coluna única (o rail já é vertical — sem mudança).
- `xl+`: `grid-cols-2` de grupos quando `grupo=dupla` (duas duplas lado a
  lado); `semana`/`avaliação` seguem coluna única (timeline é sequencial).

## Microcopy pt-BR

- Switcher: `Agrupar: por dupla | por semana | por avaliação`.
- Headers: `Dupla: {mentor} × {mentorado} · K registros`,
  `Semana de {dd/mm}`, `Avaliação {n}★ · K registros`.

## Cor semântica

Sem mudança — o dot do rail já usa `danger > warn > ok` por precedência
(`page.tsx:243-253`). Agrupar não cria cor nova.

## Ordem de implementação

1. `?grupo=` param + segmentação server-side de `itens` em `page.tsx`.
2. Header de grupo + `<ol>` por grupo (rail por grupo, não global).
3. `max-w-3xl` → `max-w-5xl` + `xl:grid-cols-2` no modo dupla.
4. Dialog `sm:max-w-lg` → `sm:max-w-md`.

## Pergunta de fechamento

Detectar → entender → agir: o resumo clicável já detecta; agrupar por dupla
transforma "entender" de scan-linear em lookup ("dupla X" → seu grupo);
agir segue no card (link pro registro/encontro). Ganho real: a leitura
deixa de ser "scroll até achar" e vira "ir direto no grupo".
