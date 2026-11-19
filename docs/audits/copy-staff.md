# Auditoria de copy — staff

Recorte: superfície `(app)` (coordenação, supervisão, mentor, auxiliar) e os
componentes/libs que a servem. As superfícies irmãs ficam nos worktrees
paralelos: jovem (`ws29-copy-jovem`) e canais — e-mail, WhatsApp, IA
(`ws31-copy-canais`).

Critérios aplicados (antislop + humanizer + convenções do repo):

- sem travessão (`—`) em texto exibido — `docs/convencoes/conventions-ui.md`;
- sem jargão interno no texto exibido (`semáforo`, `janela`, `eixo`, `estação`);
- concreto e direto, sem claim inflado, sem redundância;
- só correções inequívocas, sem mudar comportamento, contratos de action
  (`{ ok }`/`{ error }`), rótulos de teste que não são copy nem conteúdo
  digitado por usuário.

O que a varredura encontrou: o copy em si já era disciplinado (pt-BR, voz
direta, sem buzzwords). Os problemas claros eram pontuação e jargão:

1. **Travessão em texto exibido** — o padrão da casa para ligar duas orações
   já é `. ` ou `: ` (o próprio `assistente-cards.ts` normaliza ` — ` → `: `
   em conteúdo gerado). Todas as ocorrências em strings exibidas foram
   reescritas com `. `, `: `, `, `, `(...)` ou ` · ` conforme a relação entre
   as orações. Comentários e JSDoc não foram tocados (a regra é de texto
   exibido).
2. **"semáforo"** — vocabulário interno vazando em coluna de tabela e em
   explicações de relatório. Substituído por "situação", termo que a UI já
   usa (`SaudePrograma`, "situação + apoio" em `DuplaLinha`).
3. **"janela"** — idem. Vira "faixa" (horários do especialista), "período"
   (limites de uso da IA), "Encontros 1 a 4" (faixa do guia) ou some quando
   a frase fica clara sem a metáfora ("ainda não disponível").

## Correções aplicadas

| arquivo:linha | texto atual | problema | proposta |
|---|---|---|---|
| `src/app/(app)/duplas/[id]/encontro-row.tsx:515` | o {lacunaAnterior}º ainda está pendente — você pode agendar | travessão em texto exibido | o {lacunaAnterior}º ainda está pendente, mas você pode agendar |
| `src/app/(app)/duplas/[id]/terceiros-dupla.tsx:610` | confirme que ela autorizou — a resposta não pode ser editada depois. | travessão em texto exibido | confirme que ela autorizou. A resposta não pode ser editada depois. |
| `src/app/(app)/ia/page.tsx:118` | O Go limita em dólares por modelo e por mês. Em qualquer janela de 5 horas cabe 20% do teto e … | jargão interno (janela) | O Go limita em dólares por modelo e por mês. Em qualquer período de 5 horas cabe 20% do teto e… |
| `src/app/(app)/ia/page.tsx:128` | Com folga: projeção abaixo de 80% do teto. Atenção: projeção entre 80% e 100%, ou uma janela d… | jargão interno (janela) | Com folga: projeção abaixo de 80% do teto. Atenção: projeção entre 80% e 100%, ou o uso em 5 h… |
| `src/app/(app)/ia/page.tsx:355` | detalhe="Parou de responder até a janela liberar. | jargão interno (janela) | detalhe="Parou de responder até o período liberar. |
| `src/app/(app)/ia/page.tsx:899` | totais dos gráficos seguem completos — só as listas abaixo foram | travessão em texto exibido | totais dos gráficos seguem completos. Só as listas abaixo foram |
| `src/app/(app)/materiais/documento/[slug]/page.tsx:121` | dica: "Instrumento oficial do programa — o estado dele em cada dupla do seu escopo. | travessão em texto exibido | dica: "Instrumento oficial do programa: o estado dele em cada dupla do seu escopo. |
| `src/app/(app)/materiais/documento/[slug]/page.tsx:126` | dica: "Instrumento oficial do programa — liberado na ficha da dupla e o resultado volta estrut… | travessão em texto exibido | dica: "Instrumento oficial do programa: liberado na ficha da dupla e o resultado volta estrutu… |
| `src/app/(app)/materiais/instrumentos-programa.tsx:178` | janela não aberta | jargão interno (janela) | ainda não disponível |
| `src/app/(app)/materiais/instrumentos/[chave]/page.tsx:644` | aria-label={`Duplas — ${card.titulo}`} | travessão em texto exibido | aria-label={`Duplas: ${card.titulo}`} |
| `src/app/(app)/materiais/instrumentos/[chave]/page.tsx:748` | As respostas dos 360º são leitura da coordenação — o que chega pra | travessão em texto exibido | As respostas dos 360º são leitura da coordenação. O que chega pra |
| `src/app/(app)/relatorios/operacionais/adocao-ricos.tsx:65` | O gesto que alimenta este painel chegou agora — ele enche conforme | travessão em texto exibido | O gesto que alimenta este painel chegou agora: ele enche conforme |
| `src/app/(app)/relatorios/operacionais/adocao-ricos.tsx:187` | — ${FMT_INT.format(painel.toques)} toques de ${FMT_INT.format(painel.pessoas)} ${painel.pessoa… | travessão em texto exibido | ${FMT_INT.format(painel.toques)} toques de ${FMT_INT.format(painel.pessoas)} ${painel.pessoas … |
| `src/app/(app)/relatorios/operacionais/adocao-ricos.tsx:223` | uma visita contínua — a mediana aguenta a aba esquecida aberta. | travessão em texto exibido | uma visita contínua. A mediana aguenta a aba esquecida aberta. |
| `src/app/(app)/relatorios/operacionais/adocao-ricos.tsx:302` | contexto}. Página que cabe na tela não entra — o denominador | travessão em texto exibido | contexto}. Página que cabe na tela não entra: o denominador |
| `src/app/(app)/relatorios/operacionais/adocao-ricos.tsx:450` | recentes — a cauda antiga ficou de fora. | travessão em texto exibido | recentes: a cauda antiga ficou de fora. |
| `src/app/(app)/relatorios/operacionais/digest-botao.tsx:28` | Nenhum e-mail de coordenação cadastrado — nada enviado. | travessão em texto exibido | Nenhum e-mail de coordenação cadastrado: nada enviado. |
| `src/app/(app)/relatorios/operacionais/page.tsx:579` | Tendência diária do semáforo nos últimos {DIAS_TENDENCIA} dias — | jargão interno (semáforo) + travessão em texto exibido | Situação das duplas dia a dia nos últimos {DIAS_TENDENCIA} dias: |
| `src/app/(app)/relatorios/operacionais/page.tsx:580` | a leitura do histórico gravado, sem recálculo. | copy | leitura do histórico gravado, sem recálculo. |
| `src/app/(app)/relatorios/operacionais/page.tsx:597` | snapshots — o registro diário já está rodando; volte em | travessão em texto exibido | snapshots. O registro diário já está rodando; volte em |
| `src/app/(app)/relatorios/operacionais/secao-aderencia.tsx:271` | Semáforo | jargão interno (semáforo) | Situação |
| `src/app/(app)/relatorios/operacionais/secao-assinaturas.tsx:57` | descricao="Documento emitido × pessoa sem assinado_em — inclui os links expirados que ainda co… | travessão em texto exibido | descricao="Documento emitido × pessoa sem assinado_em: inclui os links expirados que ainda con… |
| `src/app/(app)/relatorios/operacionais/secao-assinaturas.tsx:146` | ${item.linha.documento} — link expirou ${dia(item.linha.expira_em)}; reemitir na ficha | travessão em texto exibido | ${item.linha.documento} · link expirou ${dia(item.linha.expira_em)}; reemitir na ficha |
| `src/app/(app)/relatorios/operacionais/secao-assinaturas.tsx:147` | ${item.linha.documento} — expira ${dia(item.linha.expira_em)} | travessão em texto exibido | ${item.linha.documento} · expira ${dia(item.linha.expira_em)} |
| `src/app/(app)/relatorios/operacionais/secao-formularios.tsx:51` | titulo="Formulários — taxa de resposta | travessão em texto exibido | titulo="Taxa de resposta de formulários |
| `src/app/(app)/relatorios/operacionais/secao-formularios.tsx:52` | descricao="Uma linha por link emitido: respondido/não e quantas respostas chegaram — a taxa se… | travessão em texto exibido | descricao="Uma linha por link emitido: respondido/não e quantas respostas chegaram. A taxa se … |
| `src/app/(app)/relatorios/operacionais/secao-interacoes.tsx:51` | descricao="Log de nudges, contatos e apoios registrados pela coordenação — o rastro de acompan… | travessão em texto exibido | descricao="Log de nudges, contatos e apoios registrados pela coordenação: o rastro de acompanh… |
| `src/app/(app)/relatorios/operacionais/secao-solicitacoes.tsx:136` | ${pendentes.length} em aberto — a mais antiga é de hoje | travessão em texto exibido | ${pendentes.length} em aberto: a mais antiga é de hoje |
| `src/app/(app)/relatorios/operacionais/secao-solicitacoes.tsx:138` | ${pendentes.length} em aberto — a mais antiga espera desde ontem | travessão em texto exibido | ${pendentes.length} em aberto: a mais antiga espera desde ontem |
| `src/app/(app)/relatorios/operacionais/secao-solicitacoes.tsx:139` | ${pendentes.length} em aberto — a mais antiga espera há ${maisAntigoDias} dias`} | travessão em texto exibido | ${pendentes.length} em aberto: a mais antiga espera há ${maisAntigoDias} dias`} |
| `src/app/(app)/relatorios/operacionais/tabela-superficies.tsx:123` | ativa ? ` — ${ord.dir === -1 ? "decrescente" : "crescente"}` : | travessão em texto exibido | ativa ? `: ${ord.dir === -1 ? "decrescente" : "crescente"}` : |
| `src/app/(app)/turmas/novo/page.tsx:27` | meta="Monte o calendário oficial com parâmetros ou importe de arquivo — prévia editável antes … | travessão em texto exibido | meta="Monte o calendário oficial com parâmetros ou importe de arquivo. Prévia editável antes d… |
| `src/app/api/documento/[id]/route.ts:62` | Arquivo ${intake.nome ?? "anexado"} — o oficial sai do bucket privado documentos. | travessão em texto exibido | Arquivo ${intake.nome ?? "anexado"}: o oficial sai do bucket privado documentos. |
| `src/components/assistente-genui.tsx:245` | d.detalhe ? ` — ${d.detalhe}` : | travessão em texto exibido | d.detalhe ? ` · ${d.detalhe}` : |
| `src/components/assistente-genui.tsx:306` | d.detalhe ? ` — ${d.detalhe}` : | travessão em texto exibido | d.detalhe ? ` · ${d.detalhe}` : |
| `src/components/assistente-genui.tsx:426` | d.detalhe ? ` — ${d.detalhe}` : | travessão em texto exibido | d.detalhe ? ` · ${d.detalhe}` : |
| `src/components/assistente-genui.tsx:529` | f.d.detalhe ? ` — ${f.d.detalhe}` : | travessão em texto exibido | f.d.detalhe ? ` · ${f.d.detalhe}` : |
| `src/components/assistente-genui.tsx:640` | d.detalhe ? `${total ? " — " : ""}${d.detalhe}` : null} | travessão em texto exibido | d.detalhe ? `${total ? " · " : ""}${d.detalhe}` : null} |
| `src/components/cronograma-editor.tsx:298` | nome da turma — renomear aqui atualiza a ficha | travessão em texto exibido | nome da turma. Renomear aqui atualiza a ficha |
| `src/components/duplas-lista.tsx:498` | aria-label={`Ordenar por ${dica} — ${ativa ? ORDEM_ROTULO[col][String(ordem!.dir) as "1" \| "-… | travessão em texto exibido | aria-label={`Ordenar por ${dica}: ${ativa ? ORDEM_ROTULO[col][String(ordem!.dir) as "1" \| "-1… |
| `src/components/ia-evals.tsx:287` | Três falhas seguidas de infra — o run pausou. Confira as credenciais do eval e retome. | travessão em texto exibido | Três falhas seguidas de infra. O run pausou. Confira as credenciais do eval e retome. |
| `src/components/ia-limpar-eventos.tsx:63` | gráficos e listas do Uso da Liza — inclusive o que veio de | travessão em texto exibido | gráficos e listas do Uso da Liza, inclusive o que veio de |
| `src/components/leitura-painel.tsx:56` | <span className="text-muted-foreground"> — {a.metrica}</span> | travessão em texto exibido | <span className="text-muted-foreground"> · {a.metrica}</span> |
| `src/components/matching-afinidade.tsx:146` | texto: `Quer ${rotulo} — ${primeiroNome(outro.nome)} não informou | travessão em texto exibido | texto: `Quer ${rotulo} · ${primeiroNome(outro.nome)} não informou |
| `src/components/matching-afinidade.tsx:150` | estado: "ok", texto: `Quer ${rotulo} — atendido` } | travessão em texto exibido | estado: "ok", texto: `Quer ${rotulo} · atendido` } |
| `src/components/matching-afinidade.tsx:153` | texto: `Quer ${rotulo} — ${primeiroNome(outro.nome)} é ${GENERO_LABELS[g].toLocaleLowerCase("p… | travessão em texto exibido | texto: `Quer ${rotulo} · ${primeiroNome(outro.nome)} é ${GENERO_LABELS[g].toLocaleLowerCase("p… |
| `src/components/matching-afinidade.tsx:221` | title={`${DIAS_SEMANA_LABELS[dia]} ${PERIODOS_LABELS[per].toLocaleLowerCase("pt-BR")} — ${ | travessão em texto exibido | title={`${DIAS_SEMANA_LABELS[dia]} ${PERIODOS_LABELS[per].toLocaleLowerCase("pt-BR")} · ${ |
| `src/components/matching-afinidade.tsx:434` | texto: `${primeiroNome(mentorado.nome)} tem ${anos} anos — o link da autorização do responsáve… | travessão em texto exibido | texto: `${primeiroNome(mentorado.nome)} tem ${anos} anos. O link da autorização do responsável… |
| `src/components/matching-afinidade.tsx:441` | texto: `${primeiroNome(mentorado.nome)} tem ${anos} anos — a autorização do responsável precis… | travessão em texto exibido | texto: `${primeiroNome(mentorado.nome)} tem ${anos} anos. A autorização do responsável precisa… |
| `src/components/matching-afinidade.tsx:447` | texto: `${primeiroNome(mentorado.nome)} tem ${anos} anos — a autorização do responsável ainda … | travessão em texto exibido | texto: `${primeiroNome(mentorado.nome)} tem ${anos} anos. A autorização do responsável ainda n… |
| `src/components/matching-afinidade.tsx:468` | Sem janela em comum de dia e período — confirme a agenda dos dois antes de formar. | jargão interno (janela) + travessão em texto exibido | Sem dia e período em comum: confirme a agenda dos dois antes de formar. |
| `src/components/matching-afinidade.tsx:476` | Agenda do jovem não informada — a grade dele pode ser preenchida na ficha. | travessão em texto exibido | Agenda do jovem não informada. A grade dele pode ser preenchida na ficha. |
| `src/components/matching-afinidade.tsx:548` | Termo enviado — aguardando assinatura | travessão em texto exibido | Termo enviado · aguardando assinatura |
| `src/components/matching-afinidade.tsx:579` | Interesses distintos — não é incompatibilidade: são repertórios diferentes pra trocar. | travessão em texto exibido | Interesses distintos. Não é incompatibilidade: são repertórios diferentes pra trocar. |
| `src/components/material-documento.tsx:138` | aria-label={`${ln[0].replace(/<[^>]+>/g, "")} — ${b.cabecalho[k].replace(/<[^>]+>/g, "")}`} | travessão em texto exibido | aria-label={`${ln[0].replace(/<[^>]+>/g, "")}, ${b.cabecalho[k].replace(/<[^>]+>/g, "")}`} |
| `src/components/material-documento.tsx:578` | Template do guia do programa — adapte ao seu jeito de escrever. | travessão em texto exibido | Template do guia do programa: adapte ao seu jeito de escrever. |
| `src/components/mentorado-actions.tsx:167` | Já entrou na plataforma — trocar aqui muda o e-mail de acesso | travessão em texto exibido | Já entrou na plataforma. Trocar aqui muda o e-mail de acesso |
| `src/components/perguntar-liza.tsx:110` | A Liza responde sobre os agregados desta seção — nunca sobre | travessão em texto exibido | A Liza responde sobre os agregados desta seção, nunca sobre |
| `src/components/perguntar-liza.tsx:125` | Desatualizado — os dados da seção mudaram depois desta resposta. | travessão em texto exibido | Desatualizado: os dados da seção mudaram depois desta resposta. |
| `src/components/perguntar-liza.tsx:157` | Ainda não há resposta para este recorte — a primeira geração já | travessão em texto exibido | Ainda não há resposta para este recorte. A primeira geração já |
| `src/components/perguntar-liza.tsx:171` | <DialogTitle>Perguntar à Liza — {abaRotulo}</DialogTitle> | travessão em texto exibido | <DialogTitle>Perguntar à Liza: {abaRotulo}</DialogTitle> |
| `src/components/resumo-desfecho.tsx:83` | Como os jovens estão depois da jornada — só números agregados | travessão em texto exibido | Como os jovens estão depois da jornada: só números agregados |
| `src/components/retrospectiva-jornada.tsx:538` | Aplicação formal — a leitura inicial não chegou a ser respondida. | travessão em texto exibido | Aplicação formal: a leitura inicial não chegou a ser respondida. |
| `src/components/retrospectiva-jornada.tsx:539` | Leitura inicial — a aplicação formal ainda não aconteceu."} | travessão em texto exibido | Leitura inicial: a aplicação formal ainda não aconteceu."} |
| `src/lib/actions-assinaturas.ts:791` | Este documento é assinado pelo responsável — encaminhe o link para ele. | travessão em texto exibido | Este documento é assinado pelo responsável. Encaminhe o link para ele. |
| `src/lib/actions-cronogramas.ts:342` | Há duplas vinculadas a este cronograma — excluir apagaria o calendário oficial delas. Remaneje… | travessão em texto exibido | Há duplas vinculadas a este cronograma. Excluir apagaria o calendário oficial delas. Remaneje … |
| `src/lib/actions-cronogramas.ts:362` | Há chamadas registradas em eventos deste cronograma. A exclusão apagaria o histórico — encerre… | travessão em texto exibido | Há chamadas registradas em eventos deste cronograma. A exclusão apagaria o histórico: encerre … |
| `src/lib/actions-cronogramas.ts:503` | Este evento tem chamada registrada — excluir apagaria as presenças. Edite a data ou o título e… | travessão em texto exibido | Este evento tem chamada registrada. Excluir apagaria as presenças. Edite a data ou o título em… |
| `src/lib/actions-email.ts:405` | sem_email: "sem e-mail do jovem nem do mentor — entregue à mão | travessão em texto exibido | sem_email: "sem e-mail do jovem nem do mentor: entregue à mão |
| `src/lib/actions-email.ts:407` | simulado: "modo demonstração — nada é emitido nem enviado | travessão em texto exibido | simulado: "modo demonstração: nada é emitido nem enviado |
| `src/lib/actions-encerramento.ts:104` | error: "A jornada já concluiu com o último encontro — registre a conclusão. | travessão em texto exibido | error: "A jornada já concluiu com o último encontro. Registre a conclusão. |
| `src/lib/actions-encerramento.ts:369` | ${eu.nome} fechou sua mentoria especializada — a devolutiva segue pro seu PDM. | travessão em texto exibido | ${eu.nome} fechou sua mentoria especializada. A devolutiva segue pro seu PDM. |
| `src/lib/actions-especialista.ts:382` | return "Já existe uma janela começando nesse horário nesse dia. | jargão interno (janela) | return "Já existe uma faixa começando nesse horário nesse dia. |
| `src/lib/actions-especialista.ts:405` | return { error: "Confira os horários da janela." } | jargão interno (janela) | return { error: "Confira os horários da faixa." } |
| `src/lib/actions-especialista.ts:408` | return { error: "O fim da janela precisa ser depois do início." } | jargão interno (janela) | return { error: "O fim da faixa precisa ser depois do início." } |
| `src/lib/actions-especialista.ts:426` | if (!id) return { error: "Janela não informada." } | jargão interno (janela) | if (!id) return { error: "Faixa não informada." } |
| `src/lib/actions-importar-registros.ts:270` | Linha ${l.n}: mesma dupla e nº da linha ${colide} — só uma entra | travessão em texto exibido | Linha ${l.n}: mesma dupla e nº da linha ${colide}: só uma entra |
| `src/lib/actions-pdm.ts:18` | return "O PDM comporta no máximo 10 metas — descarte uma antes de criar outra. | travessão em texto exibido | return "O PDM comporta no máximo 10 metas. Descarte uma antes de criar outra. |
| `src/lib/actions-pdm.ts:20` | return "O PDM comporta no máximo 20 subitens no total — descarte ou conclua alguns antes de cr… | travessão em texto exibido | return "O PDM comporta no máximo 20 subitens no total. Descarte ou conclua alguns antes de cri… |
| `src/lib/actions-pdm.ts:24` | return "A ordem não pôde ser salva — a lista mudou em outra tela. Atualize a página. | travessão em texto exibido | return "A ordem não pôde ser salva: a lista mudou em outra tela. Atualize a página. |
| `src/lib/actions-pdm.ts:25` | if (e?.code === "23514") return "Valor fora do permitido — revise os campos. | travessão em texto exibido | if (e?.code === "23514") return "Valor fora do permitido. Revise os campos. |
| `src/lib/actions-relatorio-links.ts:27` | Senha inválida — de 6 a 72 caracteres, ou deixe em branco pra gerar uma forte. | travessão em texto exibido | Senha inválida: de 6 a 72 caracteres, ou deixe em branco pra gerar uma forte. |
| `src/lib/actions-terceiros.ts:72` | return "Convite não encontrado — recarregue a página. | travessão em texto exibido | return "Convite não encontrado. Recarregue a página. |
| `src/lib/actions-terceiros.ts:74` | return "Esta pessoa já respondeu — a resposta não pode ser alterada. | travessão em texto exibido | return "Esta pessoa já respondeu. A resposta não pode ser alterada. |
| `src/lib/actions-terceiros.ts:98` | return { error: "WhatsApp inválido — use o número com DDD." } | travessão em texto exibido | return { error: "WhatsApp inválido. Use o número com DDD." } |
| `src/lib/actions-terceiros.ts:131` | if (w === undefined) return { error: "WhatsApp inválido — use o número com DDD." } | travessão em texto exibido | if (w === undefined) return { error: "WhatsApp inválido. Use o número com DDD." } |
| `src/lib/actions-terceiros.ts:285` | return { error: "Resposta longa demais — até 4000 caracteres por campo." } | travessão em texto exibido | return { error: "Resposta longa demais: até 4000 caracteres por campo." } |
| `src/lib/actions.ts:948` | O papel de mentorado vem do vínculo com o cadastro do jovem — não é concedido por aqui. | travessão em texto exibido | O papel de mentorado vem do vínculo com o cadastro do jovem, então não é concedido por aqui. |
| `src/lib/actions.ts:980` | Essa pessoa é jovem do programa — a mudança de papel segue pelo fluxo de promoção a mentor. | travessão em texto exibido | Essa pessoa é jovem do programa. A mudança de papel segue pelo fluxo de promoção a mentor. |
| `src/lib/actions.ts:1597` | Essa pessoa já entrou na plataforma — o e-mail de acesso não pode ficar vazio. | travessão em texto exibido | Essa pessoa já entrou na plataforma. O e-mail de acesso não pode ficar vazio. |
| `src/lib/actions.ts:1686` | Essa pessoa já entrou na plataforma — marque como desistente em vez de excluir. | travessão em texto exibido | Essa pessoa já entrou na plataforma. Marque como desistente em vez de excluir. |
| `src/lib/actions.ts:1861` | Trilha de especialista se encerra pelo botão 'Encerrar trilha' da ficha — é o rito que pede mo… | travessão em texto exibido | Trilha de especialista se encerra pelo botão 'Encerrar trilha' da ficha: é o rito que pede mot… |
| `src/lib/actions.ts:2051` | A dupla DPP precisa de um cronograma pra ficar ativa — cadastre um antes. | travessão em texto exibido | A dupla DPP precisa de um cronograma pra ficar ativa. Cadastre um antes. |
| `src/lib/actions.ts:2257` | error: `Essa dupla tem histórico que não pode ser apagado (${historico.join(", ")}). Encerre-a… | travessão em texto exibido | error: `Essa dupla tem histórico que não pode ser apagado (${historico.join(", ")}). Encerre-a… |
| `src/lib/actions.ts:2356` | A devolutiva pro PDM precisa de 10 a 4.000 caracteres — é a entrega de quem sai da trilha. | travessão em texto exibido | A devolutiva pro PDM precisa de 10 a 4.000 caracteres: é a entrega de quem sai da trilha. |
| `src/lib/actions.ts:2364` | Essa pessoa já é o mentor da dupla — pra trocar, escolha outra. | travessão em texto exibido | Essa pessoa já é o mentor da dupla. Pra trocar, escolha outra. |
| `src/lib/actions.ts:2365` | Essa pessoa já é o mentorado da dupla — pra trocar, escolha outra. | travessão em texto exibido | Essa pessoa já é o mentorado da dupla. Pra trocar, escolha outra. |
| `src/lib/actions.ts:3134` | return { error: "Esse encontro já passou — pra trocar o link, remarque a data junto." } | travessão em texto exibido | return { error: "Esse encontro já passou. Pra trocar o link, remarque a data junto." } |
| `src/lib/actions.ts:3196` | return { error: "Essa dupla está sem cronograma — a coordenação vincula um na edição da dupla.… | travessão em texto exibido | return { error: "Essa dupla está sem cronograma. A coordenação vincula um na edição da dupla."… |
| `src/lib/actions.ts:3244` | O guia prevê 5 sessões por trilha de especialista — essa já completou. | travessão em texto exibido | O guia prevê 5 sessões por trilha de especialista: essa já completou. |
| `src/lib/actions.ts:3515` | A sessão dupla não se aplica à trilha de especialista — cada sessão é registrada na própria li… | travessão em texto exibido | A sessão dupla não se aplica à trilha de especialista: cada sessão é registrada na própria lin… |
| `src/lib/actions.ts:3599` | O ${m}º encontro ainda está marcado pro futuro — desmarque antes de cobrir. | travessão em texto exibido | O ${m}º encontro ainda está marcado pro futuro. Desmarque antes de cobrir. |
| `src/lib/actions.ts:3620` | O ${m}º encontro está ${enc2.status === "nao_aconteceu" ? "marcado como não realizado" : "canc… | travessão em texto exibido | O ${m}º encontro está ${enc2.status === "nao_aconteceu" ? "marcado como não realizado" : "canc… |
| `src/lib/actions.ts:3637` | O registro do ${m}º encontro não entrou — registre pela ficha. | travessão em texto exibido | O registro do ${m}º encontro não entrou. Registre pela ficha. |
| `src/lib/actions.ts:3709` | return { error: "Essa dupla está sem cronograma — a coordenação vincula um na edição da dupla.… | travessão em texto exibido | return { error: "Essa dupla está sem cronograma. A coordenação vincula um na edição da dupla."… |
| `src/lib/ajuda/conteudo.ts:126` | Sem problema: qualquer um dos dois registra como já realizado — o mentor na ficha da dupla ou … | travessão em texto exibido | Sem problema: qualquer um dos dois registra como já realizado (o mentor na ficha da dupla ou n… |
| `src/lib/ajuda/conteudo.ts:138` | Você mesmo registra: na sua página inicial ou na Agenda, toca em \"registre você aqui\" e cont… | travessão em texto exibido | Você mesmo registra: na sua página inicial ou na Agenda, toca em \"registre você aqui\" e cont… |
| `src/lib/como-conduzir.ts:92` | Entregue no 1º encontro (a janela do guia vai até o 4º). O exercício pede imaginação: o jovem … | jargão interno (janela) + travessão em texto exibido | Entregue no 1º encontro (o guia prevê até o 4º). O exercício pede imaginação: o jovem narra o … |
| `src/lib/como-conduzir.ts:94` | Janela dos encontros 1–4: o exercício de imaginação da vida ideal que vira a Declaração de Vis… | jargão interno (janela) + travessão em texto exibido | Encontros 1 a 4: o exercício de imaginação da vida ideal que vira a Declaração de Visão, o nor… |
| `src/lib/como-conduzir.ts:101` | Janela dos encontros 2–3: a Visão desdobrada em 3–5 metas, cada uma com o porquê do jovem e a … | jargão interno (janela) + travessão em texto exibido | Encontros 2 e 3: a Visão desdobrada em 3 a 5 metas, cada uma com o porquê do jovem e a checage… |
| `src/lib/como-conduzir.ts:106` | Documento vivo construído nos enc. 1–4: Visão no topo, metas com indicador de sucesso (IS) e p… | travessão em texto exibido | Documento vivo construído nos enc. 1–4: Visão no topo, metas com indicador de sucesso (IS) e p… |
| `src/lib/como-conduzir.ts:113` | Duas aplicações: a leitura inicial no enc. 1 — o ponto de partida — e a aplicação formal nos e… | travessão em texto exibido | Duas aplicações: a leitura inicial no enc. 1 (o ponto de partida) e a aplicação formal nos enc… |
| `src/lib/como-conduzir.ts:115` | Duas aplicações: leitura inicial no encontro 1 (o ponto de partida) e aplicação formal nos enc… | travessão em texto exibido | Duas aplicações: leitura inicial no encontro 1 (o ponto de partida) e aplicação formal nos enc… |
| `src/lib/como-conduzir.ts:120` | Autoavaliação do mentor em duas marcações: no início do ciclo, marcando onde já se sente segur… | travessão em texto exibido | Autoavaliação do mentor em duas marcações: no início do ciclo, marcando onde já se sente segur… |
| `src/lib/como-conduzir.ts:122` | Checklist das 10 competências do guia respondido pelo mentor: marcação de início ao formar a d… | travessão em texto exibido | Checklist das 10 competências do guia respondido pelo mentor: marcação de início ao formar a d… |
| `src/lib/como-conduzir.ts:137` | Apresentem-se e troquem histórias de vida — a sua com honestidade, inclusive os tropeços — e c… | travessão em texto exibido | Apresentem-se e troquem histórias de vida, a sua com honestidade, inclusive os tropeços, e con… |
| `src/lib/como-conduzir.ts:143` | Apresente os resultados consolidados da avaliação por terceiros, sempre preservando o anonimat… | travessão em texto exibido | Apresente os resultados consolidados da avaliação por terceiros, sempre preservando o anonimat… |
| `src/lib/como-conduzir.ts:149` | O jovem apresenta as metas que criou — se travou, retome os pontos que ele citou nas conversas… | travessão em texto exibido | O jovem apresenta as metas que criou. Se travou, retome os pontos que ele citou nas conversas … |
| `src/lib/como-conduzir.ts:153` | Validação da lógica do plano (submetas × metas × prazos) e compromisso de início da execução —… | travessão em texto exibido | Validação da lógica do plano (submetas × metas × prazos) e compromisso de início da execução: … |
| `src/lib/como-conduzir.ts:155` | Verifiquem se o plano fecha de forma lógica — se as submetas realmente levam às metas e se os … | travessão em texto exibido | Verifiquem se o plano fecha de forma lógica (se as submetas realmente levam às metas e se os p… |
| `src/lib/como-conduzir.ts:161` | Com o PDM em execução, este encontro abre o acompanhamento formal das ações planejadas. Conduz… | travessão em texto exibido | Com o PDM em execução, este encontro abre o acompanhamento formal das ações planejadas. Conduz… |
| `src/lib/como-conduzir.ts:167` | Apoie o jovem na superação dos obstáculos encontrados na execução — inseguranças, autocríticas… | travessão em texto exibido | Apoie o jovem na superação dos obstáculos encontrados na execução: inseguranças, autocríticas … |
| `src/lib/como-conduzir.ts:173` | Revisem juntos o andamento das submetas e ajustem o que for preciso: prazos, indicadores ou o … | travessão em texto exibido | Revisem juntos o andamento das submetas e ajustem o que for preciso: prazos, indicadores ou o … |
| `src/lib/como-conduzir.ts:179` | Retomem o mapa de metas e submetas e conversem sobre o que foi concluído desde o último encont… | travessão em texto exibido | Retomem o mapa de metas e submetas e conversem sobre o que foi concluído desde o último encont… |
| `src/lib/como-conduzir.ts:185` | Metade da jornada é um bom momento para olhar para trás. Analisem as metas atingidas, as subme… | travessão em texto exibido | Metade da jornada é um bom momento para olhar para trás. Analisem as metas atingidas, as subme… |
| `src/lib/como-conduzir.ts:191` | Encontro de caráter relacional e simbólico: compartilhe experiências de vida, aprendizados e m… | travessão em texto exibido | Encontro de caráter relacional e simbólico: compartilhe experiências de vida, aprendizados e m… |
| `src/lib/como-conduzir.ts:197` | Conversem sobre a rede de apoio do jovem: em quem ele pode contar e que portas ainda não foram… | travessão em texto exibido | Conversem sobre a rede de apoio do jovem: em quem ele pode contar e que portas ainda não foram… |
| `src/lib/como-conduzir.ts:203` | Discutam os motivos que levaram a cada nota da Roda da Vida, quadrante por quadrante, ajudando… | travessão em texto exibido | Discutam os motivos que levaram a cada nota da Roda da Vida, quadrante por quadrante, ajudando… |
| `src/lib/como-conduzir.ts:209` | Revisem as metas que ele elaborou para cada área, checando prazos e indicadores de sucesso. Em… | travessão em texto exibido | Revisem as metas que ele elaborou para cada área, checando prazos e indicadores de sucesso. Em… |
| `src/lib/escritas.ts:86` | return { error: "Essa dupla está sem cronograma — a coordenação vincula um na edição da dupla.… | travessão em texto exibido | return { error: "Essa dupla está sem cronograma. A coordenação vincula um na edição da dupla."… |
| `src/lib/escritas.ts:105` | As sessões da trilha especialista nascem dos pedidos aceitos — combine com o jovem ou a coorde… | travessão em texto exibido | As sessões da trilha especialista nascem dos pedidos aceitos. Combine com o jovem ou a coorden… |
| `src/lib/escritas.ts:211` | return { error: "Conte o motivo da saída — ele aparece na ficha e na lista." } | travessão em texto exibido | return { error: "Conte o motivo da saída: ele aparece na ficha e na lista." } |
| `src/lib/escritas.ts:223` | Tem dupla em andamento — registre o encerramento na ficha da dupla antes de marcar a saída. | travessão em texto exibido | Tem dupla em andamento. Registre o encerramento na ficha da dupla antes de marcar a saída. |
| `src/lib/escritas.ts:332` | Essa pessoa já entrou na plataforma — o e-mail de acesso só muda pelo perfil dela. | travessão em texto exibido | Essa pessoa já entrou na plataforma. O e-mail de acesso só muda pelo perfil dela. |
| `src/lib/escritas.ts:347` | Essa pessoa já entrou na plataforma — o e-mail de acesso só muda pelo perfil dela. | travessão em texto exibido | Essa pessoa já entrou na plataforma. O e-mail de acesso só muda pelo perfil dela. |
| `src/lib/forms/actions.ts:268` | Links genéricos não são mais aceitos — escolha um destinatário. Pra divulgação aberta, use o l… | travessão em texto exibido | Links genéricos não são mais aceitos. Escolha um destinatário. Pra divulgação aberta, use o li… |
| `src/lib/forms/actions.ts:506` | Resposta de inscrição não se vincula assim — ela vira cadastro pela revisão (Revisar e cadastr… | travessão em texto exibido | Resposta de inscrição não se vincula assim: ela vira cadastro pela revisão (Revisar e cadastra… |
| `src/lib/forms/actions.ts:799` | A resposta não tem nome e e-mail preenchidos — cadastre pela ficha manual. | travessão em texto exibido | A resposta não tem nome e e-mail preenchidos. Cadastre pela ficha manual. |
| `src/lib/forms/actions.ts:851` | A resposta não tem nome e e-mail preenchidos — cadastre pela ficha manual. | travessão em texto exibido | A resposta não tem nome e e-mail preenchidos. Cadastre pela ficha manual. |
| `src/lib/forms/normaliza.ts:90` | aviso: "o rótulo da pergunta veio junto — descartado, confira a resposta | travessão em texto exibido | aviso: "o rótulo da pergunta veio junto: descartado, confira a resposta |
| `src/lib/forms/normaliza.ts:102` | aviso: "é pronome de preferência, não nome — descartado | travessão em texto exibido | aviso: "é pronome de preferência, não nome: descartado |
| `src/lib/forms/normaliza.ts:114` | aviso: "é negativa/recusa, não nome — descartado | travessão em texto exibido | aviso: "é negativa/recusa, não nome: descartado |
| `src/lib/forms/normaliza.ts:155` | aviso = "tinha mais de um e-mail — ficou o primeiro | travessão em texto exibido | aviso = "tinha mais de um e-mail: ficou o primeiro |
| `src/lib/forms/normaliza.ts:167` | aviso = "vírgula no lugar de ponto — conferir | travessão em texto exibido | aviso = "vírgula no lugar de ponto: conferir |
| `src/lib/forms/normaliza.ts:215` | aviso = "tinha mais de um número — ficou o primeiro | travessão em texto exibido | aviso = "tinha mais de um número: ficou o primeiro |
| `src/lib/forms/normaliza.ts:227` | aviso = "zero à esquerda desconsiderado — conferir o número | travessão em texto exibido | aviso = "zero à esquerda desconsiderado: conferir o número |
| `src/lib/forms/normaliza.ts:254` | const naoLink = { valor: null, mudou: true, aviso: "não parece um link — revisar" } as const | travessão em texto exibido | const naoLink = { valor: null, mudou: true, aviso: "não parece um link: revisar" } as const |
| `src/lib/forms/normaliza.ts:260` | return { valor: null, mudou: true, aviso: "parece um e-mail, não um link — revisar" } | travessão em texto exibido | return { valor: null, mudou: true, aviso: "parece um e-mail, não um link: revisar" } |
| `src/lib/forms/normaliza.ts:287` | aviso: "domínio incomum — conferir o link" } | travessão em texto exibido | aviso: "domínio incomum: conferir o link" } |
| `src/lib/forms/normaliza.ts:327` | aviso = "ano com 2 dígitos — conferir | travessão em texto exibido | aviso = "ano com 2 dígitos: conferir |
| `src/lib/forms/schema.ts:228` | resumo: "As 10 competências do guia, marcadas no início do ciclo e revisitadas no fechamento —… | travessão em texto exibido | resumo: "As 10 competências do guia, marcadas no início do ciclo e revisitadas no fechamento: … |
| `src/lib/importar-cronograma/extrair.ts:197` | return { ok: false, erro: `O PDF tem ${doc.numPages} páginas — o limite por importação é ${MAX… | travessão em texto exibido | return { ok: false, erro: `O PDF tem ${doc.numPages} páginas: o limite por importação é ${MAX_… |
| `src/lib/importar-cronograma/extrair.ts:220` | return { ok: false, erro: "Não consegui ler esse arquivo — ele pode estar corrompido ou proteg… | travessão em texto exibido | return { ok: false, erro: "Não consegui ler esse arquivo: ele pode estar corrompido ou protegi… |
| `src/lib/importar-cronograma/normalizar.ts:137` | avisos.push(`"${titulo.slice(0, 50)}" ficou sem data — preencha na revisão.`) | travessão em texto exibido | avisos.push(`"${titulo.slice(0, 50)}" ficou sem data: preencha na revisão.`) |
| `src/lib/importar-duplas.ts:246` | erro: `"${valor}" é ambíguo (${nomes}${resto}) — use o e-mail | travessão em texto exibido | erro: `"${valor}" é ambíguo (${nomes}${resto}). Use o e-mail |
| `src/lib/importar-duplas.ts:306` | .join(", ")}) — informe a coluna turma | travessão em texto exibido | .join(", ")}). Informe a coluna turma |
| `src/lib/importar-duplas.ts:307` | sem turma na linha e nenhum cronograma ativo — informe a coluna turma | travessão em texto exibido | sem turma na linha e nenhum cronograma ativo. Informe a coluna turma |
| `src/lib/importar-duplas.ts:316` | return { erro: `turma "${txt}" não encontrada — existentes: ${rotulos \|\| "nenhuma"}` } | travessão em texto exibido | return { erro: `turma "${txt}" não encontrada. Existentes: ${rotulos \|\| "nenhuma"}` } |
| `src/lib/importar-duplas.ts:383` | return falha(`${mentor.nome}: cadastro inativo — reative antes de parear`) | travessão em texto exibido | return falha(`${mentor.nome}: cadastro inativo. Reative antes de parear`) |
| `src/lib/importar-duplas.ts:411` | trilha inválida ("${linha.trilha.trim()}" — use dpp ou especialista) | travessão em texto exibido | trilha inválida ("${linha.trilha.trim()}": use dpp ou especialista) |
| `src/lib/importar-duplas.ts:416` | ${mentor.nome}: mentor híbrido — informe a coluna trilha (dpp ou especialista) | travessão em texto exibido | ${mentor.nome}: mentor híbrido. Informe a coluna trilha (dpp ou especialista) |
| `src/lib/importar-duplas.ts:516` | iniciada_em inválida ("${linha.iniciada_em.trim()}" — use dd/mm/aaaa ou aaaa-mm-dd) | travessão em texto exibido | iniciada_em inválida ("${linha.iniciada_em.trim()}": use dd/mm/aaaa ou aaaa-mm-dd) |
| `src/lib/importar-registros.ts:492` | push("data", "data", l.data, "", true, "data ilegível — descartada") | travessão em texto exibido | push("data", "data", l.data, "", true, "data ilegível: descartada") |
| `src/lib/importar-registros.ts:494` | push("data", "data", l.data, `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`, true… | travessão em texto exibido | push("data", "data", l.data, `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`, true… |
| `src/lib/importar-registros.ts:501` | push("duracao", "duração", l.duracao, "", true, "duração não reconhecida — ficou 60 min") | travessão em texto exibido | push("duracao", "duração", l.duracao, "", true, "duração não reconhecida: ficou 60 min") |
| `src/lib/importar-registros.ts:506` | push("avaliacao", "avaliação", l.avaliacao, "", true, "não reconhecida — ficou em branco") | travessão em texto exibido | push("avaliacao", "avaliação", l.avaliacao, "", true, "não reconhecida: ficou em branco") |
| `src/lib/importar-registros.ts:523` | push("apoio", "apoio", l.apoio, "", true, "pedido de apoio não se importa — ele é feito pela p… | travessão em texto exibido | push("apoio", "apoio", l.apoio, "", true, "pedido de apoio não se importa: ele é feito pela pl… |
| `src/lib/importar-registros.ts:838` | texto: `"${normTexto(valor)}" não é nome — rótulo genérico | travessão em texto exibido | texto: `"${normTexto(valor)}" não é nome: rótulo genérico |
| `src/lib/importar-registros.ts:941` | texto = `"${normTexto(valor)}" — ${best.social ? "nome social exato" : "nome exato"} | travessão em texto exibido | texto = `"${normTexto(valor)}": ${best.social ? "nome social exato" : "nome exato"} |
| `src/lib/importar-registros.ts:953` | texto = `"${normTexto(valor)}" — único(a) ${rotulo} com esse nome | travessão em texto exibido | texto = `"${normTexto(valor)}": único(a) ${rotulo} com esse nome |
| `src/lib/importar-registros.ts:1068` | texto: `${numero}º oficial era ${ddmm(oficial)} — data informada ${ddmm(dataIso)} (±${Math.rou… | travessão em texto exibido | texto: `${numero}º oficial era ${ddmm(oficial)}. Data informada ${ddmm(dataIso)} (±${Math.roun… |
| `src/lib/importar-registros.ts:1260` | motivos.push("o par se resolve, mas não forma dupla cadastrada — escolha") | travessão em texto exibido | motivos.push("o par se resolve, mas não forma dupla cadastrada: escolha") |
| `src/lib/importar-registros.ts:1269` | ${rot} "${normTexto(txt)}" não é nome — rótulo genérico | travessão em texto exibido | ${rot} "${normTexto(txt)}" não é nome: rótulo genérico |
| `src/lib/importar-registros.ts:1283` | if (forcaManual) motivos.push("duplas plausíveis empatadas — escolha") | travessão em texto exibido | if (forcaManual) motivos.push("duplas plausíveis empatadas: escolha") |
| `src/lib/importar-registros.ts:1284` | else if (ambig) motivos.push("mais de uma dupla plausível — escolha") | travessão em texto exibido | else if (ambig) motivos.push("mais de uma dupla plausível: escolha") |
| `src/lib/importar-registros.ts:1287` | match provável (confiança ${Math.min(100, top!.score)}) — confira a sugestão | travessão em texto exibido | match provável (confiança ${Math.min(100, top!.score)}). Confira a sugestão |
| `src/lib/importar-registros.ts:1296` | motivo: motivos.join(" · ") \|\| (nivel === "manual" ? "dupla não identificada — escolha" : nu… | travessão em texto exibido | motivo: motivos.join(" · ") \|\| (nivel === "manual" ? "dupla não identificada: escolha" : nul… |
| `src/lib/importar-registros.ts:1401` | if (r.dataIso && r.dataIso > hojeIso) motivos.push("data no futuro — conferir") | travessão em texto exibido | if (r.dataIso && r.dataIso > hojeIso) motivos.push("data no futuro: conferir") |
| `src/lib/importar.ts:903` | (opts?.falha ?? "não reconhecido — descartado") | travessão em texto exibido | (opts?.falha ?? "não reconhecido: descartado") |
| `src/lib/importar.ts:943` | falha: "UF não reconhecida — descartada" } | travessão em texto exibido | falha: "UF não reconhecida: descartada" } |
| `src/lib/jobs-digest.ts:73` | quinzenal — último envio há menos de 14 dias | travessão em texto exibido | quinzenal: último envio há menos de 14 dias |
| `src/lib/jobs.ts:58` | error: "CRON_SECRET não configurado — job desligado, nada rodou." } | travessão em texto exibido | error: "CRON_SECRET não configurado: job desligado, nada rodou." } |
| `src/lib/jobs.ts:84` | error: "desde inválido — use YYYY-MM-DD até hoje (BRT)." } | travessão em texto exibido | error: "desde inválido. Use YYYY-MM-DD até hoje (BRT)." } |
| `src/lib/relatorios/leituras-aderencia.ts:26` | pedido de apoio é alguém pedindo ajuda de propósito — nenhuma outra fila vem antes dele | travessão em texto exibido | pedido de apoio é alguém pedindo ajuda de propósito: nenhuma outra fila vem antes dele |
| `src/lib/relatorios/leituras-aderencia.ts:39` | fez menos encontros do que o cronograma já devia — a lacuna só cresce se ninguém cobrar | travessão em texto exibido | fez menos encontros do que o cronograma já devia: a lacuna só cresce se ninguém cobrar |
| `src/lib/relatorios/leituras-aderencia.ts:51` | encontro acontecido sem registro apaga a evidência do trabalho — e o semáforo cobra | jargão interno (semáforo) + travessão em texto exibido | encontro acontecido sem registro apaga a evidência do trabalho: a situação da dupla cobra |
| `src/lib/relatorios/leituras-aderencia.ts:63` | registro tardio distorce a leitura da semana — o painel atrasa junto | travessão em texto exibido | registro tardio distorce a leitura da semana: o painel atrasa junto |
| `src/lib/relatorios/leituras-aderencia.ts:75` | remarcar demais desgasta os dois lados — agenda que sempre muda tende a esfriar | travessão em texto exibido | remarcar demais desgasta os dois lados: agenda que sempre muda tende a esfriar |
| `src/lib/relatorios/leituras-aderencia.ts:87` | intervencao: "nada a fazer — é folga, não dívida | travessão em texto exibido | intervencao: "nada a fazer: é folga, não dívida |
| `src/lib/relatorios/leituras-adocao.ts:56` | queda de um quinto ou mais entre janelas iguais merece explicação — feriado, bug ou desinteres… | jargão interno (janela) + travessão em texto exibido | queda de um quinto ou mais entre janelas iguais merece explicação: feriado, bug ou desinteresse |
| `src/lib/relatorios/leituras-adocao.ts:66` | intervencao: "registre o que funcionou — a régua da semana vem daqui | travessão em texto exibido | intervencao: "registre o que funcionou: a régua da semana vem daqui |
| `src/lib/relatorios/leituras-adocao.ts:112` | menos da metade dos links emitidos volta — o instrumento não está entrando na rotina | travessão em texto exibido | menos da metade dos links emitidos volta: o instrumento não está entrando na rotina |
| `src/lib/relatorios/leituras-saude.ts:25` | a leitura diária do semáforo começou a rodar — ainda não há base pra comparar | jargão interno (semáforo) + travessão em texto exibido | a leitura diária da situação começou a rodar: ainda não há base pra comparar |
| `src/lib/relatorios/leituras-saude.ts:41` | risco é o degrau mais alto do semáforo — sinal aceso pedindo ação | jargão interno (semáforo) + travessão em texto exibido | risco é o sinal mais grave: aceso, pede ação na hora |
| `src/lib/relatorios/leituras-saude.ts:53` | porque: "atenção é o degrau antes do risco — agir aqui é barato | travessão em texto exibido | porque: "atenção é o degrau antes do risco: agir aqui é barato |
| `src/lib/relatorios/leituras-saude.ts:91` | porque: "nenhum sinal aceso no semáforo | jargão interno (semáforo) | porque: "nenhum sinal aceso |
| `src/lib/relatorios/leituras-saude.ts:92` | intervencao: "siga a rotina — a régua avisa quando algo acender | travessão em texto exibido | intervencao: "siga a rotina: a régua avisa quando algo acender |
| `src/lib/relatorios/leituras.ts:44` | intervencao: "siga a rotina — a seção avisa quando algo sair do lugar | travessão em texto exibido | intervencao: "siga a rotina: a seção avisa quando algo sair do lugar |
| `tests/digest-semanal.test.ts:399` | expect(r.pulado).toBe("quinzenal — último envio há menos de 14 dias") | travessão em texto exibido | expect(r.pulado).toBe("quinzenal: último envio há menos de 14 dias") |
| `tests/e2e/app/materiais-painel.spec.ts:145` | .getByText("janela não aberta") | jargão interno (janela) | .getByText("ainda não disponível") |
| `tests/e2e/demo/jovem-jornada.spec.ts:450` | cardForaDaJanela.getByText("janela não aberta") | jargão interno (janela) | cardForaDaJanela.getByText("ainda não disponível") |
| `tests/importar-duplas.test.ts:360` | expect(semTurma.motivo).toContain("informe a coluna turma") | copy | expect(semTurma.motivo).toContain("Informe a coluna turma") |

## Encontrados e não corrigidos (com motivo)

| arquivo:linha | texto atual | situação |
|---|---|---|
| `src/lib/actions-jovem.ts:205` | Conta um pouco mais — entre 10 e 1.000 caracteres. | superfície jovem → ws29 |
| `src/components/jovem-equipe-wa.tsx:44,90` | Escolha com quem conversar no WhatsApp — a mensagem já sai… / A equipe ainda não tem WhatsApp cadastrado — registre sua dúvida… | superfície jovem → ws29 |
| `src/components/jovem-retroativo-dialog.tsx:124` | …oficial ou o encontro de encerramento — esse quem registra é o… | superfície jovem → ws29 |
| `src/lib/relatorios/digest.ts:280,286,319` | Digest semanal — ${faixa} / Semana de <b>${faixa}</b> — o panorama… / <li><b>${nome}</b> — ${motivo}</li> | e-mail (canal) → ws31 |
| `src/lib/ia/tools.ts` + prompts/`describe()` | descrições de tools da Liza com "estação", "eixo", "—" | entrada de LLM, não copy de UI; há assertiva exata em `ia-confirmacao.test.ts` → ws31 |
| `src/lib/importar/match-semantico.ts:116` | 0 a 100 — 70+ só quando a escolha é clara | `.describe()` de schema pro modelo, não renderiza em tela |
| `src/lib/documentos/texto.ts:70,77,177` | 5.2. Desde já, o VOLUNTÁRIO se compromete… / Anexo I — LEI Nº 9.608… | termo jurídico verbatim (voluntariado + Lei 9.608); não se edita lei citada |
| `src/lib/demo/data.ts` (~80 ocorrências) | resumos de registro, bios, motivações, observações de evento | conteúdo simulado como escrito por usuários; registro real de mentor pode conter travessão — a regra é da interface |
| placeholders `"—"` (registros-painel, roda-comparada, perfil-form, registros-filtros, queries-cronogramas…) | `"—"` como valor vazio | convenção de célula vazia coberta por testes (`forms-schema`, `registros-agrupar`) — não é prosa |
| `src/lib/resumo-acesso.ts:35,41` | [resumo_acessos] … — ip_hash da auditoria vai nulo | `console.error`/log de servidor, não exibido |
| `src/app/(app)/ia/page.tsx` + `ia-evals.tsx` | "rubrica", "casos × modelos × repetições", "Na fila → rodando" | página técnica de avaliação da IA (só coordenação); vocabulário é o do domínio — sem problema claro |
| comentários/JSDoc em geral | `/** saída da RPC — espelha os campos…` | não é texto exibido; convenção não se aplica |

## Verificação

```text
pnpm exec next typegen && npx tsc --noEmit   ✓ limpo
npx eslint src/                              ✓ 0 erros (94 warnings preexistentes de Button)
pnpm test                                    ✓ 156 arquivos · 2545 testes
pnpm guard                                   ✓ 10/10
```

Testes atualizados por renome de texto visível (sem mudança de
comportamento): `tests/digest-semanal.test.ts`, `tests/importar-duplas.test.ts`,
`tests/e2e/app/materiais-painel.spec.ts`, `tests/e2e/demo/jovem-jornada.spec.ts`.
Sem alteração de rota ou fluxo — e2e local não se aplica
(`docs/convencoes/ci-e2e.md`).
