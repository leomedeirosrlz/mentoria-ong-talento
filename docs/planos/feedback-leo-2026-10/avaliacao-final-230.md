# REALIZA-230 — Avaliação final da mentoria (360º): mapeamento técnico

> Insumo: `~/Downloads/MENTOR- Formulário de Avaliação Final da Mentoria. (respostas).xlsx`
> (8 respostas) e `~/Downloads/MENTORADO - Formulário de Avaliação Final da Mentoria.   (respostas).xlsx`
> (3 respostas). Só o cabeçalho (linha 1) é fonte das perguntas; as respostas
> foram lidas apenas para **inferir tipo de campo e obrigatoriedade** (o xlsx
> do Google Forms não carrega validação nem opções de múltipla escolha).
> Estado do código conferido em `/home/thiago/nb/realiza.vc` em 27/out/2026.
> Atenção: o working tree tem mudanças em curso em `src/lib/forms/*`,
> `src/lib/demo/forms-data.ts` e `src/lib/database.types.ts` (frente
> REALIZA-229). As linhas citadas abaixo valem para **esse** estado; reconferir
> o `git diff` da branch antes de aplicar.

---

## 0. TL;DR

1. **Os dois formulários novos não são o mesmo instrumento.** Hoje existe **um**
   form oficial `avaliacao_360` com 10 perguntas, servido igualmente a mentor e
   mentorado. Os formulários novos são **dois conjuntos distintos** (11 perguntas
   para o mentor, 23 numeradas para o mentorado), sem praticamente nenhuma pergunta em
   comum com as 10 atuais.
2. **Não existe versionamento de instrumento no código.** `formularios.versao`
   é um contador do builder para forms comuns; em form de sistema a definição é
   **congelada pelo trigger `guard_formulario_sistema` (0042)** e as respostas
   **não guardam a versão** (`formulario_respostas` = `{campo_id: valor}`).
   Logo, "só atualizar a definição" é possível tecnicamente (precedente: 0128
   desabilita o trigger), mas **reinterpreta respostas antigas** — as chaves
   órfãs sobrevivem no banco e no CSV, e somem da aba Respostas.
3. **Hoje não há resposta 360 em lugar nenhum fora do modo demo.** Prod
   (`yhjzmxleotahijinjepl`): form `ativo=false` desde 18/out/2026, **0 links e 0
   respostas** (`formulario_respostas` inteira tem 0 linhas). Staging (backend
   dos previews): **0 links e 0 respostas** do 360; as 10 respostas que existem
   lá são `demo-*` de `roda_vida`. O único dataset com 360 é o modo demo
   (`src/lib/demo/forms-data.ts`), que é código. A decisão de migração pode ser
   feita pelo desenho, não pelo legado.
4. **Proposta**: dois forms oficiais novos (`avaliacao_final_mentor`,
   `avaliacao_final_mentorado`), a row `avaliacao_360` fica **intacta e
   arquivada** (`ativo=false`) como histórico legível, e o painel/jornada
   normalizam o par na chave `avaliacao_360` que o TS já consome. Custo: **1
   migration** (CHECK + 2 inserts + 3 RPCs re-emitidas) + ~12 arquivos de
   código/dados.
5. **Risco de produto que precisa de decisão antes de codar**: o formulário
   novo **derruba a única leitura quantitativa de fim de jornada** (vínculo,
   evolução do jovem, efeito do PDM/Roda, regularidade) e **não pergunta mais
   se o mentor segue disponível no próximo ciclo** — que hoje é a única fonte
   desse dado para a coordenação (ver §7).

---

## 1. Estado atual do `avaliacao_360` no app

| Peça | Onde | O que faz hoje |
|---|---|---|
| Definição | `supabase/migrations/0042_formularios_sistema.sql:121-132` | 10 campos, `sistema='avaliacao_360'`, id `5eed0001-…-0002` |
| Espelho no demo | `src/lib/demo/forms-data.ts:208-228` | mesmos 10 campos, verbatim |
| Emissão | `src/lib/forms/actions.ts:203-290` (`gerarLinksFormulario`; o comentário que libera o 360 está em `:262`) | genérica: 1 link por destinatário (`dest_profile_id` p/ mentor, `dest_mentorado_id` p/ mentorado); **não** passa pelas RPCs de instrumento |
| UI de emissão | `src/components/enviar-formulario-dialog.tsx:98-113`; `src/components/encerramento-dupla.tsx:149-170` | dialog "Enviar formulário" com sugestão pelo selo "360" |
| Marca do checklist | `supabase/migrations/0115_intake_mentores.sql:653-659` | **qualquer** resposta 360 com `dupla_id` grava `checklist.avaliacao_360_enviada=true` |
| Item do checklist | `src/lib/encerramento.ts:40-43` | label "Avaliação 360º enviada ao mentor e ao mentorado" |
| Data exibida na ficha | `src/lib/queries-encerramento.ts:76-104` | busca o form por `sistema='avaliacao_360'` e a resposta mais recente da dupla |
| Jornada do jovem | `supabase/migrations/0099_jornada_autoemit.sql:346-373` (`jovem_jornada`) | devolve só os links `dest_mentorado_id` do sistema 360 |
| Painel de coordenação | `supabase/migrations/0125_auxiliar_escopo_turma.sql:875-903` (`painel_instrumentos_jornada`) | `jsonb_object_agg(f.sistema, …)` → chave `entregas.avaliacao_360` |
| Leitura no TS | `src/lib/jornada.ts:102,248-256,380-390,872-880` | estação `avaliacao_360` (enc. 16), snippet lê `o_que_leva`/`melhorar`, painel filtra `destino='mentorado'` |
| Ver respostas agregadas | `src/app/(app)/formularios/respostas-section.tsx:163-200` (`agregaRespostas`) | agrega **os dois lados juntos** na mesma média/contagem |
| CSV | `src/app/api/export/route.ts:740-806` | perguntas atuais viram colunas; chaves órfãs vão pro fim com o id cru |
| Régua de /materiais | `src/app/(app)/materiais/instrumentos-programa.tsx:122-128` | card "Avaliação 360º e autoavaliação", `sistemaForm: "avaliacao_360"` (título obsoleto desde a 0128) |

Dois fatos de estado que importam para o plano:

- **O form está desativado em prod** (`ativo=false`, `updated_at` 18/out). A
  coordenação não consegue emitir 360 hoje; reativar faz parte desta entrega.
- **`encerramentos.avaliacao_360_enviada` fica verdadeiro com uma resposta
  só** (mentor *ou* mentorado). Com dois formulários, "enviada ao mentor e ao
  mentorado" passa a ter dois fatos distintos (§4.3).

---

## 2. Perguntas do formulário novo

Legenda de evidência: `col X` = coluna do xlsx (letra da planilha);
`n/k` = quantas das k respostas preencheram a coluna (proxy de obrigatoriedade,
já que o Google Forms não exporta `required`). O texto literal está sem os
espaços e quebras de linha finais do xlsx. Tipos: **escala 1–5**,
`texto` (resposta curta), `texto_longo`, `multi_select`, `sim_nao`,
`select` (lista de opções), conforme `src/lib/forms/schema.ts:7-19`.

### 2.1 MENTOR — 11 perguntas + consentimento (`col F` a `col Q`)

| # | Pergunta literal | Evidência | Tipo proposto | Obrig.? | Campo atual |
|---|---|---|---|---|---|
| 1 | "Como você avalia a estrutura do programa de mentoria." | col F, 8/8 (`Boa.`, `Excelente.`, `Regular.`) | `texto` | provável sim | **novo** `estrutura_programa` |
| 2 | "Você acha que tem algo que poderia ser melhorado no processo de mentoria?" | col G, 8/8 | `texto_longo` | provável sim | **novo** `melhorar_processo` |
| 3 | "Seu mentorado teve dificuldades ligadas a questões materiais para participar da mentoria (acesso a computadores, acesso a internet, local com privacidade para acesso) etc? Se sim, nos especifique." | col H, 8/8 | `texto_longo` | provável sim | **novo** `dificuldade_material` |
| 4 | "Você teve dificuldades de agendar horários ou realizar os encontros com seu mentorados? Em caso afirmativo, por favor descreva os principais motivos dessa dificuldade em agendar os encontros." | col I, 8/8 | `texto_longo` | provável sim | **novo** `dificuldade_agenda` |
| 5 | "Você sentiu dificuldade, ou teve dificuldade em realizar alguma parte específica da metodologia com seu mentorado? Caso positivo nos conte a respeito." | col J, 8/8 | `texto_longo` | provável sim | **novo** `dificuldade_metodologia` |
| 6 | "Algum dos instrumentos/atividades propostos pela metodologia se mostraram problemáticas, ou emperraram e foi difícil conseguir que o mentorado chegasse a uma resposta a contento? Em caso afirmativo, conte nos mais." | col K, 8/8 | `texto_longo` | provável sim | **novo** `instrumentos_problematicos` |
| 7 | "Tem algum outro aspecto da metodologia que você acredita que não funcionou bem ou que pode ser aprimorado?" | col L, 8/8 | `texto_longo` | provável sim | **novo** `melhorias_metodologia` |
| 8 | "Como você avalia o suporte recebido do Realiza.vc ao longo do ciclo de mentoring?" | col M, 8/8 (`Bom.`, `Ótimo.`, `Regular.`) | `texto` | provável sim | **novo** `avaliacao_suporte` |
| 9 | "Tem algum suporte ou atividade específica por parte do Realiza que você considera que seria importante de ser disponibilizado ou aprimorado?" | col N, 8/8 | `texto_longo` | provável sim | **novo** `sugestao_suporte` |
| 10 | "Quais foram as principais dificuldades e os principais desafios enfrentados na mentoria?" | col O, 8/8 | `texto_longo` | provável sim | **novo** `dificuldades_mentoria` |
| 11 | "Campo livre para você expressas considerações e sugestões, sobre a metodologia, sobre o programa, sobre o instituto, o que desejar, queremos lhe ouvir." | col P, 6/8 | `texto_longo` | provável **não** | **novo** `consideracoes` |
| C | "Podemos divulgar seu depoimento em nossos materiais de comunicação?" | col Q, 8/8 (`Sim, com o meu nome.` 5×, `Sim, porém de forma anônima.`, `Não.` 2×) | `select` (3 opções) | provável sim | **novo** `depoimento` |

Identificação (col B "Seu nome completo.", col C "Nome do Mentorado(a).",
col D "Início da mentoria.", col E "Fim da mentoria."): **não replicar** — o
link já é nominal (`formulario_por_token` devolve `destinatario`) e as datas
moram em `duplas.iniciada_em`/`encerramentos`. Registro de que
`col E` chegou corrompida em uma resposta (`6/30/0025`), o que reforça não
pedir data de novo.

**Nenhuma pergunta do mentor novo é escala 1–5** — as colunas F e M parecem
escala mas são resposta curta: as pessoas escreveram a palavra com flexão de
gênero ("Boa." para *estrutura*, "Bom." para *suporte*), o que não acontece em
múltipla escolha.

### 2.2 MENTORADO — 23 numeradas + consentimento (`col F` a `col AC`; 22 válidas, a Q14 é duplicata)

| # | Pergunta literal | Evidência | Tipo proposto | Obrig.? | Campo atual |
|---|---|---|---|---|---|
| 1 | "Em uma escala de 1 a 5, o quanto a mentoria atendeu às suas expectativas?" | col F, 3/3 (`5- Muito satisfeito.`, `4- Satisfeito.`) | `escala_1_5` | provável sim | **novo** `expectativa_atendida` |
| 2 | "O que você esperava alcançar na mentoria?" *(sem instrução no cabeçalho, mas as respostas são listas)* | col G, 3/3 (`Desenvolvimento profissional., Melhorar habilidades técnicas., Aumentar networking., Obter insights sobre o mercado.`) | `multi_select` | provável sim | **novo** `expectativas` |
| 3 | "Como você avalia a estrutura do programa de mentoria." | col H, 3/3 (`Excelente.`) | `texto` | provável sim | **novo** `estrutura_programa` (mesmo id do mentor) |
| 4 | "Quais aspectos da mentoria você considerou mais úteis? / Marque todas as opções que se aplicam." | col I, 3/3 (`Sessões individuais com o mentor.`, `Materiais de apoio fornecidos.`, `Exercícios práticos.`, `Feedback recebido.`) | `multi_select` | provável sim | **novo** `aspectos_uteis` |
| 5 | "O que poderia ser melhorado na mentoria? / Marque todas as opções que se aplicam." | col J, 3/3 (`Inclusão de conteúdos mais práticos.`, `Está tudo muito bom`) | `multi_select` | provável sim | **novo** `melhorar_opcoes` |
| 6 | "Você acha que tem algo que poderia ser melhorado no processo de mentoria?" | col K, 3/3 | `texto_longo` | provável sim | **novo** `melhorar_processo` (mesmo id do mentor) |
| 7 | "Como você avalia a comunicação e suporte do seu mentor?" | col L, 3/3 (`Excelente.`) | `texto` | provável sim | **novo** `avaliacao_mentor` |
| 8 | "O mentor ajudou a esclarecer suas dúvidas e a desenvolver suas habilidades?" | col M, 3/3 (`Sim.`) | `sim_nao` | provável sim | **novo** `mentor_ajudou` |
| 9 | "Caso a resposta anterior for "não" nos conte o que houve para o mentor não esclarecer as suas dúvidas e desenvolver as suas habilidades." | col N, 0/3 | `texto_longo` + `visible_if: mentor_ajudou = "nao"` | condicional | **novo** `mentor_ajudou_nao` |
| 10 | "Você recomendaria este mentor para outros mentorados?" | col O, 3/3 (`Sim.`) | `sim_nao` | provável sim | **novo** `recomendaria_mentor` |
| 11 | "Você realizou mudanças na sua vida profissional/pessoal devido a mentoria?" | col P, 3/3 (`Sim.`) | `sim_nao` | provável sim | **novo** `mudancas_realizadas` |
| 12 | "Você se sente mais preparado para enfrentar desafios após a mentoria?" | col Q, 3/3 (`Sim.`) | `sim_nao` | provável sim | **novo** `mais_preparado` |
| 13 | "Se sim, quais mudanças você realizou? / Marque todas que se aplicam." | col R, 3/3 (`Mudei minha forma de buscar emprego/oportunidades.`, `Aprimorei minhas habilidades profissionais.` + 1 texto livre) | `multi_select` + `permite_outro` + `visible_if: mudancas_realizadas = "sim"` | condicional | **novo** `quais_mudancas` |
| 14 | "Você se sente mais preparado para enfrentar desafios após a mentoria?" | col S, 3/3 | **descartar: duplicata literal da 12** | — | — |
| 15 | "Você teve dificuldades de agendar horários com seu mentor? Em caso afirmativo, por favor descreva os principais motivos dessa dificuldade em agendar os encontros." | col T, 3/3 | `texto_longo` | provável sim | **novo** `dificuldade_agenda` (mesmo id do mentor) |
| 16 | "Você se sentiu desconfortável com alguma das atividades/tarefas propostas?" | col U, 3/3 (`Talvez.`, `Sim.`, `Talvez.`) | `select` `["Sim","Não","Talvez"]` | provável sim | **novo** `desconforto_atividades` |
| 17 | "Você teve dificuldade para realizar algumas das atividades propostas pelo mentor? Se sim, por favor nos conte um pouco mais sobre qual atividade teve dificuldade e o que aconteceu." | col V, 3/3 | `texto_longo` | provável sim | **novo** `dificuldade_atividades` |
| 18 | "Teve algum fator que te desmotivou em participar da mentoria? Se sim, qual foi a razão que te desmotivou?" | col W, 3/3 | `texto_longo` | provável sim | **novo** `desmotivacao` |
| 19 | "Teve alguma outra razão que você não gostou do processo de mentoria? Se sim, conte nos mais." | col X, 3/3 | `texto_longo` | provável sim | **novo** `insatisfacao` |
| 20 | "A mentoria foi útil pra você? Conte-nos um pouco porque sim ou porque não." | col Y, 3/3 | `texto_longo` | provável sim | **novo** `utilidade` |
| 21 | "O que você mais gostou na mentoria?" | col Z, 3/3 | `texto_longo` | provável sim | **novo** `o_que_mais_gostou` |
| 22 | "Quais pontos podem ser melhorados no programa de mentoria?" | col AA, 3/3 | `texto_longo` | provável sim | **novo** `melhorias_programa` |
| 23 | "Tem alguma sugestão que você gostaria de complementar sobre a mentoria?" | col AB, 1/3 | `texto_longo` | provável **não** | **novo** `sugestao` |
| C | "Podemos divulgar seu depoimento em nossos materiais de comunicação?" | col AC, 3/3 (`Não.`, `Sim, com meu nome.`, `Sim, mas de forma anônima.`) | `select` (3 opções) | provável sim | **novo** `depoimento` |

Identificação (col B nome, col C nome do mentor, col D início, col E término):
**não replicar**, mesma razão do mentor.

**Q1 é a única escala real** do formulário novo. As opções observadas vêm com
o rótulo colado no número (`5- Muito satisfeito.`, `4- Satisfeito.`); 1, 2 e 3
nunca foram marcados, então **não há evidência do texto deles**. O renderer de
`escala_1_5` (`src/app/f/[token]/formulario-publico.tsx:952-978`) mostra só os
números 1–5, de propósito ("sem pontas Muito ruim/Muito bom"). Ver §7, item 1.

---

## 3. Diff campo a campo

### 3.1 As 10 perguntas atuais

| Campo atual | Tipo atual | Destino | Impacto |
|---|---|---|---|
| `vinculo` | escala 1–5 | **remover** | some a única nota de vínculo de fim de ciclo. Só existe em `avaliacao_360` (`0042:122`); nenhum outro código lê a chave. |
| `evolucao_jovem` | escala 1–5 | **remover** | idem (evolução do jovem no ciclo). |
| `pdm_roda` | escala 1–5 | **remover** | idem (efeito do PDM/Roda). O PDM tem leitura própria (`pdm`, migration 0109), mas não a percepção de efeito. |
| `regularidade` | sim/não | **remover** | a regularidade é observável em `encontros` (data/status de cada um) e no semáforo `saudadeDaDupla` (`src/lib/ciclo.ts`); não existe nota, só o fato. Perda pequena. |
| `experiencia_programa` | escala 1–5 | **remover** | substituída conceitualmente por `estrutura_programa` (texto) + `expectativa_atendida` (escala). **Não renomear**: construto e tipo diferentes. |
| `apoio_coordenacao` | escala 1–5 (opc.) | **remover** | substituída por `avaliacao_suporte` (mentor) e `sugestao_suporte`. |
| `o_que_leva` | texto longo | **remover** | era o "snippet" da estação 360 na jornada do jovem (`src/lib/jornada.ts:383`) e do teste `src/lib/jornada.test.ts:505`. Precisa de novo id no fallback. |
| `melhorar` | texto longo (opc.) | **renomear → `melhorar_processo`** | mesma intenção ("o que o programa poderia melhorar"), agora nos dois lados com o mesmo id. Nenhum código lê a chave. |
| `disponivel_proximo_ciclo` | sim/não (opc.) | **remover — decisão pendente** | é a única fonte da disponibilidade do mentor para o próximo ciclo (0128 cita isso explicitamente). Não existe pergunta equivalente no xlsx novo. Ver §7, item 7. |
| `capacidade_proximo_ciclo` | texto (opc.) | **remover — decisão pendente** | idem (quantos jovens o mentor acompanha). |

### 3.2 Campos novos

Todos são "criar". Onde o construto é espelhado entre os dois lados, o **id é o
mesmo** nos dois forms (as respostas vivem em `formulario_respostas` distintas, não
há colisão, e o id comum permite comparação mentor × mentorado depois):

| id | Lados | Tipo | Observação |
|---|---|---|---|
| `estrutura_programa` | ambos | `texto` | mentor Q1 / mentorado Q3 |
| `melhorar_processo` | ambos | `texto_longo` | mentor Q2 / mentorado Q6 (herda `melhorar`) |
| `dificuldade_agenda` | ambos | `texto_longo` | mentor Q4 / mentorado Q15 |
| `depoimento` | ambos | `select` | 3 opções; consentimento de imagem/depoimento (LGPD) |
| `expectativa_atendida` | mentorado | `escala_1_5` | rótulos 1–5 a confirmar |
| `expectativas` | mentorado | `multi_select` | opções a confirmar |
| `aspectos_uteis` | mentorado | `multi_select` | idem |
| `melhorar_opcoes` | mentorado | `multi_select` | idem |
| `avaliacao_mentor` | mentorado | `texto` | |
| `mentor_ajudou` | mentorado | `sim_nao` | gatilho de `mentor_ajudou_nao` |
| `mentor_ajudou_nao` | mentorado | `texto_longo` | `visible_if` |
| `recomendaria_mentor` | mentorado | `sim_nao` | |
| `mudancas_realizadas` | mentorado | `sim_nao` | gatilho de `quais_mudancas` |
| `mais_preparado` | mentorado | `sim_nao` | (a Q14 duplicada é descartada) |
| `quais_mudancas` | mentorado | `multi_select` + `permite_outro` | `visible_if` |
| `desconforto_atividades` | mentorado | `select` Sim/Não/Talvez | 3 estados: `sim_nao` não serve |
| `dificuldade_atividades` | mentorado | `texto_longo` | |
| `desmotivacao` | mentorado | `texto_longo` | |
| `insatisfacao` | mentorado | `texto_longo` | |
| `utilidade` | mentorado | `texto_longo` | |
| `o_que_mais_gostou` | mentorado | `texto_longo` | |
| `melhorias_programa` | mentorado | `texto_longo` | |
| `sugestao` | mentorado | `texto_longo` | |
| `dificuldade_material` | mentor | `texto_longo` | |
| `dificuldade_metodologia` | mentor | `texto_longo` | |
| `instrumentos_problematicos` | mentor | `texto_longo` | |
| `melhorias_metodologia` | mentor | `texto_longo` | |
| `avaliacao_suporte` | mentor | `texto` | |
| `sugestao_suporte` | mentor | `texto_longo` | |
| `dificuldades_mentoria` | mentor | `texto_longo` | |
| `consideracoes` | mentor | `texto_longo` | |

Não há `secao` obrigatória: os dois lados são forms separados, então não é
preciso separar por "Para o mentor / Para o mentorado". Sugestão de `secao`
opcional para dar ritmo ao mentorado (23 perguntas com o consentimento): "Sobre a mentoria",
"Sobre você", "Sobre o programa".

### 3.3 Impacto por consumidor

| Consumidor | O que muda |
|---|---|
| `CHAVE` de resposta | ids antigos (`vinculo`, `o_que_leva`…) deixam de existir no form novo. Respostas antigas continuam no banco e no CSV como **órfãs** (`src/app/api/export/route.ts:746-757`), mas somem da aba Respostas (`agregaRespostas` itera a definição). |
| Relatórios/agregação | `respostas-section.tsx` passa a agregar **um lado por vez** (bom: acaba a média que somava mentor e mentorado na mesma coluna). Nada mais lê as escalas 1–5 antigas. |
| Checklist de encerramento | a chave `avaliacao_360_enviada` fica (vocabulário fechado do `encerramentos.checklist`). O gatilho SQL precisa reconhecer os dois sistemas (§5, passo 1). |
| Jornada do jovem | `jovem_jornada` filtra `f.sistema='avaliacao_360'` → passa a apontar o sistema do lado mentorado. `Entrega360`/estação `avaliacao_360` no TS seguem com o mesmo nome. |
| Painel de coordenação | `entregas.avaliacao_360` deve continuar existindo (normalizar o par em SQL ou somar os dois no TS). Sem isso o card do 360 fica eternamente "não abriu". |
| LGPD | `docs/lgpd/inventario-dados.md:97` descreve o 360 como "vínculo, evolução, PDM — mentor **e** jovem". Precisa reescrever a linha e registrar o novo consentimento de depoimento. |

---

## 4. Decisão de migração

### 4.1 Dá para só atualizar a definição?

Tecnicamente sim, e o precedente é a 0128 (`alter table public.formularios
disable trigger formularios_sistema_guard;` → muda → `enable`). Mas:

- **Não existe versionamento de instrumento.** `formularios.versao` sobe só no
  builder para forms comuns (`src/lib/forms/actions.ts:101-116`) e o guard 0042
  congela `versao` em form de sistema. `formulario_respostas` guarda apenas
  `{campo_id: valor}` — **não há snapshot da definição nem `formulario_versao`
  na resposta**. Ou seja: a resposta antiga não sabe com que perguntas foi
  respondida.
- Atualizar a mesma row troca os rótulos das respostas antigas: os ids que
  somem viram órfãos (CSV preserva, aba Respostas perde). Se um dia houver
  respostas de verdade, isso é perda de leitura, não de dado.

**Hoje isso é irrelevante**: 0 respostas em prod (verificado). O argumento de
preservação vale para o ciclo que vem.

### 4.2 Opções

| | Desenho | Migration | Churn | Veredito |
|---|---|---|---|---|
| **A** | 1 sistema novo + reaproveitar `avaliacao_360` para o **lado mentorado** (a jornada/painel/jovem já só olham esse lado) | CHECK + 1 insert + definição da row existente + 1 RPC | baixo | mais barato, mas `avaliacao_360` passa a significar "formulário do mentorado", o que confunde quem lê o código. |
| **B (recomendada)** | 2 sistemas novos (`avaliacao_final_mentor`, `avaliacao_final_mentorado`); `avaliacao_360` fica **intacta e inativa** como histórico; painel normaliza o par na chave `avaliacao_360` | CHECK (2 valores) + 2 inserts + 3 RPCs | médio | semântica limpa, histórico legível sem gambiarra, custo extra é reescrever 3 funções que já teriam de ser tocadas. |
| **C** | criar os 2 forms como **não-oficiais** (builder, `sistema = null`) | nenhuma | baixo | rejeitar: não entram na régua/jornada, o checklist nunca carimba e a definição fica editável por qualquer coord. |

**Recomendação: B.** A é mais curto mas cria um nome mentiroso (`avaliacao_360`
deixaria de ser "a avaliação dos dois lados" para ser "a do jovem") — e o valor
de `sistema` é lido por 3 RPCs (submit, `jovem_jornada`,
`painel_instrumentos_jornada`) e 8 arquivos de TS; nome errado custa caro em
manutenção. B paga ~1 arquivo a mais hoje e mantém o vocabulário honesto.

### 4.3 Consequência de B no checklist (decisão de produto)

Hoje **qualquer** resposta 360 marca `avaliacao_360_enviada`. Com dois forms há
três comportamentos possíveis:

1. **Qualquer uma marca** (zero mudança de comportamento, diff mínimo).
2. **Só a do mentorado marca** (alinhado com jornada/painel, que só contam a
   entrega dela). O mentor deixa de carimbar sozinho.
3. **As duas marcam** (`count(distinct sistema) = 2`) — mais correto em relação
   ao label "enviada ao mentor e ao mentorado", mais SQL.

Proposta: **(1)** nesta entrega (não muda comportamento nem e2e do checklist) e
abrir issue para o (3), que exige decidir se o item passa a desmarcar quando só
um lado responde.

---

## 5. Plano de implementação

Ordem pensada para não quebrar preview/staging (AGENTS: migration no staging
**antes** do push da branch; em prod **antes** do merge).

### Passo 0 — fechar as perguntas com Leo (bloqueia o passo 1)

- Tipos das colunas F e M do mentor e H e L do mentorado (texto confirmado?).
- Opções completas dos 4 `multi_select` do mentorado (só temos as observadas).
- Rótulos 1–5 da Q1 do mentorado.
- Redação do consentimento (3 opções; o xlsx mostra "porém" e "mas").
- Bateria duplicada Q12/Q14 e a ordem da Q13 (o "se sim" parece se referir à
  Q11, não à Q12).
- Decidir sobre `disponivel_proximo_ciclo` / `capacidade_proximo_ciclo` (§7, item 7).

### Passo 1 — migration `supabase/migrations/0129_avaliacao_final_dupla360.sql`

1. Expandir o CHECK de `formularios.sistema` (última versão em
   `0128:60-73`) com `avaliacao_final_mentor` e `avaliacao_final_mentorado`.
2. `insert` das duas rows (`on conflict do nothing`, ids fixos no padrão
   `5eed0002-0000-4000-8000-00000000000{1,2}`, `created_by` null), com os
   `campos` do §2/§3 e `versao: 1`.
3. Garantir `ativo=false` na row antiga (`5eed0001-…-0002`) sem tocar em
   `campos` (histórico legível). Não precisa desabilitar o trigger: `ativo` é
   livre por desenho (`0042:62-63`).
4. Re-emitir as RPCs tocadas, **verbatim + a linha alterada**:
   - `registrar_resposta_formulario` (`0115:653-659`): `l.f_sistema in
     ('avaliacao_360','avaliacao_final_mentor','avaliacao_final_mentorado')`.
   - `jovem_jornada` (`0099:369`): `f.sistema = 'avaliacao_final_mentorado'`
     (e o rótulo do payload `avaliacao_360` continua igual).
   - `painel_instrumentos_jornada` (`0125:875-903`): normalizar a chave, ex.
     `case when f.sistema like 'avaliacao_final_%' then 'avaliacao_360' else
     f.sistema end as sistema` no subselect e no `group by` — assim
     `src/lib/jornada.ts` não muda.
5. Aplicar no staging (`supabase db push --db-url …`) antes do push da branch.

### Passo 2 — tipos e vocabulário

- `src/lib/database.types.ts`: `formularios.sistema` é `string | null`
  (`database.types.ts:2298`), então o CHECK novo **não** exige regenerar; o
  `schema-contract` do CI compara colunas, não valores de CHECK.
- `src/lib/forms/schema.ts`:
  - union `FormularioSistema` (linha 83-92) + `SISTEMA_LABEL` (94-104):
    `avaliacao_final_mentor: "Avaliação final · mentor"`,
    `avaliacao_final_mentorado: "Avaliação final · mentorado"`.
  - `SISTEMAS_REGUA` (122-128): **tirar** `avaliacao_360` e **não** colocar os
    dois novos no lugar. A régua (`/materiais` → "Instrumentos do programa")
    é a leitura da jornada do jovem, e um par não cabe num card único. Os dois
    sistemas novos vão para `SISTEMAS_BORDO` (142-147), que é a seção read-only
    de `/formularios` (`formularios/page.tsx:37-38`: `sistema && !REGUA`). O
    `avaliacao_360` arquivado entra em `SISTEMAS_BORDO` também — hoje, estando
    na régua, ele **não aparece em nenhuma lista** de `/formularios` e ficaria
    acessível só por URL direta.
  - helper novo `ehAvaliacaoFinal(sistema)` (evita repetir a união em 6 pontos).

### Passo 3 — leituras

- `src/lib/queries-encerramento.ts:76-104` (`getAvaliacao360DaDupla`): buscar
  os ids dos dois/três sistemas e usar `.in("link.formulario_id", ids)`.
- `src/lib/jornada.ts:380-390`: trocar os ids do snippet (`o_que_leva`,
  `melhorar`) por `utilidade`/`o_que_mais_gostou`/`melhorias_programa` (o
  fallback "qualquer texto ≥12 chars" já cobre).

### Passo 4 — UI

- `src/components/enviar-formulario-dialog.tsx:98-113`: hoje o dialog escolhe
  **um** form e marca mentor+mentorado. Com dois forms, emitir vira dois
  passes. Melhoria barata (opcional, mesma issue): quando o form escolhido for
  do par, pré-marcar só o destino do lado dele (`dest_profile_id` para o do
  mentor, `dest_mentorado_id` para o do mentorado) — evita gerar link de
  mentorado com as perguntas do mentor.
- `src/app/(app)/formularios/formulario-links.tsx:610-615`: a nota "uma
  resposta 360º marca o checklist" passa a valer para os dois sistemas.
- `src/app/(app)/materiais/instrumentos-programa.tsx:122-128`: título
  "Avaliação 360º e autoavaliação" → "Avaliação final da mentoria";
  `sistemaForm` precisa apontar para **um** dos dois
  (`avaliacao_final_mentorado`) — o card resolve o form por um único id
  (`:319,364`), então o lado do mentor fica acessível pela seção "Instrumentos
  do sistema" de `/formularios`. O comentário de `SISTEMAS_REGUA` em
  `[id]/page.tsx:265` deixa de valer para o 360 arquivado (efeito colateral
  esperado).
- `src/components/encerramento-dupla.tsx:149-170`: `sugestao="360"` deixa de
  achar pelo selo (o selo agora é "Avaliação final"). Ajustar `sugestao` para
  "avaliação final" **ou** manter `normaliza()` casando "360" via título novo
  ("Avaliação final (360º)") — escolher um e ajustar o e2e.

### Passo 5 — demo e seeds

- `src/lib/demo/forms-data.ts:208-228` (definição), `531-552` (links),
  `708-740` (respostas), `985-1000` (`demoAvaliacao360DaDupla`), `1138-1160`
  (`demoJornada`): replicar o par e as respostas nos ids novos.
- `supabase/seed.sql:56` (encontro 16 lista "Autoavaliação do mentor", removida
  na 0128) e `:75` (material "Avaliação 360º"): ajustar os rótulos.
- `scripts/seed-demo-staging.mjs:407` (mesma lista obsoleta no `ciclo_eventos`
  do staging). Não semeia 360 — nenhuma mudança de link/resposta.

### Passo 6 — testes

- `tests/instrumentos.test.ts:47-58`: `ehInstrumento` tem lista explícita com
  `"avaliacao_360"`; incluir os dois novos.
- `src/lib/jornada.test.ts:496-510`: usa `o_que_leva` no snippet; trocar pelo
  id novo.
- `tests/encerramento.test.ts`: sem mudança de chave (só label/estado).
- e2e: `tests/e2e/demo/formularios.spec.ts:38` (título na régua),
  `tests/e2e/demo/jovem-jornada.spec.ts:388` ("Avaliação 360º e autoavaliação"),
  `:416` e `:487` (`hasText: "Avaliação 360º"` no card),
  `tests/e2e/app/formularios.spec.ts:83` (opção no dialog por nome),
  `tests/e2e/app/jovem.spec.ts:341`.

### Passo 7 — docs

- `docs/lgpd/inventario-dados.md:97` (inventário do 360) e
  `docs/lgpd/politica-retencao.md:23` (a chave `avaliacao_360` citada).
- `src/lib/como-conduzir.ts:215` e `:217`: ainda dizem "Avaliação 360º e da
  autoavaliação do mentor" (texto morto desde a 0128) — corrigir junto.

---

## 6. Riscos

| # | Risco | Efeito | Mitigação |
|---|---|---|---|
| R1 | **Perda da leitura quantitativa de fim de ciclo** (vínculo, evolução, efeito do PDM/Roda, regularidade) | o programa deixa de ter nota de fechamento; sobra `registros.avaliacao` (1–4 do mentor por encontro) e o PDM | aceitar conscientemente (é o formulário do Leo) ou manter 3 escalas como bloco extra no form do mentor (decisão §7, item 8) |
| R2 | **Sumiço da disponibilidade do mentor para o próximo ciclo** | a coordenação perde a base do rematch/renovação; a 0128 justifica a retirada da autoavaliação dizendo que o 360 "já pergunta a disponibilidade" — o form novo **não pergunta** | manter `disponivel_proximo_ciclo` + `capacidade_proximo_ciclo` no form do mentor (2 campos) ou criar pergunta no intake |
| R3 | IDs espelhados entre os dois forms (`estrutura_programa`, `dificuldade_agenda`, `melhorar_processo`, `depoimento`) | se alguém depois juntar os dois forms num só, os ids colidem | convenção documentada no §3.2; `validaCampos` dedupa id por form apenas |
| R4 | e2e casa por texto "Avaliação 360º" e por selo "360" | 4 arquivos de spec quebram no mesmo commit | tratar como um único passo (passo 4) e rodar `pnpm test:e2e` local antes do push |
| R5 | 23 perguntas no lado do mentorado (25 com identificação e consentimento no Google) | queda de conclusão num público de 16–24 anos, no fim do ciclo | `secao` de 3 blocos + progresso (já existe no `/f/[token]`); medir conclusão no primeiro ciclo |
| R6 | Consentimento de depoimento virou pergunta do instrumento | dado de imagem/divulgação sem finalidade declarada | registrar em `docs/lgpd/inventario-dados.md` e não usar em comunicação sem cruzar com a assinatura do termo |
| R7 | Painel/jornada com chave `avaliacao_360` normalizada em SQL | se a normalização for esquecida em uma das duas queries, o card do 360 "não abre" e o e2e pega | normalizar nos dois lugares (§5 passo 1.4) e cobrir com um teste de `jornada.ts` que lê `entregas.avaliacao_360` |

---

## 7. Perguntas abertas

**Para o Leo**

1. **Q1 do mentorado**: quais são os rótulos de 1, 2 e 3? (só `4- Satisfeito` e
   `5- Muito satisfeito` apareceram). O app mostra 1–5 numéricos — rótulo por
   nota não existe no motor hoje (`escala_1_5`), então a saída é `descricao`
   com as âncoras ou aceitar números crus.
2. **Opções completas** dos `multi_select` (mentorado Q2, Q4, Q5, Q13) — o xlsx
   só revela as que alguém marcou.
3. **Mentor Q1 e Q8** são resposta curta mesmo? ("Boa/Bom/Excelente/Ótimo/
   Regular" parece lista, mas a flexão de gênero indica texto.)
4. **Q12 e Q14 são a mesma pergunta** (texto idêntico). Fica uma só? E a Q13
   ("se sim, quais mudanças") é continuação da **Q11** (mudanças realizadas) ou
   da Q12? Hoje o encadeamento natural é Q11 → Q13.
5. **Mentor Q3** pergunta sobre dificuldade material do mentorado — é para o
   mentor responder *sobre* o jovem (relato de terceiro) ou era pergunta do
   formulário do mentorado?
6. **Consentimento**: as três opções são "Sim, com o meu nome" / "Sim, de forma
   anônima" / "Não"? (o xlsx traz "porém" numa resposta e "mas" em outra).

**Para o Thiago**

7. **Continuidade do mentor**: mantemos `disponivel_proximo_ciclo` e
   `capacidade_proximo_ciclo` como bloco extra no form do mentor (2 campos,
   fora do xlsx) ou a coordenação passa a coletar isso no intake/ficha?
   *Recomendação: manter no form — são 2 perguntas e o dado não existe em
   outro lugar.*
8. **Nota de fim de ciclo**: aceitamos perder `vinculo`/`evolucao_jovem`/
   `pdm_roda`? Se não, mesmo tratamento do item 7 (bloco extra de 3 escalas no
   lado do mentor), marcado como "pergunta da plataforma".
9. **Checklist**: `avaliacao_360_enviada` passa a exigir **as duas** respostas
   (§4.3 opção 3) ou segue marcando com qualquer uma?
10. **Nome do instrumento na interface**: "Avaliação final da mentoria" (como
    o Leo chama) ou segue "360º" (como o app chama hoje, inclusive nos e2e)?
    Recomendação: título "Avaliação final da mentoria (360º)" e selo
    "Avaliação final · mentor" / "· mentorado". O título com "(360º)" mantém
    a busca do dialog funcionando; o selo diz o lado, que é o que a coordenação
    precisa ver na lista.
11. **Reativar em prod**: o form está `ativo=false` hoje. A entrega inclui
    reativar o par novo e desativar de vez o antigo (que já está inativo)?
12. **Numeração da migration**: 0129 está livre? (a última do repo é a 0128).

---

## 8. Registro de implementação (27/out/2026)

O Thiago mandou os três formulários ao vivo, o que resolveu boa parte das
perguntas abertas: o **form do mentorado** é público
(`docs.google.com/forms/d/1dPR32zgQNS4rKGizNmcY-UAj9VTVKqNaSLIGSH3lzLg`) e o
`FB_PUBLIC_LOAD_DATA_` trouxe as listas completas de opções; os outros dois
(mentor e um terceiro restrito) respondem 401 e seguem sem leitura — o lado do
mentor foi montado pelo xlsx.

### O que foi decidido

| # | Pergunta | Decisão |
| --- | --- | --- |
| 7 | Continuidade do mentor | entrou `continua_proximo_ciclo` (sim/não) no form do mentor. Capacidade ficou de fora: não estava em nenhum dos modelos e a coordenação combina caso a caso |
| 8 | Nota de fim de ciclo | aceita a perda: o 360 nunca teve resposta em prod. O lado do mentorado mantém uma escala (`expectativa_atendida`) e dois sinais objetivos (`recomendaria_mentor`, `mais_preparado`) |
| 9 | Checklist | segue marcando com **qualquer uma** das duas respostas (§4.3 opção 2). Exigir as duas é regra nova de SQL e fica para o ciclo em que as duas vias estiverem em uso |
| 10 | Nome na interface | "Avaliação final da mentoria · mentor / · mentorado" nos títulos; a estação virou "Avaliação final" e a cópia que dizia 360º foi varrida (guia do mentor, cronograma, checklist) |
| 11 | Reativar em prod | o par novo nasceu ativo; o `avaliacao_360` fica **arquivado** com a definição intacta (0 respostas — não há dado a reinterpretar) |
| 12 | Numeração | 0129 foi a do intake de mentorados (REALIZA-229); esta entrega usou **0130** (vocabulário + dois formulários + as três funções) e **0131** (chave do painel) |

### Desenho entregue

- **Dois sistemas novos**: `avaliacao_final_mentor` (21 campos) e
  `avaliacao_final_mentorado` (20 campos, com `secao` por bloco e
  `visible_if` em "se sim, quais mudanças").
- **`avaliacao_360` arquivado**: `ativo=false`, definição intacta. A estação do
  encontro 16 (slot `avaliacao_360` da jornada/painel) passa a ler a entrega do
  mentorado no sistema novo — a **chave do payload continua `avaliacao_360`**
  (`jovem_jornada` e o painel normalizam em SQL, 0131), então nenhum consumidor
  de TS mudou de contrato.
- **Checklist de encerramento**: `submeter_resposta_formulario` carimba
  `avaliacao_360_enviada` quando a resposta vem de qualquer um dos dois.
- **As 3 funções foram re-emitidas a partir da definição viva do banco** (não
  redigitadas), com diff de uma linha cada.

### O que continua aberto (depende do Leo)

- Perguntas 1 a 6 do §7: âncoras da escala, se Q1/Q8 do mentor são lista ou
  texto livre, a duplicata Q12/Q14 e a redação final do consentimento. O lado do
  mentor usa `select` de 5 opções onde o modelo sugere lista; trocar é edit de
  seed, não migration de estrutura.
- O **terceiro link** do Google Forms segue restrito (401) — não deu para
  comparar com o que foi entregue.
