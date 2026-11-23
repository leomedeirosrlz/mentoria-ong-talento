# Opinião — plano "ficar em dia" 2.0 (REALIZA-518–522)

**Data:** 23/11/2026 · **Base:** recon `plano-518-522-2026-11-23.md` + specs 017–021 · **Tom:** franco.

## O que está forte

1. **A direção é a certa.** O plano atual é um oráculo: o sistema calcula, a dupla obedece. Perguntar ritmo, recesso e deixar quatro papéis abrirem transforma o plano em instrumento da dupla — e a base técnica aguenta: o planner já é puro, já recebe `ritmo` opcional, já calcula alternativas honestas (`alternativaRitmo`, `alternativaRecesso`). A maior parte da mudança é **input novo + semântica**, não reescrita.
2. **Fusão sem cópia é uma correção de dívida real.** O clone atual ("sessão dupla") é copiar/colar institucionalizado: N registros idênticos, N avaliações pela mesma sessão. Resolver isso direito (cobertura nativa) vale a migration.
3. **Docs lazy é a decisão madura.** Gerar roteiro 1 no agendamento e N+1 na conclusão evita o cemitério de 16 roteiros desatualizados — problema real de sistemas que geram lote.
4. **Aproveitamento da infra de Liza.** Registry, 2 fases, auditoria, evals declarativos, `DocBloco` + Zod já existem — a 022 é quase toda composição, não invenção.

## O que está arriscado (em ordem de perigo)

1. **"Um aceite basta" remove a única proteção bilateral do produto.** Hoje o aceite exige os dois lados — chato, mas o plano nunca ativa sem os dois saberem. Com um aceite, o mentor pode ativar e o jovem descobrir pelo primeiro encontro. A contestação até o primeiro encontro realizado mitiga, **mas só se a notificação chegar**. Risco concreto: jovem que quase não abre o app + notificação que não lê = plano ativo invisível. Mitigações que eu exigiria: notificação forte no canal que o jovem usa (hoje é sino no app — considerar WhatsApp se já existir o canal), copy do banner "seu mentor combinou um plano" (não "vocês combinaram"), e métrica de contestações para revisar a regra com dado.
2. **Fusão no registro: o clone histórico e a régua de leitura.** A mudança não é a coluna — é que ~6 leitores hoje assumem `registros.encontro_id = encontro` 1:1 (`jornadaDaDupla`, `registroTemConteudo`, agenda, semáforo, relatórios). Se um leitor escapar, um passo coberto aparece "sem registro". A régua "registro **ou cobertura**" precisa morar em UMA função do `ciclo.ts` e os testes do invariante 448 mudam na mesma PR. Também: clones históricos continuam válidos — não migrar dado, só ler direito.
3. **Disponibilidade por célula mente precisão.** `celulas` = dia × período (manhã/tarde/noite). "3 janelas" pode ser "manhãs de seg/qua/sex" — nada garante 1h livre. Sugerir ritmo por contagem de células é honesto **se a copy não prometer slot** ("horários em que os dois costumam poder"), mas as datas do plano seguirão ignorando a grade nesta fatia — a dupla ainda bate cabeça na hora de marcar. Eu aceitaria como MVP e mediria.
4. **Recesso pendente pode travar planos.** Se a decisão é pré-requisito da simulação e ninguém responde, o plano morre em "falta confirmar". Mitigação: a pendência não bloqueia a leitura do resto do card, e mentor + jovem respondem (hoje só mentor/coord — ampliar `declarar_recesso` para o mentorado é quase obrigatório, senão o jovem abre o plano e fica refém do mentor).
5. **"Sem teto" precisa de um piso de honestidade.** Fisicamente o máximo é 1/dia — a RPC valida `between 1 and 7` e o planner clampa [1,7]. Manter o 7 como limite físico é correto; o erro seria a UI sugerir que 4–6 é "arriscado" ou esconder. Copy: o máximo é um encontro por dia — nunca "o sistema não permite".

## Ordem de implementação recomendada

```
MVP (esta onda, em sequência):
  1. REALIZA-518 (spec 017) — autonomia: ritmo pills, recesso antes,
     papéis + aceite único. É a espinha; as outras dependem do plano.
  2. REALIZA-519 (spec 018) — fusão/cobertura. Toca schema e a régua
     de leitura; quanto antes, menos clone novo se acumula.
  3. REALIZA-520 (spec 019) — card "Sua semana". Depende do plano
     (017) e ganha vida com o roteiro (021), mas já entrega valor com
     o corpus estático como fonte do dropdown.
Depois:
  4. REALIZA-521 (spec 020) — docs: doc do combinado sai cedo (é
     render do escopo, barato); roteiros lazy esperam o 018 fechar
     (a nota de fusão no roteiro depende do modelo de cobertura).
Backlog:
  5. REALIZA-522 (spec 021) — Liza nos materiais. Schema de materiais
     pode migrar cedo se o lead quiser destravar; a tool espera.
```

Mudaria a ordem em um ponto: **o doc do combinado (parte da 021) deveria sair junto com a 017** — pedir aceite de um plano que a pessoa não lê é frágil justamente quando o aceite ficou mais fácil. O doc é render puro do `escopo`; custo baixo, valor alto.

## Simplificações que eu faria

- **UX:** o card do plano já está carregado (decisão de recesso embutida, proposta, projeção, régua). Adicionar pills de ritmo + confirmação de grade + recesso pode virar um formulário. Sugestão: um fluxo em 3 perguntas (ritmo → recesso se houver → confirmar/simular) só quando algo está pendente; quando tudo está respondido, o card volta a ser leitura.
- **Cobertura:** Opção A (coluna `cobertura` no registro/avaliação) + `encontros.sessao_id` opcional. Não criar tabela de join: o benefício (FK) não paga o custo (policies + joins em todos os leitores). `sessao_id` resolve o mint de avaliação sem inferir por `data_hora` igual.
- **Roteiros:** `plano_versao` para invalidar, e o dropdown da home preferir o roteiro vigente — mas **não** esconder o corpus estático: ele segue a referência completa na biblioteca.
- **"Em risco" do staff:** começar com 3 sinais (proposto expirando, passo vencido, contestado recente). Régua mais fina só com dados.

## Riscos específicos dos quatro pilares

- **Um aceite basta:** já coberto — notificação + copy + métrica de contestação. Se contestações dispararem, a regra vira bilateral de novo com dado, não com opinião.
- **Sem teto:** o 7 físico pode ficar; o problema é cultural — o planner hoje "decide" e a dupla confirma. Inverter (dupla decide, planner informa) é a mudança de produto real.
- **Célula:** granularidade fixa é a limitação aceita; se "as datas do plano caírem nas janelas" virar exigência depois, é trabalho novo no planner (preferência de dia), não extensão barata.
- **Fusão:** o aviso de gap de prática precisa ser registrado como decisão consciente (no `escopo`/`dupla_plano_eventos`) — senão vira aviso decorativo e ninguém audita "a dupla sabia".

## Como não sobrecarregar a dupla e não gerar documento demais

- O plano pergunta **uma vez**: ritmo, recesso (só os que existem na janela), confirmação de grade (só se falta). Respondido, some.
- Documentos ficam em três níveis claros: **doc do combinado** (o contrato, 1 por versão), **roteiro da semana** (operacional, 1 por passo, lazy), **corpus** (referência, biblioteca). Nada de quarto documento: o roteiro semanal substitui a leitura operacional do estático dentro do plano.
- Registro combinado elimina trabalho (um texto só) — comunicar assim: "menos digitação", não "nova funcionalidade".

## O que eu faria diferente do que está na fila

1. Juntaria o doc do combinado à 017 (acima).
2. Colocaria `sessao_id` em `encontros` já na migration da cobertura — sem ele, "quais encontros formam a sessão" fica implícito no `data_hora` igual, e a fusão no plano não tem onde gravar a intenção.
3. Em vez de "regenerar versão nova" como única resposta para roteiro ruim, permitiria um ajuste manual do rascunho (editar blocos) antes de publicar — regenerar inteiro descarta edições humanas.
4. Mediria antes de mexer: quantos planos hoje morrem em `proposto` sem aceite? Se for poucos, o "um aceite basta" resolve um problema menor do que parece e o risco 1 pesa mais.

## Perguntas para o Thiago (5)

1. "Um aceite basta": a notificação do outro lado sai só no app ou precisa de canal externo (WhatsApp/e-mail) no MVP? E medimos contestações para revisar a regra?
2. Recesso pendente: o jovem pode responder a decisão do recesso (ampliar `declarar_recesso`)? E se ninguém responder, o plano fica aberto esperando ou a coordenação é cutucada?
3. Ritmo: mantemos o check `1..7` na RPC como limite físico documentado, ou sai de vez? (Eu manteria com a justificativa "1/dia é o físico".)
4. Roteiro lazy: o primeiro roteiro deve nascer no tick do job (pode atrasar um dia) ou gerar também no primeiro acesso à semana?
5. Cobertura: `encontros.sessao_id` entra na mesma migration da `cobertura`, ou preferem começar só com a coluna no registro/avaliação?
