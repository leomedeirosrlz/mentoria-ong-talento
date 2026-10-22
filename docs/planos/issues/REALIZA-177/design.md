# REALIZA-177 — design: a escala de modais

## Princípio

O overlay `sm:max-w-*` deve ser o **menor que comporta o conteúdo sem
wrap patológico** — não o maior disponível. "Fundo maior que conteúdo" =
escolher um degrau acima do necessário.

## Escala semântica (proposta)

| Degrau | Tailwind | Uso |
|---|---|---|
| **S** | `sm:max-w-sm` (default da base) | confirmação curta, 1 campo |
| **M** | `sm:max-w-md` | form de uma coluna (default prático) |
| **L** | `sm:max-w-lg` | form com fieldsets densos / lista com ações |
| **XL** | `sm:max-w-xl` | conteúdo rico (preview, leitura estruturada) |
| **2XL** | `sm:max-w-2xl` | prévia tabular (import CSV, comparativo) |
| **6XL** | `sm:max-w-6xl` | **só** quando a tabela exige — `importar-registros` é o único candidato legítimo |

Regra de bolso: form de coluna única **nunca** passa de `md`; `lg` exige
conteúdo que justifique (fieldsets lado a lado, lista com colunas).

## Reclassificação proposta (do inventário)

| Hoje | Vira | Motivo |
|---|---|---|
| `registros-filtros` lg → **md** | pílulas/checks de 1 coluna — `grid-cols-4 sm:grid-cols-6` cabe em md |
| `pessoas-dialogs` lg×2 → **a verificar** | se 1 coluna → md; se form 2 col → mantém lg |
| `enviar-termos` lg → **a verificar** | idem |
| `jornada-rever` 2xl → **xl**? | resposta pergunta-a-pergunta — texto corrido não precisa 2xl; a verificar densidade |
| `instrumentos-dupla` 2xl → **xl** | leitura estruturada de instrumento — xl basta; a verificar |
| `importar-registros` 6xl → **2xl**? | a verificar a tabela da prévia — se colunas estouram em 2xl, manter 6xl é legítimo |
| `evento-cronograma` lg+`max-h-90` → **lg** sem override | base já dá scroll |
| `jornada-rever` 2xl+`max-h-85` → largura revisada **sem** override | idem |
| `instrumentos-dupla` 2xl+`max-h-85` → idem | idem |

Cada "a verificar" = abrir o dialog em demo/preview e medir ar vazio antes
de decidir o degrau.

## Densidade & padding

- Padding da base: `p-4` + `gap-4` — manter global; forms densos podem usar
  `space-y-4` interno, mas **nunca** alterar o padding do `DialogContent`
  por instância (consistência = mesma margem em todo modal).
- Scroll: só o da base (`max-h-[calc(100dvh-2rem)] overflow-y-auto`) —
  remover `max-h-[85vh]`/`[90dvh]`/`overflow-y-auto` redundantes por
  instância.
- Footer fixo? **a verificar** se algum dialog precisa de `DialogFooter`
  sticky — hoje o padrão é footer rolável junto (aceitável em forms
  curtos; revisar só os 2xl+).

## Estados & a11y (uniformes)

- `DialogTitle` + `DialogDescription` obrigatórios (a11y) — auditar os 51
  arquivos: todo `DialogContent` tem header semântico.
- Esc fecha / clique-fora fecha — padrão Base UI, manter.
- Foco retorna ao trigger — verificar após o fix da 157 (dialogs fora de
  menus) e nos `Trigger`-as-item restantes.
- `max-h` da base garante que nenhum dialog transborde viewport pequeno.

## Microcopy

Sem mudança de copy — é sweep de forma, não de texto.

## Cor

`bg-popover` + `shadow-modal` da base — uniforme. Nenhum dialog colore o
overlay por conta própria (verificar que nenhum `className` passa `bg-*`
diferente).

## Ordem de implementação

1. Criar a **tabela completa** dos 51 `DialogContent` com largura atual +
  classificação (script ou grep) → planilha no PR.
2. Remover overrides redundantes (`max-h`, `overflow-y-auto` por instância).
3. Reclassificar larguras conforme a escala (os "a verificar" viram decisão
   com screenshot).
4. Auditar `DialogTitle`/`Description` presentes em todos.
5. Rodar e2e demo+app — dialogs são exercitados em massa pelos specs.

## Pergunta de fechamento

Detectar → entender → agir dentro de um modal = ler o título, achar o
campo, clicar na ação. Overlay no tamanho do conteúdo + padding uniforme +
scroll único elimina o "por que esse modal é gigante/vazio".
