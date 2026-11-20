# REALIZA-473 · design: rota dedicada de registro do encontro

**Decisão:** 20/nov/2026 · **Branch:** `design/473-registro-rota` · **Base:** `origin/staging`
**Natureza:** design de UI e arquitetura. Nada de código de produto nesta entrega.

A rota dedicada é autorizada porque o fluxo atual (home → ficha → aba → rolagem por
todos os encontros → form inline) cobra do mentor quatro passos de navegação e um
monte de contexto que ele não pediu, para executar uma tarefa só. A ficha continua
sendo a superfície de leitura da dupla; o registro ganha uma tela cujo único
trabalho é registrar um encontro.

---

## 1. Problema e resultado observável

### O fluxo de hoje, com evidência

| Passo | O que acontece | Onde |
|---|---|---|
| 1 | Home do mentor mostra "O que fazer agora" com o CTA "Registrar como foi" | `src/components/mentor-home.tsx:417` e `:509` |
| 2 | O CTA aponta para `/duplas/{id}?aba=encontros#registrar-{encontroId}` | idem |
| 3 | A ficha inteira é carregada: `getDupla` com embed de todos os encontros e registros, calendário, materiais, anexos, instrumentos, terceiros, PDM, encerramento, desfechos | `src/app/(app)/duplas/[id]/page.tsx:266-335` |
| 4 | Sem `?aba`, um efeito no cliente troca a aba lendo o hash | `src/app/(app)/duplas/[id]/aba-por-hash.tsx:17-37` |
| 5 | O form só abre quando o hash encontra o card e o provider monta o painel | `src/components/registro-inline.tsx:42-106`, `:165-197` |
| 6 | O form vive dentro do card do encontro, no meio da lista de todos os passos | `src/app/(app)/duplas/[id]/encontro-row.tsx:677-701` |

Consequências observáveis:

- **O hash é a máquina de estados.** "Qual form está aberto" é o fragmento da URL,
  lido por `useSyncExternalStore` em dois componentes (`registro-inline.tsx:56` e
  `:225`). Trocar de encontro é mudar o hash, não navegar.
- **A tela da tarefa não existe.** O mentor precisa atravessar a aba Encontros
  inteira (passos do guia, registros antigos, combinados, notas) para chegar a um
  formulário de três etapas que ocupa a largura de um card.
- **O contexto do encontro é pequeno.** Data, semana sugerida, "como conduzir",
  material de apoio e plano ficam espalhados entre a linha (`:244-279`), a aba Agora
  (`:1098-1182`) e o form (`registro-form.tsx:779-796`). Quem registra não vê o
  encontro como assunto.
- **O pós-salvar é frágil.** A cadeia de sessão dupla escreve rascunho e faz
  `window.location.hash = ...` (`registro-form.tsx:733`); no celular isso é rolagem
  de página, não navegação, e o "voltar" do navegador fica ambíguo.
- **Deep link sem `aba` depende de hidratação** (`aba-por-hash.tsx`). Um link
  colado abre a aba Agora e só depois corrige.

### Resultado observável da mudança

1. Da home, **um clique** leva a `/duplas/{id}/registrar/{encontroId}`: uma tela
   com cabeçalho da dupla, o encontro como assunto e o formulário. Sem aba, sem
   rolagem por outros encontros, sem depender de hash para abrir.
2. A ficha vira **superfície de leitura**: os blocos do mentor e do jovem nascem
   colapsados e abrem por gesto (ou pelo hash, quando o link é antigo).
3. **Nenhum dos 29 links `#registrar-{id}` quebra.** O hash continua abrindo o
   form na ficha; a rota é a frente, o hash é o fallback.
4. Salvar continua sendo um gesto só, com as mesmas regras: o servidor não muda.

---

## 2. Decisão de arquitetura

### 2.1 A rota

```
src/app/(app)/duplas/[id]/registrar/[encontroId]/
├── page.tsx      # server component: guard + carregamento + layout + estados bloqueados
└── loading.tsx   # espelho do esqueleto (cabeçalho, contexto, form)
```

- **Path:** `/duplas/[id]/registrar/[encontroId]`. Autenticada, dentro de
  `(app)/layout.tsx`, portanto **não** entra em `isPublic` (`src/lib/supabase/middleware.ts`)
  e não ganha caso de token público.
- **`params` é Promise** (Next 16): `params: Promise<{ id: string; encontroId: string }>`
  com `await params`, como `formularios/[id]/page.tsx:27-53`.
- **Validação de UUID antes da query**, como `formularios/[id]/page.tsx:28` e `:53`:
  id malformado → `notFound()` sem round-trip.
- **`generateMetadata`**: busca `getDupla(id)` (React.cache, a página reusa) e devolve
  `Registrar o {n}º encontro · {mentor} e {mentorado} · Realiza.vc`; sem dupla, título
  genérico. Nunca lança: `try/catch` como no formulário.
- **`loading.tsx`**: esqueleto com o mesmo desenho (kicker, h1, cartão de contexto,
  cartão do form) para não deslocar layout na entrada.
- **Sem `not-found.tsx` próprio:** `notFound()` cai no 404 do app. Ids de outra dupla
  caem na mesma resposta (não vaza existência).

### 2.2 Guard em três camadas (A2: a barreira é o banco)

A página é a camada de **experiência**, não de autorização. A ordem:

1. **RLS** já escopa tudo: `getDupla(id)` devolve `null` para quem não enxerga a dupla
   (`src/lib/queries.ts:491-511`). Sem dupla → `notFound()`.
2. **Server action** é a barreira de escrita e não muda: recusa coordenação (`actions.ts:3300`),
   dupla fora de ativa/concluída (`:3329`), encontro de outra dupla (`:3339`) e
   encontro que ainda não aconteceu (`:3341`).
3. **Página** deriva o estado da rota para não mostrar um form que vai falhar.

Derivação pura (novo módulo, ver 2.5) — tabela de decisão:

| Condição (na ordem) | Resultado | Por quê |
|---|---|---|
| `encontroId` não é UUID, ou não existe em `dupla.encontros` | `notFound()` | privacidade e link podre |
| `dupla.mentor.id !== me.id` | redireciona para `/duplas/{id}?aba=encontros#registrar-{enc}` | coord/sup leem, não registram (`actions.ts:3300`); o destino é a ficha, com o bloco aberto |
| dupla `pausada`/`encerrada`, ou `concluida` **sem** rito pendente | estado bloqueado "Dupla não está ativa" | espelha `podeEditar` da linha (`page.tsx:984`) e a action (`:3329`) |
| `encontro.registro != null` | redireciona para a ficha com o bloco aberto | editar registro mora lá (`EditarRegistro`), a rota é de criação |
| status ≠ `realizado` e (`data_hora` nula ou futura) | estado "Ainda não aconteceu" | espelha `salvarRegistro` (`:3340-3343`) e `RevelarApos` (`encontro-row.tsx:211-216`) |
| qualquer outro caso (realizado sem registro; agendado/remarcado/nao_aconteceu/cancelado com data passada) | **form** | a action corrige o status ao salvar |

`ritoPendente` = `dupla.status === "concluida" && encerramento != null && !encerramentoDecidido(encerramento)`
(`page.tsx:648-651`). A rota chama `getEncerramentoDaDupla(id)` (já em React.cache) para
reproduzir a mesma régua do `podeEditar`; sem isso, o mentor não conseguiria registrar o
último encontro que fechou a jornada.

### 2.3 Carregamento (só o que a tela usa)

| Dado | Query | Uso |
|---|---|---|
| Dupla + encontros + registros + encaminhamentos + notas + pessoas | `getDupla(id)` | identidade, guard, encontro, combinados, nota, `origem` |
| Encerramento | `getEncerramentoDaDupla(id)` | `ritoPendente` |
| Calendário do ciclo | `getCicloEventos()` | `eventosDoCronograma` → `passosDaTrilha` |
| Passos da trilha especialista | `getEspecialistaEventos()` só se `trilha === "especialista"` | `passoEsp` do encontro |
| Catálogo de materiais | `getMateriais()` | material do nº |
| Matrícula do visitante | `getMe()` | papel, nome |

`getDupla` é `React.cache`: `generateMetadata` e a página dividem a mesma leitura. Nada
de `unstable_cache` novo em contexto de jovem (a rota é mentor/staff; o invariante de
`src/lib/queries.ts:357-362` segue intacto).

**Derivações extraídas para módulo puro** (nada de regra duplicada entre ficha e rota):

- `combinadosPendentesDaDupla(dupla)` — hoje `page.tsx:437-440`.
- `filaRegistrosPendentes(dupla, { excluirEncontroId, agora })` — hoje `page.tsx:1020-1035`
  (a fila do "registrar o próximo também").
- `materiaisDoNumero({ materiais, eventosDaDupla, trilha, numero })` — hoje o bloco
  `page.tsx:513-531`; mora em `src/lib/materiais.ts`, reusando `audienciasDe` e
  `enriquecerMateriaisPorEncontro`.
- `passoDoEncontro(dupla, encontro, passos)` — DPP por `numero`; especialista por
  `passoEsp(encontro, dupla.encontros)` (a mesma regra de `page.tsx:960-962`).
- `estadoDaRotaRegistro({ dupla, encontroId, passos, meId, agora, ritoPendente })` —
  a tabela de 2.2 como união discriminada.

Todas puras, sem Next nem Supabase: consumidas pela página, pela ficha e pelos testes
(A3 e a régua de `src/lib/ciclo.ts`).

### 2.4 Form compartilhado, sem duplicar regra (SOLID)

`RegistroForm` já tem três hosts (painel inline da ficha, dialog da agenda com
`embutido`, edição inline via `EditarRegistro`). A rota é o **quarto host**, não um
segundo formulário. O que muda nele:

| Ponto | Hoje | Depois |
|---|---|---|
| Título interno | `<p>Registro do encontro</p>` (`:774-778`) | prop `titulo?: boolean` (default `true`); a rota passa `false`, porque o `h1` da página já nomeia a tarefa |
| Concluir | `fecharPosSave()` chama `onSaved` e `router.refresh()` (`:695-701`) | prop `irParaAposSalvar?: string`; quando presente, `router.replace(url)` e **não** chama `refresh` (evita corrida entre navegação e refresh) |
| Encadear | escreve rascunho e faz `window.location.hash` (`:706-735`) | prop `onEncadear?: (encontroId: string) => void`; quando presente, escreve o rascunho e delega a navegação ao host |
| Regras | passos, portão da avaliação, rascunho local, telemetria, cobertura, evidências | **intactas** |

Nada de `useEffect` novo, nada de estado global, nenhum `if (rota)` dentro do form. Os
dois seams são injeção de dependência do host (DIP) e mantêm os outros três hosts com
comportamento idêntico ao de hoje.

**Cliente mínimo:** `src/components/registro-pagina.tsx` (`"use client"`), um arquivo
fino que só monta `<RegistroForm ... onEncadear irParaAposSalvar />`. Import estático
do `RegistroForm` (a rota já é o recorte de bundle, então não passa pelo
`RegistroFormLazy`, que existe para o clique no card): evita o esqueleto duplo e o
suspend do chunk no meio da tela. Tudo o mais é server: cabeçalho, cartão de contexto,
links de material, link da chamada, combinados do contexto. O upload de evidências já
é cliente dentro do form (`PosSaveRegistro`).

### 2.5 Contrato do módulo puro

`src/lib/registro-contexto.ts` (novo):

```ts
export type BloqueioRegistro =
  | "sem_encontro"        // 404
  | "nao_e_mentor"        // volta pra ficha
  | "dupla_inativa"
  | "ainda_nao_aconteceu"
  | "ja_registrado";

export type EstadoRotaRegistro =
  | { tipo: "ok"; encontro: Encontro; passo: PassoGuia | null }
  | { tipo: "bloqueado"; motivo: BloqueioRegistro; encontro?: Encontro };

export function estadoDaRotaRegistro(input: {
  dupla: Dupla;
  encontroId: string;
  passos: PassoGuia[];
  meId: string;
  agora: Date;
  ritoPendente: boolean;
}): EstadoRotaRegistro;

export function combinadosPendentesDaDupla(dupla: Dupla): Encaminhamento[];
export function filaRegistrosPendentes(
  dupla: Dupla,
  opts: { excluirEncontroId?: string; agora: Date }
): { encontroId: string; numero: number }[];
export function passoDoEncontro(
  dupla: Dupla,
  encontro: Encontro,
  passos: PassoGuia[]
): PassoGuia | null;
```

`materiaisDoNumero` fica em `src/lib/materiais.ts` (já é o módulo do assunto).

### 2.6 Desenho da tela

```
[ Voltar ]                                          (kicker, VoltarLink)
h1  Registrar o 4º encontro
    Ricardo e Ana · Turma 1 · terça, 17/11 às 19h    (meta, text-sm muted)
    [Aconteceu em 17/11 · falta o registro]          (chip de estado, só quando limbo)

┌ h2  Encontro 4 · Primeiras submetas do PDM ─────────────────┐
│ semana sugerida 16/11 a 22/11                               │
│ Como conduzir: ...                                          │
│ Plano do encontro: ...            (quando existe nota)      │
│ [Material de apoio] [Entrar na chamada]                     │
└─────────────────────────────────────────────────────────────┘

┌ card do form (sem título próprio: o h1 nomeia a tarefa) ────┐
│ Só você e a equipe do programa leem este registro.          │
│ Passo 1 de 3 · Como foi                                     │
│ ...                                                         │
│ [sticky: Avançar]                                           │
└─────────────────────────────────────────────────────────────┘
```

- Hierarquia de heading fecha: `h1` (PageHeader) → `h2` (contexto do encontro) → `h3`
  (Passo N de 3, já existente em `registro-form.tsx:817`).
- Sem hero, sem ícone decorativo, sem emoji. O assunto é o encontro.
- O cartão de contexto usa a gramática da casa: `rounded-xl bg-card p-4
  shadow-[var(--shadow-border)]`, eyebrow `text-[11px] uppercase tracking-[0.08em]`,
  corpo `text-sm`, meta `text-xs text-muted-foreground`.
- Nada de dois botões preenchidos: o preenchimento fica no avançar/salvar (rodapé
  sticky); "Material de apoio" e "Entrar na chamada" são `outline size="sm"`.
- A ficha não é duplicada: não há abas, não há trilha de 16 discos, não há resumo.

---

## 3. O que muda em cada arquivo, e o que não muda

### 3.1 Arquivos

| Arquivo | Mudança | PR |
|---|---|---|
| `src/app/(app)/duplas/[id]/registrar/[encontroId]/page.tsx` | **novo**: guard, carregamento, layout e estados bloqueados (server) | 1 |
| `.../registrar/[encontroId]/loading.tsx` | **novo**: esqueleto da tela | 1 |
| `src/components/registro-pagina.tsx` | **novo**: host cliente mínimo do form | 1 |
| `src/lib/registro-contexto.ts` | **novo**: derivações puras de 2.5 | 1 |
| `src/lib/materiais.ts` | `materiaisDoNumero` (puro) reusando `audienciasDe`/`enriquecerMateriaisPorEncontro` | 1 |
| `src/components/registro-form.tsx` | props `titulo`, `irParaAposSalvar`, `onEncadear`; `fecharPosSave`/`encadearProximo` respeitam os seams | 1 |
| `src/components/encontro-disclosure.tsx` | **novo**: extrai o disclosure de `RegistroDetails` (`registro-inline.tsx:204-249`) para uso nos dois blocos | 1 |
| `src/components/avaliacao-jovem.tsx` | separa `AvaliacaoJovemResumo` (conteúdo phrasing do trigger) e `AvaliacaoJovemDetalhe` (corpo); `AvaliacaoJovemCard` vira a composição | 1 |
| `src/app/(app)/duplas/[id]/encontro-row.tsx` | dois blocos sob `EncontroDisclosure`, ambos fechados; remove `registroAberto` (`:80,129,547`) | 1 |
| `src/app/(app)/duplas/[id]/page.tsx` | remove `numeroAtual`/`registroAberto` (`:706-709`, `:1045`); passa a usar as derivações puras; CTA primário aponta para a rota (`:748-773`) | 1 |
| `src/components/mentor-home.tsx` | dois CTAs "Registrar como foi" (`:417`, `:509`) apontam para a rota | 1 |
| `src/app/(app)/duplas/[id]/aba-por-hash.tsx` + ficha | no PR2, hash de encontro **sem** registro e com permissão → `replace` para a rota; com registro → abre o bloco | 2 |
| `src/components/registro-inline.tsx` | `RegistroInline`/`RegistroInlineTrigger`/`RegistroInlinePanel` removidos; sobra só o disclosure (já extraído) | 2 |
| `src/components/registro-form.tsx` | remove o ramo de hash de `encadearProximo` e a prop `proximosRegistros` da ficha | 2 |
| produtores restantes de `#registrar-` | migram para a rota (tabela 3.3) | 2 |

### 3.2 O que NÃO muda

- **`salvarRegistro`** (`src/lib/actions.ts:3296+`): validações, ordem (encontro →
  registro), combinados, cobertura, telemetria, `{ ok } | { error }`. Zero mudança.
- **Schema, RLS, RPCs, migrations**: nenhuma. A rota não é pública; nada em `isPublic`.
- **`RegistroForm` como contrato de dados**: mesmas props obrigatórias, mesmos nomes
  de campo do `FormData`, mesmos ids de DOM (`registro-form-{id}`, `tema`, `avaliacao`…).
- **Rascunho local**: a chave continua `registro-draft-{encontroId}`; quem começou um
  registro inline e reabre pela rota recupera o mesmo rascunho, com o mesmo aviso de
  restauração (`:799-810`).
- **`AbaPorHash`** continua mapeando `#registrar-`, `#combinados-`, `#intencoes` e
  `#encontro-` para a aba Encontros no PR1.
- **`RegistroDetails`/novo disclosure**: o hash `#registrar-{id}` continua abrindo o
  bloco salvo; o que muda é só o default (fechado).
- **Os 29 links** do levantamento: no PR1, os que ainda apontam para o hash seguem
  funcionando; os três migrados (home ×2 e CTA primário da ficha) passam a apontar
  para a rota.
- **Demo** (A7): a rota herda `demoRole`/`demoDupla`; a escrita segue devolvendo
  `DEMO_MSG`.
- **`/registros`**: o detalhe usa `AvaliacaoJovemCard` composto, sem colapso novo.

### 3.3 Os 29 links e a ordem de migração

Levantamento em `src/` (produção de href, não comentário):

| Área | Pontos |
|---|---|
| Home do mentor | `mentor-home.tsx:417`, `:509` |
| Ficha | `page.tsx:748-752` (header), `encontro-row.tsx:138` (âncora local), `trilha-jornada.tsx:226`, `plano-em-dia-card.tsx:146` |
| Agenda | `agenda-minha.tsx:131`, `agenda-minha.ts:320`, `agenda-por-mentorado.tsx:522`, `:682`, `agenda-especialista.tsx:171`, `:181`, `agenda-calendario.tsx:1384`, `:4073`, `:4729`, `agenda-partes.tsx:114` |
| Listas e leitura | `duplas-lista.tsx:2284`, `registros-detalhe.tsx:43` |
| Fluxos de criação | `agendar-encontro-dialog.tsx:289`, `registrar-retroativo-dialog.tsx:141` |
| Lib (notificação/WhatsApp) | `acao-lembrete.ts:41`, `:136` |

- **PR1** migra **home (2)** e o **CTA primário da ficha**: são o fluxo que o problema
  nomeia. Sem isso a rota nasce inalcançável, o que reprova em A1.
- **PR2** migra o resto e aposenta o inline. Até lá, cada link restante é prova viva do
  fallback.

---

## 4. Estados, mobile-first e teclado

### 4.1 Tabela de estados da tela

| Estado | Comportamento visível | Implementação |
|---|---|---|
| **Carregando** | esqueleto com kicker, h1, contexto e form | `loading.tsx` |
| **Pronto** | contexto + form na etapa 1, foco no topo (sem autofocus) | server + form |
| **Salvando** | botão "Salvando…" desabilitado, rodapé sticky, sem duplo submit | `useTransition` existente (`registro-form.tsx:182`, `:1303-1305`) |
| **Erro do servidor** | toast pt-BR com a mensagem de `{ error }`; rascunho intacto; botão volta | `toast.error` (`registro-form.tsx:600`), draft local |
| **Erro de conexão** | "Sem conexão. Tente de novo." | `registro-form.tsx:690` |
| **Salvo** | etapa de evidências no mesmo lugar, com uploader e contagem de falhas | `PosSaveRegistro` (`:1328+`) |
| **Concluir** | `replace` para `/duplas/{id}?aba=encontros#registrar-{enc}` | `irParaAposSalvar` |
| **Próximo encontro** | botão "Registrar o {n}º também" grava o rascunho compartilhado e navega para a rota do próximo | `onEncadear` |
| **Voltar / cancelar** | sai para a origem (referrer interno) ou para a ficha na aba Encontros; rascunho é gravado no desmonte | `VoltarLink`, flush `:416-421` |
| **Ainda não aconteceu** | cartão "Marcado para {data}. O registro abre depois do horário." com "Voltar para a dupla"; quando chega a hora, `RevelarApos` revela o link "Recarregar" | página (server) + `RevelarApos` |
| **Já registrado** | redireciona para a ficha com o bloco aberto (editar mora lá) | guard 2.2 |
| **Sem permissão** | redireciona para a ficha; coord/sup não registram | guard 2.2 |
| **Dupla inativa** | cartão "Esta dupla está {pausada/encerrada}. Não é possível registrar." com "Voltar para a dupla" | página (server) |
| **Demo** | mesmo fluxo; salvar devolve o aviso de demonstração | `demoAtivoClient` |

Nenhum estado é tela morta: todos têm uma saída nomeada.

### 4.2 Mobile-first

- Uma coluna em qualquer largura; no máximo `max-w-3xl` para o texto não esticar.
- O rodapé do form já é sticky com `bottom-[calc(4rem+env(safe-area-inset-bottom))]`
  no mobile e `md:bottom-0` (`registro-form.tsx:1314`). Como a rota vive no mesmo
  `AppShell`, a barra inferior continua coberta sem offset novo.
- Campos a `text-base` no mobile (anti-zoom iOS), como o form já faz.
- Nenhum `overflow-x`: títulos com `text-balance`/`break-words`; nomes longos usam
  `DuplaNomes`, que já quebra.
- Alvos de toque ≥ 44px (`min-h-11`) no Voltar, no disclosure e nos botões.
- O cartão de contexto vem **antes** do form: no celular, o mentor confirma data e
  assunto sem rolar por outro encontro.

### 4.3 Teclado e ARIA

- Navegação real (não hash): o leitor de tela anuncia a página pelo título. **Sem**
  autofocus no primeiro campo: em mobile isso abre teclado e esconde o contexto.
- O form mantém o foco programático na troca de etapa (`:512-518`) e o `tabIndex={-1}`
  no heading (`:817`).
- `Enter` nas etapas 1 e 2 avança, não salva (`:553-560`); só a etapa 3 submete.
- Portão da avaliação: erro inline, foco no radio e retorno à etapa 1 (`:532-542`).
- Disclosures: `aria-expanded`/`aria-controls` vêm do Base UI `Collapsible`; o trigger
  é a linha inteira, `min-h-11`, com anel de foco inset. O caret gira por
  `group-data-[panel-open]`.
- O resumo do disclosure é **phrasing content**: spans e badges, nenhum link/botão
  aninhado. Ações (resolver apoio, editar registro) ficam no corpo.
- Links externos com `rel="noopener noreferrer"` e `sr-only` "(abre em nova aba)" onde
  já é o padrão.
- Contraste: só tokens existentes; status sempre com rótulo textual, nunca só cor.

### 4.4 Copy (pt-BR, sem travessão)

- h1: "Registrar o 4º encontro" / "Registrar sessão de especialista".
- Contexto: "Semana sugerida 17/11 a 23/11"; "Como conduzir"; "Plano do encontro".
- Futuro: "Marcado para 18/11 às 19h. O registro abre depois do horário."
- Inativo: "Esta dupla está pausada. Não é possível registrar agora."
- Já registrado: sem copy própria (redireciona).
- Pós-salvar: "Registro salvo. As evidências ficam na ficha da dupla." (já existe).

---

## 5. Colapso dos blocos do mentor e do jovem

### Hoje

No card de um encontro realizado com registro, há dois blocos:

- **Mentor:** `RegistroDetails` (`encontro-row.tsx:545-608`), com `aberto={registroAberto}`;
  a ficha passa `passo.numero === numeroAtual` (`page.tsx:1045`), então **o encontro
  atual nasce aberto**.
- **Jovem:** `AvaliacaoJovemCard` (`:614-619`), um bloco sempre aberto.

### Depois

- Os dois viram **disclosures independentes**, ambos fechados por padrão.
- `EncontroDisclosure` (extraído de `RegistroDetails`, mesmo comportamento de hash)
  é usado duas vezes: registro do mentor e avaliação do jovem. Uma implementação,
  dois usos.
- O hash `#registrar-{id}` continua abrindo **os dois** (é o mesmo encontro): o link
  antigo revela o registro inteiro, não uma metade. Clicar num trigger não mexe no
  hash nem fecha o irmão (não é acordeão).
- Resumos:
  - Mentor: "Registro" + `AvaliacaoBadge` + tema em até 2 linhas + "dificuldade ·
    registro tardio · N combinados" (já existe, `:549-579`).
  - Jovem: "Avaliação do jovem" + estrelas + badge "pediu ajuda" + "pela conta do
    jovem · 12/11". Cabe no trigger, sem abrir.
- `AvaliacaoPendenteLinha` (jovem ainda não respondeu) **não** colapsa: é uma linha
  fina e carrega a ação da coordenação (copiar/enviar link). Colapsar esconderia
  trabalho pendente. O aviso "Sem avaliação do jovem" (`encontro-row.tsx:632-636`)
  segue a mesma regra.
- O encontro atual deixa de abrir sozinho. O que abre o registro agora é o gesto ou
  o hash; o caminho de escrita é a rota.
- Efeito de leitura: a aba Encontros fica curta e escaneável; a ficha volta a ser
  índice, não formulário.

### Impacto em teste (previsto)

- `tests/e2e/demo/combinados.spec.ts:60-63` já clica no trigger antes de ler; passa.
- `tests/e2e/app/avaliacao.spec.ts:643-650` afirma texto **dentro** do bloco do jovem
  sem expandir; passa a exigir um clique no resumo (ou o resumo precisa carregar
  aquele texto, o que não cabe). Ajuste no PR1.
- `mentor.spec.ts` usa `linhaFicha` para ler linha e ações; não depende de default
  aberto.

---

## 6. Testes

### 6.1 Unitários (vitest, domínio puro)

`tests/registro-contexto.test.ts` (novo):

1. `estadoDaRotaRegistro`
   - realizado sem registro → `ok`;
   - agendado vencido → `ok`; agendado futuro → `ainda_nao_aconteceu`;
   - `nao_aconteceu`/`cancelado` com data passada → `ok` (o salvar corrige);
   - sem `data_hora` e não realizado → `ainda_nao_aconteceu`;
   - já com registro → `ja_registrado`;
   - dupla pausada/encerrada → `dupla_inativa`; concluída com rito pendente → `ok`;
   - visitante ≠ mentor → `nao_e_mentor`;
   - `encontroId` de outra dupla → `sem_encontro`.
2. `passoDoEncontro`: DPP por `numero`; especialista por `passoEsp` (tentativa 3
   cobrindo o passo 2).
3. `filaRegistrosPendentes`: ordem por número, exclui o encontro atual, inclui
   agendado vencido e realizado sem registro, ignora futuro com data.
4. `combinadosPendentesDaDupla`: exclui `feito`, ordena por prazo com nulos no fim.
5. `materiaisDoNumero`: filtra audiência da trilha (DPP não recebe material de
   especialista), enriquece com docs do guia, dedup por slug.

`tests/ciclo-cobertura.test.ts` continua sendo a régua de `passosCobertosCandidatos`
(reusada, não reescrita).

### 6.2 E2E app (backend real)

`tests/e2e/app/registro-rota.spec.ts` (novo):

1. **Fluxo principal:** login mentor → home → "Registrar como foi" → URL
   `/duplas/{id}/registrar/{enc}` → h1 visível e **sem** `role=tablist` → etapa 1
   (avaliação "Boa") → duração "1h30" → etapa 2 → etapa 3 → "Salvar registro" →
   toast → evidências → "Concluir" → URL da ficha com `#registrar-{enc}` → bloco do
   registro aberto, sem badge "registro pendente"; REST confirma `encontros.status =
   realizado` e a row em `registros`.
2. **Encadear:** três realizados sem registro → salvar o 3º → "Registrar o 4º também"
   → URL da rota do 4º → etapa 1 com duração/avaliação herdadas (rascunho).
3. **Deep link legado:** `page.goto('/duplas/{id}#registrar-{enc}')` → aba Encontros →
   form inline abre (fallback do PR1), salva e fecha (regressão dos 29 links).
4. **Guardas:** coordenação abre a rota → cai na ficha; encontro futuro → cartão
   "Marcado para…"; encontro já registrado → ficha com o bloco aberto;
   `encontroId` de outra dupla → 404.
5. **Colapso:** na ficha, o encontro atual com registro nasce com os dois blocos
   fechados (`aria-expanded=false`); clicar abre só o acionado; `goto` com hash abre os
   dois.
6. **Mobile** (`test.use({ viewport: { width: 390, height: 844 } })`): sem scroll
   horizontal (`scrollWidth ≤ 390`), rodapé sticky visível, "Salvar registro"
   alcançável, etapa 3 completa sem zoom/estouro.

`tests/e2e/app/mentor.spec.ts:73-80`: a fixture de linha continua válida; nenhum teste
depende de o registro nascer aberto. Ajustar apenas se alguma asserção ler conteúdo do
bloco do jovem.

`tests/e2e/app/plano-em-dia.spec.ts:93-137`: permanece no PR1 (fallback inline). No
PR2, reescrever para a rota, mantendo as asserções de rascunho compartilhado.

### 6.3 E2E demo (A7)

`tests/e2e/demo/registro-rota.spec.ts` (novo): `entrarNaDemo(page, "mentor_dpp")` →
rota de um encontro sem registro → etapa 1 → salvar → toast
"Modo demonstração. Nada é gravado de verdade." → nenhum rascunho persistido.
Cobre a paridade da superfície sem escrever.

### 6.4 Gates

`pnpm exec next typegen && npx tsc --noEmit` · `npx eslint src/` · `pnpm test` ·
`pnpm guard` · `e2e-app / e2e`. Entrada nova em `docs/regression-map.md`:
"rota de registro (473): guarda de papel/estado, fallback `#registrar-`, colapso dos
blocos" ↔ `tests/registro-contexto.test.ts` + `tests/e2e/app/registro-rota.spec.ts`.

---

## 7. Riscos e fatiamento

### 7.1 Fatiamento em 2 PRs

**PR1 — rota + colapso (fatia vertical entregável)**

- módulo puro `registro-contexto` + `materiaisDoNumero` + testes;
- rota, `loading`, estados bloqueados, host cliente;
- seams no `RegistroForm` (`titulo`, `irParaAposSalvar`, `onEncadear`);
- entrada pela home do mentor e pelo CTA primário da ficha;
- extração do `EncontroDisclosure` + resumo/detalhe da avaliação do jovem;
- ambos os blocos fechados por padrão;
- e2e novo + ajuste pontual em `avaliacao.spec.ts`;
- os links ainda não migrados seguem no hash, com o inline vivo (fallback comprovado).

**PR2 — limpeza do inline e dos CTAs**

- migra os produtores restantes de `#registrar-` (tabela 3.3);
- hash de encontro sem registro → `replace` para a rota (fallback vira redirecionamento);
- remove `RegistroInline*`, o painel, a prop `proximosRegistros` da ficha e o ramo de
  hash do `encadearProximo`;
- reescreve `plano-em-dia.spec.ts` e o teste de fallback para a nova semântica;
- mantém `#registrar-{id}` abrindo o bloco salvo (leitura) para sempre.

### 7.2 Riscos

| Risco | Efeito | Mitigação / verificação |
|---|---|---|
| Duas superfícies de escrita enquanto o PR1 está em produção | mentor pode registrar inline ou pela rota | ambas usam a mesma action e as mesmas regras; PR2 aposenta o inline. e2e 1 e 3 |
| Corrida entre `onSaved`/`router.replace` e o `router.refresh` antigo | refresh na rota errada, toast sumindo | seam `irParaAposSalvar` evita o refresh; e2e 1 verifica a URL final |
| Gate do servidor vs encontro que começa com a página aberta | form visível antes da hora | cartão de estado + `RevelarApos` com "Recarregar"; gate espelha a action |
| `getMateriais()` carrega o catálogo inteiro numa tela focada | payload maior que o necessário | React.cache por request; medir no preview; se pesar, criar getter escopado (não inventar agora) |
| Colapso esconde sinal do jovem ("pediu ajuda") | coordenação demora a ver | o resumo carrega estrelas, badge e data; o pill "Apoio aberto" segue no cabeçalho da ficha |
| Telemetria de preenchimento muda de forma | séries de REALIZA-217 comparam superfícies | mesma `tentativa` e mesma origem (`novo`/`retroativo`); registrar a troca de superfície no painel |
| Back/forward com cadeia de registros | pilha de forms salvos | `replace` no concluir e no encadear |
| Testes que leem conteúdo do bloco do jovem sem expandir | vermelho no PR1 | ajuste localizado em `avaliacao.spec.ts:643-650` |
| A10: mudança em mais de uma superfície pede spec | bloqueio de processo | abrir `specs/<NNN>-registro-rota/` ou registrar a dispensa no PR, com link para este design |
| Link antigo já enviado por WhatsApp/e-mail | 404 se o hash for removido | hash nunca é removido; no PR2 ele redireciona |

---

## 8. Critérios de aceite (REALIZA-473)

Verificáveis por teste ou inspeção:

- **AC-473.1** Da home do mentor, "Registrar como foi" abre
  `/duplas/{id}/registrar/{encontroId}` em uma navegação, com h1 do encontro e sem
  `role=tablist` na árvore. (e2e 1)
- **AC-473.2** Salvar pela rota grava `encontros.status = realizado`, a row de
  `registros` e os combinados, e a ficha passa a mostrar o registro sem o badge
  "registro pendente". (e2e 1 + REST)
- **AC-473.3** O pós-salvar oferece evidências no mesmo fluxo; "Concluir" leva à ficha
  com `#registrar-{id}` e o bloco do registro aberto. (e2e 1)
- **AC-473.4** "Registrar o {n}º também" navega para a rota do próximo encontro com
  duração, avaliação, dificuldade e próximo passo herdados; cada encontro é salvo
  separadamente. (e2e 2)
- **AC-473.5** Pelo menos um link legado `#registrar-{id}` continua abrindo o form na
  ficha e salvando; todo link do levantamento que ainda aponta para o hash segue
  funcional no PR1. (e2e 3)
- **AC-473.6** Na aba Encontros, os blocos do mentor e do jovem nascem fechados, com
  resumo visível e `aria-expanded=false`; clique e teclado abrem; o hash abre os dois.
  (e2e 5)
- **AC-473.7** A rota é inacessível para quem não é mentor da dupla (redireciona para
  a ficha), para encontro futuro (estado com saída) e para encontro já registrado
  (ficha com bloco aberto); id de outra dupla responde 404. (e2e 4)
- **AC-473.8** Em 390×844 não há scroll horizontal; o rodapé sticky e "Salvar
  registro" ficam alcançáveis em todas as etapas. (e2e 6)
- **AC-473.9** `/demo` percorre a mesma rota e o salvar devolve o aviso de
  demonstração, sem persistir rascunho. (e2e demo)
- **AC-473.10** Nenhuma regra de escrita nova fora de `src/lib/escritas.ts`/action;
  nenhuma mudança de schema, RLS, `isPublic` ou migration. (inspeção + `git diff`)
- **AC-473.11** Gates verdes: typegen + `tsc --noEmit`, `eslint src/`, `vitest`,
  `e2e-app / e2e`, `pnpm guard`; `docs/regression-map.md` atualizado. (CI)

---

## Apêndice: arquivos lidos para este design

`src/app/(app)/duplas/[id]/page.tsx` · `encontro-row.tsx` · `aba-por-hash.tsx` ·
`ficha-abas.ts` · `src/components/registro-inline.tsx` · `registro-form.tsx` ·
`registro-form-lazy.tsx` · `avaliacao-jovem.tsx` · `mentor-home.tsx` ·
`src/lib/actions.ts` (`salvarRegistro`) · `src/lib/queries.ts` (`getDupla`, `getMe`,
`getCicloEventos`, `getMateriais`, `getEspecialistaEventos`) · `src/lib/ciclo.ts` ·
`src/lib/materiais.ts` · `src/lib/estado-encontro.ts` · `src/lib/agenda-minha.ts` ·
`src/lib/encerramento.ts` · `src/app/(app)/layout.tsx` · `tests/e2e/app/mentor.spec.ts` ·
`tests/e2e/app/plano-em-dia.spec.ts` · `tests/e2e/app/avaliacao.spec.ts` ·
`tests/e2e/demo/combinados.spec.ts` · `docs/convencoes/*` · `docs/regression-map.md`.
