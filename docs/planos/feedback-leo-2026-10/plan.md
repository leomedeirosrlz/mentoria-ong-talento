# Plano — feedbacks do Leo (26/out/2026)

> Fonte: `prompt-verbatim.md` nesta pasta. Feedback operacional do Leo
> repassado pelo Thiago, com arquivos-modelo em ~/Downloads.

## Bugs (prioridade — investigação em andamento)

| # | Item | Sintoma reportado | Hipótese inicial |
|---|------|-------------------|------------------|
| B1 | **Rename de cronograma/turma não propaga** | Leo renomeou cronograma e turmas; a Visão Geral continua com o nome antigo e as turmas novas aparecem **vazias** ao filtrar. | Nome materializado em outro lugar (duplicado na dupla/matrícula?) ou filtro por label em vez de id — o contexto `?turma=` resolve label→cronograma_id; se o filtro casa por string, rename orfa tudo. Turma nova vazia: filtro pode casar nome legado. |
| B2 | **Leak de campos no nome** | Em /duplas aparecem "Ele/Dele" e "Não tenho." como nome de mentorado (screenshot). | Import/matching gravou resposta de outra pergunta (pronome? campo livre?) na coluna de nome, ou a listagem lê a coluna errada do form importado. |
| B3 | **Nome editado não reflete no filtro** | Mudar o nome na tela de duplas não atualiza o filtro de duplas. | Dois caminhos de leitura: a lista lê `mentorados.nome` e o filtro monta opções de outra fonte (view/cache/materialized). |

## Dados / importação

| # | Item | Fonte |
|---|------|-------|
| D1 | Importar respostas dos forms de mentores e mentorados pro sistema | `Modelo Mentores/Mentorados_ dados para o matching (respostas).csv` (+ xlsx na pasta Mentoria - Brasil Participativo) |
| D2 | Reatribuir duplas das auxiliares — Marcela saiu | `Plantão de Duplas de Mentoria.pdf` + `Plantão de Duplas - Contatos.xlsx` = fonte da verdade |
| D3 | Formulário de inscrição de mentores (falta na plataforma) | CSV modelo em Downloads |
| D4 | Formulário de inscrição de mentorados (falta) | CSV modelo em Downloads |
| D5 | Avaliação 360/final atualizada pra ambos | `MENTOR/MENTORADO - Formulário de Avaliação Final da Mentoria (respostas).xlsx` |

## Cadastro / papéis

| # | Item | Notas |
|---|------|-------|
| C1 | Tirar `pref_genero_par` e campos sem sentido do cadastro de coord e demais papéis que não pareiam | Avaliar risco de mudança de papel depois (mentor vira coord?) — provável solução: esconder por papel no form em vez de apagar dados. |

## UI / UX

| # | Item |
|---|------|
| U1 | Aba Materiais + Biblioteca em **ordem cronológica** |
| U2 | Card de instrumento **inteiro clicável** abrindo "Ver respostas"; remover o botão |
| U3 | Contraste dos cards de turma em dark mode |
| U4 | Esconder/fechar Biblioteca sem conteúdo |

## Conteúdo / instrumentos

| # | Item |
|---|------|
| I1 | Apagar instrumentos do sistema: autoavaliação do mentor, anamnese social |
| I2 | Guias semanais: subir/terminar 5–10 (1–4 já estão em Downloads; 5–10 pendentes — confirmar) |
| I3 | Revisão densa dos guias DPP + Especialista (60+ págs): mapear instrumentos/materiais do app contra o que o guia manda — o que faz/não faz sentido manter |

## Ordem sugerida

1. B1+B2+B3 (bugs — agentes investigando; B1 é crítico por quebrar o filtro de turma que a coord usa no dia a dia)
2. D2 (reatribuição auxiliares — operação ao vivo, Marcela já saiu)
3. I1 + U1–U4 (débitos rápidos, mesma área de código: /materiais, /instrumentos, /turmas)
4. D1+D5 (importação — precisa de decisão de formato destino; provável `import` script ou RPC)
5. C1 (campos por papel — depende de decisão de risco de mudança de papel)
6. D3+D4 (forms de inscrição — REALIZA-36 forms engine é precedente natural)
7. I2+I3 (conteúdo — depende dos PDFs em mãos)

## Regras que valem pra todos

- Nomes de pessoas/turmas: fonte única — nada de materializar label em duas tabelas sem FK.
- Filtros casam por **id**, nunca por label (raiz provável de B1).
- Mudança de schema com dados reais: conferir tabela real antes de DDL (regra do repo).
- Importações de form = script idempotente + dry-run, nunca update manual em prod.

## Achados do recon (4 agents + queries em prod, 26/out)

- **B1 (223) confirmado e ampliado:** `atualizarCronograma` documenta a não-propagação de rename; display lê `duplas.turma` (label velho), filtro vem de `cronogramas.turma` (novo) → casa zero. Snapshots congelados extras: `profile_papeis.escopo_turma` (quebra grants re-escritos), `solicitacoes_especialista.turma`, `turma_inscricoes.turma`, `relatorio_links`, cookie `turma_foco`. `/registros` e agenda **já filtram por `cronograma_id`** — padrão existe. Fix: backfill 5 tabelas (cuidado `cronograma_id null` na trilha especialista) + propagar rename + migrar leituras pra id.
- **B3 (225):** provável dup de B1 — chips de turma montam de `d.turma` (label velho). Se for nome de pessoa, não há fonte divergente; precisa repro.
- **B2 (224) confirmado e reclassificado:** não é bug de mapeamento. `form_bruto` mostra os 3 valores verbatim da coluna "Nome social:" — respondentes escreveram pronome/negação/label no campo. Cleanup: 2×`null` + 1×"Andressa Venâncio" (confirmar com Leo). Prevenção: sanity check no import (pronome/negação/`:`+label → revisão).
- **C1 (231) armadilha:** `updatePessoa` é não-parcial — tirar campo do form antes de tornar a action parcial **apaga** o dado a cada save. Gatear `pref_genero_par` (e avaliar `motivacao`/`genero`/`data_nascimento`) por papel efetivo (`temPapel`), preservando híbridos.
- **U1 (232):** `BibliotecaLista.ordena` já é por `encontro_num`; `avaliacao_terceiros` está fora de ordem no array `CARDS`; `created_at` existe no banco, falta no type. Decisão: jornada × publicação.
- **U2 (233):** stretched-link (article `relative` + Link `after:inset-0`), footer `z-10`; preservar nome acessível "Ver respostas" (e2e depende). Nunca `<a>` envolvendo `<article>` com botões.
- **U3 (234) bug real:** `Tinta.soft` claro fixo em card escuro + `text-muted-foreground` claro dentro → falha de contraste nos dois sentidos. Fix: cor derivada da tinta no bloco ou tokens `--turma-*` com variantes dark.
- **U4 (235):** empty-state já existe; "fechar" = esconder aba pra não-coord (~5 linhas) — mas pra coord vazia remove o único CTA de publicar.
- **I1 (236) aliviado:** prod já tem os dois `ativo=false`, **0 respostas** históricas → só limpeza de UI/código, nada destrutivo. Ambiguidade real: "autoavaliação do mentor" = form do catálogo × rito de encerramento (`encerramentos.autoavaliacao_mentor`, mecanismo separado) — confirmar com Leo.
- **D4 (229) bloqueios laterais:** `finalizarPromocaoIntake` deleta mentorado recém-criado (FK `promovido_profile_id`→profiles); `prefillDoIntake` lê campo inexistente (`pref_genero_mentorado` vs `pref_genero_mentor`); `intake_mentorado` não tem form semeado. Corrigir junto com o form.
