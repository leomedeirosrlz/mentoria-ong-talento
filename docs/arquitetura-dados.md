# Arquitetura de dados — Realiza.vc

Modelo de dados da plataforma explicado pra leitura de negócio. Separa o que **já existe no banco** do que **foi decidido e ainda falta construir** (referências Jira REALIZA-x quando houver).

## Visão em camadas

```
PROGRAMA DE MENTORIA          (conceito — ainda não é tabela)
└── CICLO/TURMA               hoje: texto "2026/2027" → vira entidade (REALIZA-47)
    └── CRONOGRAMA            hoje: rows soltas em ciclo_eventos → vira entidade (REALIZA-15)
        └── DUPLA             mentor (com login) + mentorado (sem login) + auxiliar executivo
            ├── encontros     os 16 encontros agendados pela dupla
            ├── registros     follow-up semanal pós-encontro
            ├── encaminhamentos  ações encaminhadas pro mentorado (com prazo)
            ├── trilha DPP    = o programa principal
            └── trilha ESPECIALISTA  = trilha curta paralela (5 passos, 3 meses)
```

## Pessoas: duas tabelas, por LGPD e por login

| Tabela | Quem é | Login? |
|---|---|---|
| `profiles` | Todo mundo **com conta**: coordenação, auxiliar executivo, mentores | Sim (magic link) |
| `mentorados` | Mentorados — cadastrados pela coordenação | **Não** — interagem por links tokenizados (`/f/[token]`, `/assinar/[token]`) |

`profiles` carrega dados de matching (form_bruto = respostas brutas do form de inscrição, interesses, disponibilidade, preferências). Dados sensíveis ficam em views separadas (`profiles_pessoal`, `mentorados_pessoal`) que só a coordenação lê — a divisão já está na RLS, não é convenção.

Quando o mentorado ganhar conta um dia, tudo que foi coletado via token já está atrelado ao `mentorado_id` estável — migra sem perder histórico (decisão registrada, REALIZA-16).

## Papéis (`profiles.role` → enum `app_role`)

| Papel hoje | O que faz | O que vê |
|---|---|---|
| `coordenacao` | Administra tudo, faz matching, cadastra pessoas, acompanha semáforo | Tudo |
| `supervisor` | **Será renomeado → "auxiliar executivo"** (REALIZA-41). Responsável direto por um conjunto de duplas — faz nudge, acompanha | As duplas onde é `duplas.supervisor_id` |
| `mentor_dpp` | Mentor da trilha principal | **Só a própria dupla** — escreve encontros e registros nela |
| `mentor_especialista` | Mentor experiente da trilha curta | Suas duplas de especialista + mural de solicitações |

**Confusão de nomenclatura que vale fixar:** o papel "supervisor" do banco hoje = o que chamamos de **auxiliar executivo** (acompanha duplas diretamente, por `duplas.supervisor_id`). O "supervisor" no sentido que a Kelyng descreveu — **mentor experiente que supervisiona a prática do mentor** — já existe, mas como a tabela `supervisoes`: sessões supervisor × mentor (com `dupla_id` opcional), registradas pelo supervisor, visíveis pro mentor (transparência) e pra coordenação. O rename (REALIZA-41) resolve essa colisão de nomes.

## A dupla — unidade central

```
duplas
├── mentor_id       → profiles (mentor_dpp ou mentor_especialista)
├── mentorado_id    → mentorados
├── supervisor_id   → profiles (auxiliar executivo que acompanha essa dupla)
├── ciclo           → texto "2026/2027" (= a turma, hoje)
├── trilha          → 'dpp' | 'especialista'
├── status          → ativa | pausada | encerrada | concluida
├── iniciada_em / encerrada_em / motivo_encerramento
├── pdm_url, devolutiva_pdm, demanda
└── solicitacao_id  → se nasceu de uma solicitação de especialista
```

**Regra de ouro gravada no modelo:** a dupla agenda os próprios encontros; coordenação monitora e faz nudge. Por isso `encontros` é escrita pelo mentor da dupla, e a coordenação só lê + notifica.

## Ciclo e cronograma — o que existe e o que falta

**Hoje:** `ciclo_eventos` é uma lista plana de eventos oficiais (16 encontros + eventos de formação), cada row marcada com `ciclo = '2026/2027'`. Funciona pra UM cronograma. Com dois cronogramas simultâneos (T1 + T2 começando 06/10), o semáforo conta evento das duas turmas junto → falso risco em massa. O diagnóstico completo tá em `planos/turmas-cronogramas.md`.

**Decidido (REALIZA-15 → 47):**

```
programas ──< turmas ──< cronogramas ──< ciclo_eventos (datas pertencem ao cronograma)
                              ▲
                     duplas.turma_id + duplas.cronograma_id
```

- **Turma** = a coorte, unidade de pertença (vaga do mentorado é por turma, não por cronograma)
- **Cronograma** = o calendário: datas, número de encontros, instrumentos de cada encontro
- Uma turma pode ter mais de um cronograma; DPP e especialista são **trilhas da dupla**, não cronogramas diferentes

## Trilha DPP × trilha Especialista

**DPP** é a trilha principal: 16 encontros, cronograma oficial, semáforo.

**Especialista** é paralela e curta — nasce de uma necessidade pontual:

```
dupla DPP pede apoio (solicitacoes_especialista: demanda + mentorado)
  → vai pro mural (solicitacoes_mural) visível aos especialistas
  → especialista aceita atomicamente (aceitar_solicitacao)
  → cria dupla especialista (trilha='especialista', ligada à dupla_dpp)
  → 5 passos em especialista_eventos, prazo de 3 meses
  → devolutiva final chega ao mentor DPP (duplas.devolutiva_pdm)
```

Um mentorado tem **1 dupla DPP ativa** e opcionalmente **1 trilha especialista** — nunca duas DPP (constraint no banco).

## A vida da dupla (fluxo de dados)

```
matching (coord monta dupla com AfinidadePar + fichas)
  → duplas (ativa)
  → encontros: mentor agenda nº 1..16 (unique por dupla+número)
       status: agendado → realizado | remarcado | nao_aconteceu
       (realizado é imutável — guard 0043)
  → registros: pós-encontro, campos do form semanal oficial
       (atividades, avaliação, dificuldade, próximo passo)
  → SEMÁFORO (derivado na leitura, src/lib/ciclo.ts):
       esperados (ciclo_eventos já vencidos) vs. realizados
       risco: pedido de apoio | avaliação baixa + dificuldade | ≥2 atrasados
       atenção: 1 atraso | avaliação baixa | dificuldade | registro pendente | encaminhamento vencido
  → nudge da coordenação/auxiliar (notificacoes)
  → encerramentos: checklist do rito de fechamento
```

## Estruturas de apoio

| Tabela | Papel |
|---|---|
| `supervisoes` | Sessões supervisor (mentor experiente) × mentor; transparente pro mentor |
| `presencas` | Chamada de formação por evento × profile → alimenta `mentor_profiles.formacao_ok` |
| `formularios` + `formulario_links` + `formulario_respostas` | Forms engine nativa: coord cria forms, gera links por token, público responde sem login. Forms oficiais do sistema são imutáveis |
| `assinaturas` + `documento_templates` | Assinatura eletrônica com hash, IP, PDF de evidências; termos versionados |
| `documentos_pessoa` | Documentos por pessoa (termos, autorizações) |
| `encaminhamentos` | Ações encaminhadas com prazo — vencido vira sinal de atenção no semáforo |
| `materiais` | Biblioteca de materiais por encontro/audiência (upload real, signed URL) |
| `comunicados`, `notificacoes` | Comunicação coord → pessoas + caixa de notificações |
| `interacoes`, `pessoa_notas`, `encontro_notas`, `registro_anexos` | Timeline de contatos, notas internas por pessoa, notas de encontro, evidências anexadas |

## Visibilidade (RLS)

Toda leitura/escrita passa por `my_role()` e `my_profile_id()`:

- **coordenacao** → tudo
- **auxiliar executivo** (`supervisor` atual) → lê as duplas que supervisiona; não escreve nelas (quem escreve é o mentor)
- **mentor** → lê/escreve só na própria dupla; dados sensíveis do mentorado ficam fora (coord-only)
- **mentorado** → não tem login; tokens com escopo próprio
- **deleção** de encontros/registros → coord-only (guard 0047)

## O que não existe ainda (e já tá no backlog)

- Entidades `programas`, `turmas`, `cronogramas` (REALIZA-15/47) — hoje tudo é o texto `ciclo`
- Escopo do auxiliar **por turma** em vez de por dupla (REALIZA-32)
- Papel por contexto — mesma pessoa com papéis diferentes por programa (decidido: REALIZA-48/43)
- Snapshot do semáforo em série temporal (REALIZA-74) — hoje é derivado na leitura, sem histórico
- PDM e Roda da Vida como entidades nativas (REALIZA-17/18)
