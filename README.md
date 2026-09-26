<div align="center">
  <a href="#root"><img src="./docs/banner.svg?v=4" alt="realiza.vc · painel operacional do Programa de Mentoria Social" width="100%"/></a>
</div>

> 🇺🇸 [English version](docs/README.en.md) · plataforma, interface e dados em pt-BR por definição.

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-16.3-a2ca44?style=flat-square&logo=nextdotjs&logoColor=ffffff&labelColor=262626" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-a2ca44?style=flat-square&logo=react&logoColor=ffffff&labelColor=262626" alt="React" />
  <img src="https://img.shields.io/badge/Supabase-RLS_%2B_storage-a2ca44?style=flat-square&logo=supabase&logoColor=ffffff&labelColor=262626" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-v4-a2ca44?style=flat-square&logo=tailwindcss&logoColor=ffffff&labelColor=262626" alt="Tailwind" />
  <img src="https://img.shields.io/badge/testes-156_pass-ffd531?style=flat-square&labelColor=262626" alt="testes" />
</p>

## O que é

O Instituto Realiza.vc mantém um programa de mentoria social: cada mentor voluntário é pareado com um mentorado num ciclo guiado pelos guias oficiais do programa (DPP). Este repositório é o painel que a coordenação usa para operar esse programa.

A unidade de trabalho é a `dupla`, o par mentor + mentorado. O sistema cobre a vida inteira dela: o board de matching onde as duplas nascem, a jornada de 16 encontros no calendário oficial, o acompanhamento semanal que o mentor preenche depois de cada encontro, um semáforo de saúde recalculado a cada leitura, termos assinados eletronicamente, formulários públicos respondidos por link, registros de supervisão e um modo demo em `/demo` que não pede login.

## Papéis e acesso

Toda leitura e escrita passa por RLS no Postgres via `my_role()` / `my_profile_id()`:

| papel | escopo |
|---|---|
| `coordenacao` | tudo: duplas, pessoas, matching, formulários, assinaturas, exportações |
| `supervisor` | lê as duplas supervisionadas, registra supervisões |
| `mentor_dpp` | escreve só na própria dupla: agenda, registros, anexos |
| `mentor_especialista` | própria dupla + trilha de especialista (solicitação → mural → aceite atômico) |
| público | `/demo`, respostas em `/f/[token]`, assinatura do responsável em `/assinar/[token]`, `/privacidade` |

O signup é por allowlist (migration `0045`): um e-mail só entra se a coordenação já o cadastrou em `profiles`. Campos sensíveis (`*_pessoal`, `dados_civis`) são coord-only.

## Ciclo de vida da dupla

1. **Intake.** A coordenação pré-cadastra mentores e mentorados (existe importador CSV para a planilha de entrada). Ninguém se cadastra sozinho.
2. **Matching.** O board cruza a grade de disponibilidade e a afinidade dos dois lados; mentorado menor de 18 acende a necessidade da assinatura do responsável.
3. **Dupla ativa.** A dupla agenda os próprios encontros dentro do calendário oficial. A coordenação não agenda por ela: acompanha o semáforo e faz nudge por deep links `wa.me` com mensagens pt-BR prontas.
4. **Encerramento.** Um checklist cobre o rito de fechamento, a autoavaliação do mentor chega por RPC e a ficha da dupla imprime um resumo da jornada.

`dupla.status` anda `ativa → pausada → concluida | encerrada`. Em paralelo à trilha DPP, uma dupla pode rodar a trilha `mentor_especialista`: 5 encontros sem datas fixas, prazo de 3 meses e devolutiva pro PDM quando fecha.

## A jornada de 16 encontros

`ciclo_eventos` é o calendário oficial: 16 encontros, sempre às terças, com nome de fase e instrumentos sugeridos por encontro. A dupla agenda cada encontro (`unique(dupla_id, numero)`); depois que ele acontece, o mentor preenche o acompanhamento semanal (`atividades`, `avaliacao`, `dificuldade`, `proximo_passo`, combinados, anexos).

`jornadaDaDupla` (`src/lib/ciclo.ts`) transforma isso numa trilha por dupla em que cada nó está num de seis estados: realizado com registro, realizado sem registro, agendado e já passou (limbo), agendado, não aconteceu, futuro. Os marcos ficam no 1º, 8º (metade), 13º (reta final) e 16º encontros.

## O semáforo

`saudadeDaDupla` calcula a saúde da dupla a cada leitura; nada é persistido. Entradas: os encontros e registros da dupla, os combinados pendentes, o status e a data de início da dupla, e o calendário oficial. Encontros esperados são as datas de calendário já vencidas desde o início da dupla, menos as cobertas pelo limbo; `atraso = esperado - realizado`.

O primeiro sinal que bate define a cor:

| cor | acende quando |
|---|---|
| `risco` | um registro marcado `precisa_apoio` com a dupla ativa ou pausada · `avaliacao` "baixa" somada a `dificuldade` no último registro · 2+ encontros atrasados |
| `atencao` | exatamente 1 encontro atrasado · baixa ou dificuldade sozinhas · o encontro oficial da semana está a ≤5 dias e nada foi agendado (preventivo) · encontro realizado há 24h+ sem registro, ou agendado vencido sem confirmação (limbo) · combinado com prazo vencido (`encaminhamento` além do `prazo`) |
| `ok` | nenhum sinal. Duplas pausadas, concluídas e encerradas congelam em `ok`, mas um pedido de apoio ainda fura a pausa |

A trilha de especialista não tem calendário oficial, então nunca está "atrasada": o semáforo dela lê só os sinais que a própria dupla emite. A ordem de prioridade acima é o que `tests/ciclo-semaforo.test.ts` trava (29 testes).

## Superfícies públicas

| rota | o que faz |
|---|---|
| `/demo` | o app inteiro sobre um dataset fictício, sem conta |
| `/f/[token]` | responde um formulário por link individual, sem login |
| `/assinar/[token]` | o responsável assina o termo por link de uso único |
| `/privacidade` | aviso de privacidade |

A forms engine deixa a coordenação montar questionários (8 tipos de campo, até 40 perguntas) e emitir links por token individuais; é o canal que alcança o mentorado. Os formulários oficiais do programa (Anamnese, Avaliação 360º, Autoavaliação) entram imutáveis como forms de sistema, e a resposta do 360º já marca o checklist de encerramento sozinha.

Os termos são documentos versionados assinados com CPF e dígito verificador, evidência de IP + user-agent + hash SHA-256 e PDF gerado com página de evidências (pdf-lib). `termo_ok` deriva da linha de assinatura; os dados civis moram em `dados_civis` (coord-only) e sincronizam de volta pro documento ao assinar. O CSP põe `frame-ancestors 'none'` para essas rotas públicas nunca virarem iframe de phishing.

## Modo demo

<div align="center">
  <img src="./docs/demo.svg?v=2" alt="Modo demo público em /demo" width="720"/>
</div>

`/demo` roda o app sem conta. Um cookie `demo_role` escolhe uma das 4 personas, as queries reais trocam para um dataset evergreen (`src/lib/demo/data.ts`, datas derivadas de `new Date()`) que replica o escopo RLS de cada papel, um client supabase falso responde no browser (`client-stub.ts`), e toda mutação devolve `DEMO_MSG` em vez de gravar. Cada persona vê o próprio wizard de onboarding uma vez por visita.

## Autenticação

Magic link em fluxo implícito com handoff entre abas: o pedido gera um nonce, o link do e-mail cai em `/auth/link`, aquela aba publica a sessão em `login_handoffs` (uso único, TTL de 10 min), e a aba que pediu resgata o handoff por poll. O login sobrevive ao e-mail abrir num browser diferente do que pediu.

## Arquitetura

- `src/lib/queries.ts`: leituras server-side com `React.cache` + `auth.getClaims()` (valida o JWT local, sem round-trip).
- `src/lib/actions.ts`: server actions retornam `{ error }` ou `{ ok }`, nunca lançam.
- `src/lib/ciclo.ts`: domínio puro (semáforo, jornada, labels dos enums, datas, `waLink`), compartilhado entre app, dataset da demo e testes.
- `src/lib/supabase/{server,client,middleware}.ts`: um client por contexto; o middleware protege tudo exceto `/login`, `/auth/*` e as rotas públicas por token.
- 54 migrations SQL, RLS-first; escritas sensíveis passam por RPC (delete é coord-only, `realizado` é imutável, signup é allowlist).
- Buckets privados (`materiais`, `registro-anexos`) servidos por signed URLs (300s) em route handlers escopados (`/api/material/[id]`, `/api/anexo/[id]`).

## Stack

| camada | tech |
|---|---|
| app | Next.js 16.3.6 (App Router) · React 19.2.8 · TypeScript |
| ui | Tailwind v4 · Base UI + shadcn · Phosphor Icons · motion 13 · sonner |
| dados | Supabase (Postgres + Auth + Storage + RPC) · 54 migrations |
| docs | pdf-lib · Resend (e-mail transacional) |
| tooling | pnpm 11.3 · Vitest 5 · Vercel |

## Estrutura

```text
src/app/(app)/       shell autenticado: home, agenda, duplas, pessoas,
                     registros, formularios, materiais, perfil, assinar
src/app/auth/        pouso do magic link, confirmação do handoff, definir senha
src/app/{demo,f,assinar,login,privacidade}/
                     superfícies públicas (sem sessão)
src/app/api/         downloads assinados, export CSV, log de nudge
src/lib/             queries · actions · ciclo (domínio) · demo/ · forms/ · documentos/
supabase/migrations/ 0001-0055 · RLS-first
tests/               156 testes unitários de funções puras
```

## Setup

```bash
pnpm i

# .env.local aponta pro projeto Supabase remoto
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000

pnpm dev      # http://localhost:3000 · demo público em /demo
pnpm test     # vitest run → 156 testes, 10 arquivos
npx tsc --noEmit && npx eslint src/
```

Só entra quem está pré-cadastrado em `profiles`. Para explorar sem conta, abra `/demo` e escolha um papel na barra da demo.

## Docs

`docs/README.en.md` (English) · `../AGENTS.md` (regras + estado vivo do domínio) · `../BACKLOG.md` (roadmap priorizado) · `plano-mestre.md`, `roteiro-demo.md` · `fontes/` (guias oficiais do programa).
