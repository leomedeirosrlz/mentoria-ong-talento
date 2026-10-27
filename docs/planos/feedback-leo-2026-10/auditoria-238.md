# REALIZA-238 · Auditoria dos guias (DPP + Especialista) contra o catálogo do app

> **Insumos:** `Guia do Mentor de Desenvolvimento Pessoal e Profissional` (63 páginas de PDF)
> e `Guia do Mentor Especialista` (48 páginas), lidos na íntegra com `pdftotext -layout`.
> **Alvo:** catálogo real de produção (`yhjzmxleotahijinjepl`) e o código em
> `/home/thiago/nb/realiza.vc`, conferidos em **27/out/2026**.
> **Convenção de página:** cito sempre a **página do PDF**. A página impressa no rodapé é
> PDF − 1 (ex.: PDF 28 = "27" no rodapé).
> **Natureza deste documento:** auditoria de conteúdo. Nenhum código, migration ou seed foi
> alterado. As propostas estão em §6.

---

## 1. Resumo executivo

1. O catálogo do app cobre bem a **espinha da metodologia**: Visão, Metas, PDM, Roda da Vida,
   avaliação rápida da sessão, registro do encontro e rito de encerramento existem e são fiéis ao
   texto do guia. O que falta é quase todo **conteúdo de apoio**, não instrumento novo.
2. O problema mais grave não é de aderência, é de **uso**: em produção há **117 links emitidos**
   (Visão 30, Roda 30, PDM 29, Metas 28, 97 deles num único dia) e **zero respostas**. O único
   instrumento com adoção real é o `registros` (46 registros para 32 duplas). A camada de
   instrumentos nunca foi validada por uma dupla de verdade.
3. Dois instrumentos que o guia manda existir estão **apagados desde a 0128**: a Anamnese Social
   (DPP PDF 9 e 14) e a Autoavaliação do mentor (DPP PDF 59). A Anamnese ganhou um substituto
   parcial na manhã de hoje com o `intake_mentorado` (0129); a Autoavaliação não tem substituto, e
   a 360 cobre só a disponibilidade para o próximo ciclo, nenhuma das 5 perguntas de reflexão nem o
   checklist de competências.
4. A **Avaliação 360º está `ativo=false`**, e a RPC de emissão recusa instrumento encerrado
   (`0099_jornada_autoemit.sql:75`). Ou seja: a estação do encontro 16 e o item de checklist
   "Avaliação 360º enviada" são inemitíveis hoje, sem nenhum sinal visível na interface.
5. A remoção da 0128 ficou **pela metade**: o formulário saiu, mas as colunas
   `encerramentos.autoavaliacao_mentor` / `disponivel_proximo_ciclo` e a RPC
   `salvar_autoavaliacao` continuam no banco, e o encontro 16 dos **dois** cronogramas ainda
   lista "Autoavaliação do mentor" como instrumento.
6. O guia do Especialista tem **um único ponto de contato com o PDM**: o especialista propõe metas
   e "registra tudo no PDM" (PDF 34). No app o PDM nativo é DPP-only por decisão de RLS
   (`0109_pdm_nativo.sql:221`), então esse caminho simplesmente não existe.
7. Cinco **ferramentas de condução** que o cronograma cita como instrumento (Perguntas Eficazes,
   Escuta Ativa, Feedback Construtivo, Modelo SMART, Papel de modelo) não existem como material na
   biblioteca. "Perguntas Eficazes" está no `seed.sql:65` e não chegou em produção.
8. Veredito geral: dos 22 itens auditados, **14 ficam como estão, 6 pedem ajuste, 1 só existe se o
   Leo quiser (Autoavaliação do mentor) e 1 vira decisão de processo (Anamnese Social)**. Nenhum
   instrumento do catálogo precisa ser desligado por desalinhamento com o guia; o único item a
   remover é uma linha de material no seed, não um instrumento. O que precisa é de conteúdo,
   correção de rastro e uma decisão de produto sobre o PDM do especialista.

---

## 2. Tabela de decisão

`origem` = onde o guia manda. `esforço`: **P** ≤ meio dia · **M** 1 a 2 dias · **G** semana ou
mais (migration, RLS, fluxo novo).

| item | origem | onde está no app | veredito | justificativa | esforço |
|---|---|---|---|---|---|
| Construindo a Visão | DPP §07 + template §14 (PDF 57); encontros 1 e 2 (PDF 36–37) | form `visao` (8 campos, ativo); material "Instrumento: Construindo a sua Visão" com arquivo; estação `visao` (enc. 1–4) | manter | Os 5 prompts e a Declaração do PDF 57 batem 1:1 com o form. A janela 1–4 é mais larga que o guia (tarefa no enc. 1, discussão no 2) e absorve atraso sem virar pendência falsa. | P |
| Definindo Minhas Metas | DPP enc. 3 (PDF 37) + template oficial do mentorado (`docs/fontes/definindo-minhas-metas.txt`) | form `metas` v3 (22 campos, 5 metas com "por quê" e submetas) + material ordem 17 | ajustar | O template pede **3 a 5** metas (4 e 5 opcionais), três **checagens de revisão** ("ajudam a chegar onde quero / são importantes / consigo explicar") e uma pergunta final "qual é a mais importante". O app fixa 5 slots iguais e resolve a pergunta de prioridade por posição, rotulando `meta_1` como "a mais importante". | M |
| PDM (formulário) | DPP §07 (PDF 24–28) + template §14 (PDF 57–58) | form `pdm` (15 campos: visão, 3 metas com IS e prazo, desdobramento em texto livre por meta) | ajustar | O template usa exatamente 3 metas com IS e prazo (aderente), mas o mapa de submetas é **por nível (A, B, C…), com IS e prazo em todos os níveis** (PDF 58). O form guarda um `texto_longo` por meta, então o desdobramento não vira progresso nem alimenta o PDM nativo com a mesma fidelidade. | M |
| PDM nativo (`pdm` + `pdm_itens`) | DPP PDF 15 e 57: "o PDM fica com a dupla, **fora da plataforma**" | `pdm`/`pdm_itens` (0109), aba PDM da ficha, RPCs `pdm_da_dupla` / `pdm_salvar` | manter | Divergência deliberada: o app trouxe o PDM para dentro e ganhou revisão de meio de percurso, progresso de submeta e relatório final. É a única forma de o guia (PDF 52, "o PDM que não muda em seis meses não está sendo usado") virar dado. Documentar a divergência no onboarding do mentor, não "consertar". | G |
| Roda da Vida | DPP §07 (PDF 28–30) + roteiro §14 (PDF 59); três momentos a partir do 5º mês | form `roda_vida` (22 campos, 16 áreas e escala 1–10 verbatim) + estações `roda_inicial` (enc. 1) e `roda_formal` (enc. 12–14) | manter | Conteúdo idêntico ao guia, inclusive os 4 quadrantes e a reflexão final. Falta só a meta SMART por área (PDF 28), que não é campo do instrumento e sim consequência dele (lacuna F4 em §3.1). | P |
| Avaliação rápida da sessão | DPP §12 (PDF 48), Esp §12 (PDF 41), plataforma (PDF 15) | `avaliacoes_encontro` (estrelas, comentário, sentimento, avanço, pedido de apoio) + estação recorrente 1–16 | manter | É o instrumento que o guia mais enfatiza ("poucos cliques, logo depois da conversa") e o único que os dois lados preenchem. Desenho aderente; o problema é adoção (0 usos), não forma. | P |
| Avaliação 360º (instrumento) | DPP §12 (PDF 48) + PDF 60 (disponibilidade e capacidade para o próximo ciclo); Esp §12 (PDF 41) | form `avaliacao_360` (10 campos), estação `avaliacao_360` (enc. 16), item 4 do checklist de encerramento | ajustar | **Bloqueio real:** `ativo=false`, e `emitir_link_instrumento` levanta "este instrumento está encerrado" (`0099:75`). O conteúdo dos 10 campos será substituído pelo par mentor/mentorado da REALIZA-230, que tem 11 e 23 perguntas. Enquanto isso, a estação e o checklist ficam sem saída. | P |
| Avaliação por terceiros | DPP PDF 36 (preparação) + templates PDF 56 | `terceiros_contatos` + painel na ficha da dupla (até 9 pessoas: 3 amigos, 3 familiares, 3 colegas), convite por WhatsApp | manter | Fluxo e limites fiéis ao guia, inclusive o anonimato ("sempre preservando o anonimato", PDF 37). A "Consolidação da avaliação por terceiros" (template PDF 56) não existe como instrumento: hoje a leitura é manual na ficha. Aceitável, vale registrar como lacuna (§3.2). | P |
| Avaliação geral da trilha de especialista | **não está no guia**: Esp PDF 41 fecha a trilha com o mesmo 360º, emitido pela coordenação | form `avaliacao_especialista` (9 campos), emitido dentro de `encerrar_trilha_especialista` | ajustar | Manter como leitura extra de coordenação (tem valor e já está em produção), mas a justificativa no código está errada: `0104:1,45,116` cita "guia-esp §13", e o §13 do guia do especialista é "Conteúdo complementar" (PDF 43). A avaliação é §12, PDF 41. Corrigir a citação e decidir o destino no pacote da 230. | P |
| Autoavaliação do mentor | DPP template §14 (PDF 59): 5 perguntas abertas + refazer o Checklist de 10 competências | **apagada** pela 0128; sobraram colunas `encerramentos.autoavaliacao_mentor` / `disponivel_proximo_ciclo` e a RPC `salvar_autoavaliacao`; enc. 16 ainda lista o item | criar (ou terminar de remover) | O guia manda, e a 360 cobre só a parte de disponibilidade e capacidade (PDF 60): nenhuma das 5 perguntas de reflexão, nem o checklist. Hoje o estado é meio-apagado: catálogo sem o form, banco com as colunas, cronograma e `como-conduzir.ts` citando o instrumento, rito sem onde registrar. Decisão do Leo em §5.2. | M |
| Checklist do encerramento | DPP PDF 35–42 (rito) + 59 | `CHECKLIST_ENCERRAMENTO`, 4 itens (`src/lib/encerramento.ts:30–43`) | manter | Os 4 itens mapeiam o rito do guia. O item "Avaliação 360º enviada ao mentor e ao mentorado" herda o bloqueio da linha acima. | P |
| Relatório final da jornada | DPP PDF 2: "os registros serão a base do relatório final que você entregará ao mentorado e à coordenação" | `encerramentos.resumo_jornada` + `textoResumoJornada` + `relatorio_links` | manter | É o único ponto em que o guia promete uma entrega formal ao jovem, e o app a produz das mesmas fontes que o mentor já preenche. 0 encerramentos em prod, então ainda não exercitado. | M |
| `desfecho` ("Depois da mentoria") | fora do guia | form `desfecho` (3 campos, 0124) | manter | Excesso com razão de negócio (empregabilidade pós-programa). Não conflita: ocorre depois do escopo dos dois guias. | P |
| Inscrição de mentores (`intake_mentor`) | DPP PDF 13 (passos 1 a 6) + PDF 31 (matching) | form de 34 campos: grade de disponibilidade, currículo e foto, `pref_genero_mentorado` | manter | Cobre os seis passos da jornada do mentor e o formulário de matching descrito no PDF 31. A pendência C1 (campo de gênero em papéis que não pareiam) é de cadastro, não deste instrumento. | P |
| Inscrição de mentorados (`intake_mentorado`) | DPP PDF 14 (passos 1 a 4) + PDF 31 | criado em 27/out pela 0129: 20 campos, ativo, 0 respostas | manter | Fecha a lacuna que esta auditoria ia apontar (jornada do jovem, passos 1 a 3, e o matching do PDF 31). Falta um campo que o PDF 31 cita explicitamente: formação acadêmica ou curso atual. | P |
| Anamnese Social | DPP PDF 9 ("levanta o perfil dos jovens… qualifica o matching e orienta o trabalho dos mentores") + PDF 14, passo 4 | **apagada** pela 0128; nada ocupa o lugar | escalar | O `intake_mentorado` cobre hobbies, objetivos e preferência de gênero, mas não o que a anamnese existe para captar: vulnerabilidade, território, composição familiar, renda (contexto do PDF 10). São instrumentos diferentes com propósitos sobrepostos. Ver §5.1. | M |
| Calendário do ciclo (`ciclo_eventos`) | DPP PDF 32–33 (mês × fase) e 35–42 (roteiro) | 16 encontros por cronograma, 2 cronogramas ativos | ajustar | Títulos 3 a 7 são paráfrases do guia ("Declaração de Visão e metas SMART" no lugar de "Metas e checagem SMART"; "Fechamento da construção do PDM" no lugar de "Submetas e compromisso"), e o enc. 16 ainda lista `Autoavaliação do mentor`. A coluna `instrumentos` cita 5 ferramentas que não existem como material. | P |
| Registro do encontro (`registros`) | DPP PDF 52 (5 campos) e Esp PDF 45 | `registros`: tema, ferramenta, atividades, avaliação, dificuldade, reflexões, próximo passo, observações, pedido de apoio | manter | Cobre os 5 campos do guia e mais alguns úteis ao semáforo. É o instrumento com adoção real (46 registros) e a matéria-prima do relatório final. Não mexer. | P |
| Supervisão | DPP PDF 48 (Supervisores de Relacionamento), Esp PDF 42 (grupos de troca) | `supervisoes` (0041) + notificação + painel de coordenação | manter | Previsto no guia, ainda que fora do capítulo de instrumentos. 0 usos em produção: é adoção, não desenho. | P |
| Presenças de formação | DPP PDF 13, passos 3 e 4 | `presencas` (0040) + chamada na agenda | manter | Operação do programa, citada no guia. Fora do escopo de instrumento de mentoria. | P |
| Materiais (biblioteca, 22 linhas) | DPP §14 (PDF 54–59), §07 (21–30), §11 (44–46); Esp §13 (43–44) | `materiais` + `/materiais` (abas jornada / instrumentos / biblioteca) | ajustar | Faltam 4 grupos de conteúdo e 7 templates não têm arquivo (caem em "em breve"). Detalhe em §3.2. | M |
| Turmas, cronogramas, chamados, comunicados, assinaturas | fora do guia | várias tabelas e telas | manter | Operação do Instituto, não instrumento de mentoria. Nenhum conflito com os guias. | n/a |

---

## 3. Lacunas (o guia manda, o app não tem)

### 3.1 Forms engine

| # | Lacuna | Evidência no guia | Onde falta |
|---|---|---|---|
| F1 | **Avaliação final desenhada para um respondente só.** O guia pede um 360º com mentor e mentorado respondendo, e o app tem um form com perguntas condicionais por papel ("Se você é o(a) mentor(a)…"). | DPP PDF 48; Esp PDF 41 | `formularios` `avaliacao_360` (10 campos, inativo). O par mentor/mentorado está especificado na `avaliacao-final-230.md` (11 e 23 perguntas) e não foi implementado. |
| F2 | **Checagens de revisão de metas.** O template oficial fecha com três perguntas de auto-revisão e uma de prioridade. O form só tem a prioridade implícita em `meta_1`. | template do mentorado (`docs/fontes/definindo-minhas-metas.txt`) | form `metas` v3, 22 campos. |
| F3 | **Níveis de submeta com IS e prazo.** O guia pede desdobramento A, B, C "até chegar a algo realizável de imediato", com indicador e prazo em todos. | DPP PDF 28 e 37, template PDF 58 | form `pdm` (um texto livre por meta). O nativo `pdm_itens` já suporta árvore (`parent_id`) e indicador por item (`0109`), mas o único jeito de alimentá-lo com submeta é uma linha de texto (0118). |
| F4 | **Meta SMART por área da Roda.** Depois da aplicação, o guia manda definir pelo menos uma meta SMART para cada uma das 16 áreas. O form coleta notas e uma reflexão, e nada mais. | DPP PDF 28 e 36, roteiro PDF 59 | form `roda_vida` (22 campos). `pdm_itens.area_vida` existe e nunca é populado. |
| F5 | **Anamnese Social.** Apagada em 0128 sem substituto equivalente. | DPP PDF 9 e 14 | nada. Ver §5.1. |
| F6 | **Autoavaliação do mentor.** 5 perguntas abertas + refazer o checklist de competências. | DPP template PDF 59 | nada (apagada em 0128). Ver §5.2. |
| F7 | **Formação acadêmica no intake de mentorados.** O guia cita "formação acadêmica ou curso atual" como dado do matching. | DPP PDF 31 | form `intake_mentorado` (0129), que tem hobbies, esportes, auto-descrição e objetivos, mas não formação. |

### 3.2 Material

O §07 lista **quatro** instrumentos (Perguntas Eficazes, Feedback Construtivo, PDM, Roda da Vida) e
o §11 lista **quatro** ferramentas de comunicação (Escuta Ativa, Comunicação Não Violenta, perguntas
quebra-gelo, check-in e checkout). A biblioteca tem arquivo para **um** dos oito (o roteiro de
aplicação da Roda); os outros existem, no máximo, como linha sem arquivo.

| # | Lacuna | Origem | Estado |
|---|---|---|---|
| M1 | **Perguntas Eficazes** | DPP §07, PDF 21 | Existe em `supabase/seed.sql:65` (ordem 9) e **não existe em produção**. É o terceiro termo mais citado no guia (9 ocorrências, atrás só de PDM e Roda da Vida), aparece em dois encontros do cronograma (1 e 4) e é o instrumento de condução que o §07 coloca em primeiro lugar. |
| M2 | **Feedback Construtivo** | DPP §07, PDF 22–24 | Não existe como material. Citado nos encontros 5, 6 e 7 do cronograma. |
| M3 | **Ferramentas de comunicação** (Escuta Ativa, Comunicação Não Violenta, perguntas quebra-gelo, check-in e checkout) | DPP §11, PDF 44–46; carta ao mentor PDF 2 | Não existe. "Escuta Ativa" é citada como instrumento nos encontros 1, 8, 9, 10 e 11. |
| M4 | **Modelo SMART** | DPP PDF 28 | Não existe como material; é citado como instrumento nos encontros 3, 12, 13 e 14. |
| M5 | **Roteiros Semana 7 a 16** | I2 do plano; roteiro dos encontros 5 a 16 no guia (PDF 38–43) | Produção tem 1 a 6 ("Roteiro Semana 1" a "6", com arquivo). Faltam 7 a 16, dependentes dos PDFs do Leo. |
| M6 | **Consolidação da avaliação por terceiros** | template PDF 56 | Sem instrumento; a coordenação lê contato por contato na ficha. |
| M7 | **Sete templates sem arquivo** | templates PDF 54–59 | Linhas existem, `path` e `url` nulos: Mensagem de preparação, Mensagem às pessoas indicadas, Consolidação da avaliação por terceiros, PDM, Mensagem de encaminhamento, Checklist de competências do mentor, Autoavaliação do mentor. Renderizam "em breve". Viram seis se a autoavaliação sair (§5.2). |
| M8 | **Conteúdo complementar do especialista** (vagas, entrevistas, currículo, educação financeira) | Esp §13, PDF 43–44; DPP PDF 50–51 | Opcional: o guia trata como leitura sugerida, não como material obrigatório do programa. |

### 3.3 Instrumento de sistema e fluxo

| # | Lacuna | Evidência | Onde |
|---|---|---|---|
| S1 | **Janela da Roda inicial começa tarde.** O guia pede a Roda preenchida **antes** do primeiro encontro ("peça… a Roda da Vida preenchida", PDF 36) e só discute no enc. 1. No app a estação abre no enc. 1. | DPP PDF 36 | `src/lib/jornada.ts:198` (`roda_inicial`, `encIni: 1`). |
| S2 | **Especialista não consegue registrar meta no PDM.** O guia manda propor metas e "registrar tudo no PDM", trabalhando junto com o mentor DPP. | Esp PDF 34 | `pdm_pode_editar` recusa `trilha='especialista'` (`0109_pdm_nativo.sql:221`); `pdm_itens.origem` não tem valor para especialista (`0109:62`). Ver §5.5. |
| S3 | **A estação do encontro 16 não emite.** Com a 360 inativa, a estação existe, aparece na jornada e falha na emissão. | `0099:75` + `ativo=false` | `formularios.avaliacao_360`, estação `avaliacao_360`, item 4 do checklist. |
| S4 | **Rastro da autoavaliação espalhado por cinco lugares.** Catálogo sem o form, banco com as colunas e a RPC, cronograma e copy citando o instrumento. | 0128 (só a fatia "catálogo" entrou) | `supabase/seed.sql:56`; `ciclo_eventos` enc. 16 dos dois cronogramas; `src/lib/como-conduzir.ts` (enc. 16, campo `cobre`); `encerramentos.autoavaliacao_mentor` / `disponivel_proximo_ciclo`; `public.salvar_autoavaliacao`. |
| S5 | **Card da régua promete um instrumento que não existe.** O oitavo card se chama "Avaliação 360º e autoavaliação". | n/a | `src/app/(app)/materiais/instrumentos-programa.tsx:123`. |
| S6 | **Títulos 3 a 7 do cronograma divergem do guia.** Isso importa porque o mentor lê o cronograma na plataforma e o guia à mão, e os dois não batem. | DPP PDF 37–38 | `ciclo_eventos` nos dois cronogramas + `supabase/seed.sql:43`. |
| S7 | **Comentário de código desatualizado sobre o CHECK.** Diz que "o vocabulário segue com elas porque enum de texto não se encolhe sem recriar a constraint"; a 0128 recriou a constraint e o comentário ficou falso. | 0128 | `src/lib/forms/schema.ts:140`. |

---

## 4. Excesso (o app tem e o guia não pede)

A plataforma é **operacional**, não um espelho do guia. Só entram aqui itens que competem com o
guia, duplicam instrumento ou criam expectativa errada. Tabelas de operação (turmas, cronogramas,
chamados, comunicados, assinaturas, presenças, supervisões) ficam fora deste juízo.

| # | Item | Por que é excesso | Veredito |
|---|---|---|---|
| E1 | **PDM nativo dentro da plataforma** | O guia afirma duas vezes que o PDM "fica com a dupla, fora da plataforma" (PDF 15 e 57). | Manter. É a divergência mais produtiva do app: transforma o documento em dado revisável. Mas precisa ser **dita** ao mentor, senão ele mantém duas cópias. |
| E2 | **`avaliacao_especialista` como form separado** | O guia fecha a trilha de especialista com o **mesmo** 360º da coordenação (Esp PDF 41). O app criou um form próprio só para isso. | Manter por ora (valor de coordenação), corrigir a citação e reavaliar no pacote da 230 (§5.6). |
| E3 | **`desfecho` ("Depois da mentoria")** | Não existe nos guias. | Manter: é pós-programa e responde a uma pergunta de negócio (empregabilidade), não à metodologia. |
| E4 | **Ferramentas de condução promovidas a "instrumento" sem material** | O §07 do guia lista **quatro** instrumentos. O cronograma coloca Escuta Ativa, Papel de modelo e Modelo SMART na mesma coluna, e nenhum dos três tem material; Perguntas Eficazes e Feedback Construtivo, que são instrumento de verdade, também não têm. | Ajustar: ou viram material (M1 a M4), ou saem da coluna `instrumentos` e passam a competência. |
| E5 | **Material "Avaliação 360º" (ordem 19) no seed** | Duplica o instrumento: o 360 é form, não material de leitura. Não está em produção, só no seed. | Remover de `supabase/seed.sql:75`. |
| E6 | **Dataset demo com 13 materiais** | Produção tem 22; a demo ficou na foto do seed antigo, sem roteiros, cronogramas nem "Definindo Metas". Quem testa a demo vê uma biblioteca que não existe. | Ajustar (`src/lib/demo/data.ts:3121`). |
| E7 | **Duas linhas com `ordem = 17` em produção** | "Instrumento: Definindo Metas" e "Checklist de competências do mentor" empatam, e a ordenação da biblioteca fica indefinida. | Ajustar (dado, não código). |

---

## 5. Ambiguidades a escalar com o Leo

Nenhuma delas se resolve lendo o guia: o guia manda uma coisa e a operação (ou a decisão da 0128)
manda outra. Cada uma bloqueia trabalho de §6.

**5.1 A Anamnese Social foi substituída pelo intake?**
O guia a descreve como instrumento aplicado pela coordenação **antes da mentoria**, cujo fim é
"compreender a realidade de cada jovem, qualificar o matching e orientar o trabalho dos mentores"
(PDF 9) e que aparece como passo 4 da jornada do jovem (PDF 14). O `intake_mentorado` cobre
matching (hobbies, objetivos, preferência de gênero), mas não cobre vulnerabilidade, território,
composição familiar ou renda. **Pergunta:** a coordenação ainda aplica anamnese por fora, ou o
intake passou a ser o único canal? Se ainda aplica, ela precisa de um lugar na plataforma
(coord-only) ou continua em planilha?

**5.2 A Autoavaliação do mentor volta ou sai de vez?**
A 0128 removeu o form, mas as colunas, a RPC, o cronograma e a copy continuam. A 360 cobre
disponibilidade e capacidade para o próximo ciclo (PDF 60), não as 5 perguntas de reflexão nem o
checklist de 10 competências (PDF 59). **Pergunta:** recriamos como instrumento de encerramento
(5 abertas + checklist) ou assumimos que a reflexão do mentor não é coletada e limpamos o rastro
inteiro?

**5.3 O PDM mora dentro ou fora da plataforma?**
O guia é explícito (PDF 15 e 57). O app construiu PDM nativo com revisão, progresso e relatório.
**Pergunta:** o mentor é instruído a manter o PDM **só** na plataforma (e o guia é que está
desatualizado), ou a plataforma é cópia de trabalho e o documento oficial segue com a dupla?
Isso muda o onboarding, o material de apoio e o que o relatório final pode prometer.

**5.4 A Roda da Vida exige 16 metas SMART?**
O guia pede "pelo menos uma meta SMART para cada uma das 16 áreas" (PDF 28), o que na prática é
um segundo ciclo de planejamento em 3 encontros. O app coleta notas + reflexão e deixa as metas
na conversa. **Pergunta:** instrumento (16 campos de meta) ou roteiro de conversa? Se for
instrumento, ele é o maior formulário do programa e provavelmente ninguém preenche.

**5.5 O especialista escreve no PDM do DPP?**
Esp PDF 34 diz que o especialista "pode propor novas metas, que serão trabalhadas em conjunto com
o Mentor DPP", e manda "registrar tudo no PDM". O app bloqueia por RLS. **Pergunta:** abrimos
escrita escopada (só metas, com autor e origem `especialista`), ou o especialista registra no
`registros` da trilha e o DPP transporta para o PDM?

**5.6 O fechamento do especialista é o 360 ou um form próprio?**
O guia chama de 360º (Esp PDF 41); o app criou `avaliacao_especialista` e justificou citando um
§13 que não trata disso. **Pergunta:** o especialista responde o mesmo 360 (com o par
mentor/mentorado da 230) ou mantém um form próprio, agora com justificativa correta?

**5.7 (nota, não bloqueia) O guia se contradiz no mês da Roda.**
O §07 diz "início do sexto mês" (PDF 28); o roteiro diz "5º mês" (PDF 39) e o template repete
"5º mês" (PDF 59). O app escolheu encontros 12 a 14, que é exatamente onde o roteiro coloca o
5º mês, então ele segue o roteiro e não o §07. Nenhuma ação; só não usar essa divergência como
argumento de desalinhamento.

---

## 6. Próximos passos priorizados

### P0 · Desbloquear o que já está quebrado (não depende do Leo)

1. **Decidir e executar o destino da 360.** Se o par da 230 não entra agora, reativar
   `avaliacao_360` (`ativo=true`) para a estação do enc. 16 voltar a emitir. Sem isso, o item 4 do
   checklist de encerramento é inalcançável. Arquivos: `formularios` (prod), `0099:75`,
   `src/app/(app)/materiais/instrumentos-programa.tsx` (card 360), `src/lib/encerramento.ts:42`.
2. **Terminar a remoção da autoavaliação ou revertê-la por inteiro.** A direção depende de §5.2, mas
   a inconsistência atual não pode ficar: a limpeza é a mesma nos dois cenários. `supabase/seed.sql:56`;
   `ciclo_eventos` enc. 16 dos dois cronogramas (prod); `src/lib/como-conduzir.ts` (enc. 16, `cobre`).
3. **Corrigir a citação do form do especialista:** `0104_avaliacao_especialista.sql:1,45,116`
   (§13 → §12, PDF 41) e a `descricao` já publicada em produção.
4. **Alinhar os títulos 3 a 7 do cronograma ao guia** (`ciclo_eventos` × 2 + `seed.sql:43`):
   "Metas e checagem SMART", "Submetas e compromisso", "Primeiros resultados", "Superando
   barreiras", "Ajustes no plano".
5. **Renomear o card** para "Avaliação 360º" (`instrumentos-programa.tsx:123`).
6. **Abrir a Roda inicial antes do enc. 1** (`src/lib/jornada.ts:198`).
7. **Dado em produção:** resolver o empate de `ordem = 17` na biblioteca.
8. **Antes de qualquer coisa nova: rodar um ciclo real.** 117 links, 0 respostas. Escolher 1 ou 2
   duplas, sentar com o mentor, ver onde o link trava (e-mail, login, celular, tamanho do
   formulário). Nenhum ajuste de conteúdo desta auditoria se paga antes disso.

### P1 · Conteúdo que já está especificado (esforço médio, impacto visível)

9. **Biblioteca:** subir `Perguntas Eficazes` (PDF 21), `Feedback Construtivo` (22–24),
   `Ferramentas de comunicação` (44–46) e `Modelo SMART` (28). Resolve M1 a M4 e limpa o E4.
10. **Subir os 7 templates sem arquivo** (PDF 55–59), com prioridade para o Checklist de competências
    (citado na preparação e no enc. 1) e a Mensagem de encaminhamento (enc. 4 e 7).
11. **Roteiros Semana 7 a 16** (depende dos PDFs do Leo, I2).
12. **Form `metas`:** acrescentar as 3 checagens de revisão e o campo "qual é a mais importante"
    (em vez de fixar por posição). Arquivo: `formularios.campos` do oficial `metas` (nova
    migration, precedente 0118).
13. **Form `pdm`:** trocar o `texto_longo` de submetas por slots por nível, com IS e prazo,
    reaproveitando o contrato `sub_N_i` que o nativo já consome (0118/0109).
14. **`intake_mentorado`:** incluir formação acadêmica / curso atual (PDF 31).
15. **Dataset demo:** atualizar de 13 para 22 materiais (`src/lib/demo/data.ts:3121`).

### P2 · Depende de decisão de produto (§5)

16. **Pacote da avaliação final (D5 + 230):** par mentor/mentorado, e o destino de
    `avaliacao_especialista` e de `avaliacao_360` como histórico. Ver `avaliacao-final-230.md`.
17. **PDM e especialista:** abrir caminho de escrita escopada ou registrar a decisão de não abrir
    (§5.5).
18. **Meta por área da Roda:** decidir instrumento × roteiro (§5.4) e, se instrumento, projetar
    em `pdm_itens.area_vida`.
19. **Anamnese Social:** decidir entre reintroduzir coord-only, absorver no intake ou assumir que
    é processo externo (§5.1).
20. **Autoavaliação do mentor:** recriar ou remover de vez, incluindo a fatia "contract" da 0128
    (colunas e RPC) (§5.2).

### O que **não** fazer

- Não criar instrumento novo antes do teste com uma dupla real: o problema do app hoje não é
  falta de instrumento, é instrumento sem uso.
- Não apagar `avaliacao_360` nem `avaliacao_especialista` antes da 230: são a única referência
  histórica do fechamento e a 230 reaproveita o `sistema` como chave de leitura.
- Não reescrever os títulos do cronograma em código (`src/lib`): eles são dado em
  `ciclo_eventos` e o rename já é suportado pela 0127.
