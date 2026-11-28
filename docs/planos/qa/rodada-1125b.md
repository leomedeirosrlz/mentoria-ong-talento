# Rodada 1125b — recon e issues

Base: worktree `recon/rodada-1125b` em `395e1cb7` (igual a `origin/staging` no início do brief; staging depois avançou para commits como `67301c20`/`f995aede`). Prints em `/tmp/opencode/recon-1125b/`: capturas existentes do demo local da branch em 390×844/1440×900 (e 320 onde indicado), copiadas para a pasta de evidência. A captura automatizada diretamente em `staging.realiza.vc` foi bloqueada pela confirmação de ferramenta deste ambiente; onde só staging/produção podia provar o fato, marco **não reproduzi**. Skills usadas: `ux-heuristics`/`mobile-design`/`better-layout`/`better-ui`/`interaction-design` nos achados visuais 2, 15, 17, 20–22; `ux-accessibility-audit`/`better-accessibility` em 8 e 20; `better-writing` em 1, 7, 18–19; `supabase-postgres-best-practices` em 6, 12, 25; `webapp-testing`/`playwright-skill` na tentativa de evidência visual.

Dedupe com `qa-1125.md`/`auditoria-1125.md` e comparação com `main`: a branch da rodada nasceu de `origin/main`; os fixes de copy/QA/selos estavam só em staging. Assim, a maior parte dos achados é comportamento pré-existente ou lacuna de produto; o caso claro de correção tentada nesta rodada que continua errada é o layout dos selos (item 2). O vocabulário do combinado não é regressão, como detalhado no fim.

## Tabela

| ID | área · papel | tipo | sev. | esf. | depende de | resumo/veredito |
|---|---|---|---|---|---|---|
| 1 | combinado · ambos | design | P2 | S | nenhum | Não é regressão: “O combinado” como documento é decisão 020/025; rotas jovem/staff compartilham a pipeline (`jovem/combinado/page.tsx:53-60`, `duplas/[id]/combinado/page.tsx:47-54`). Residual: colide com “Meus combinados” de tarefa e com a regra da Liza. Prints `390-mentorado-combinado-copy.png` e `1440-mentorado-combinado-copy.png`. |
| 2 | perfil · jovem | regressão | P1 | M | nenhum | Selos caem no fluxo à esquerda no mobile, não top-right; tentativas `d8c3ee09`/`3bf80466`/`359e9158`. |
| 3 | apoio · jovem | design | P3 | S | nenhum | Entrada já está na home (`jovem/page.tsx:766`) e respostas viram pendência (`pendencias-jovem.ts:506-529`); falta estado/resumo sem mover a lista dona de `?c=` do perfil (`perfil/page.tsx:330-347`). |
| 4 | pessoas · ambos | design | P2 | M | nenhum | Jovem usa grade plana/facetas (`jovem-diretorio.tsx:389-418`); staff agrupa por papel (`pessoas-listas.tsx:1533-1589`). Padronização exige componente/modelo comum, não só copy. Prints `390-mentorado-pessoas.png`, `390-mentor-pessoas.png`. |
| 5 | pessoas · staff | bug | P2 | S | nenhum | DPP/especialista repetem: categoria (`pessoas-listas.tsx:1206-1241`) e trilha (`:1316-1373`). Pedido viável: uma linha só com “Especialistas” antes de “Mentores DPP”; perda principal é o recorte rápido de trilha da coordenação. |
| 6 | Liza/BI · coord | lacuna | P2 | L | RPC+RLS | Não existe resposta demográfica. Hoje tools usam client da sessão/RLS e auditam (`ia/tools.ts:1-19`); dados sensíveis estão coord-only (`docs/lgpd/inventario-dados.md:52-65`). Decisão já tomada; implementar tool/testes com minimização/log. |
| 7 | encontros · ambos | design | P2 | M | RPC | `agendado` = futuro combinado; `realizado` = fato confirmado/registrado; “confirmar” não é status e hoje significa tanto confirmar agendamento quanto “Aconteceu”. Enum em `supabase/migrations/0001_init.sql:6`. Retroativo do jovem antes do mentor é by design: nasce realizado e o registro do mentor segue devido (`src/lib/actions-jovem.ts:320-323`). |
| 8 | respostas · jovem/público | bug | P1 | S | nenhum | Sucesso de instrumento/avaliação manda fechar a página em vez de dar saída de volta. |
| 9 | PDM · jovem | lacuna | P2 | S | RPC | Documento vivo é editável pela dupla viva; imutável é a resposta-formulário (`/f/[token]/page.tsx:115-127`). Falta explicar essa diferença no ponto de reabrir. |
| 10 | PDM · ambos | bug | P1 | M | RPC | Todo gesto espera server action + RPC + refresh inteiro; sem otimismo nem animação de reorder. |
| 11 | PDM · ambos | bug | P2 | M | RPC | Não há seed oculto; projeção dos instrumentos semeia o doc. Como dedupe é por slot e não por título, meta manual + projetada pode duplicar. Origem já aparece como “vinda do instrumento” (`pdm-arvore.tsx:67-71`). |
| 12 | PDM/jornada · jovem | bug | P1 | M | RPC+migration | Auto-cura pode remintar PDM “mudo” quando resposta ficou órfã/na dupla antiga; gatilho real não reproduzi. |
| 13 | PDM · jovem | design | P2 | M | nenhum | Alvo já decidido: um único documento vivo. Reusar peças/árvore do `PdmDupla` no fluxo inicial, sem criar artefato paralelo nem perder a captura guiada. |
| 14 | PDM · ambos | design | P2 | M | RPC | Já é uma fonte (`PdmDupla` nos dois lados); falta ligar item projetado à resposta de origem e apresentar o PDM na estante como documento, não só instrumento a preencher. |
| 15 | ficha dupla · mentor | bug | P1 | M | nenhum | “Mais” concentra até 9 ações e esconde “Pedir apoio”; alinhamento quebra no wrap. |
| 16 | ficha dupla · mentor | bug | P3 | S | nenhum | Não confirmado: “Ver/Ler combinado” tem href e rota vivos (`acordos-central.tsx:129`); ver falso positivo. |
| 17 | ficha dupla · mentor | design | P2 | S | nenhum | Um único `h2` cobre plano, roteiros, ajuste de guia e intervenções; blocos entram só com `mt-3` e rótulos `p` (`acordos-central.tsx:95-234`). |
| 18 | remarcar · ambos | bug | P2 | M | RPC | Motivo é exigido só quando a data muda; mentor usa preset (`escritas.ts:146-163`), jovem texto livre (`0072_agenda_livre_dpp.sql:239-246`). Rows legadas `remarcado/cancelado` criam assimetria. Choque confirmar plano × “Próximos” segue aberto. |
| 19 | plano em dia · ambos | design | P3 | S | nenhum | Frase literal não existe; projeção `cabem X dos Y até encerramento` (`plano-em-dia.ts:700-705`, `plano-em-dia-card.tsx:182-190`) pode parecer promessa se o ritmo não vier junto. |
| 20 | tipografia · ambos | bug | P2 | S | nenhum | Texto funcional a 10px em slots/motivos (`seletor-dia-hora.tsx:624`, `solicitacao-negociacao.tsx:271,279`); 11px em bottom-nav é padrão herdado (`app-shell.tsx:339,375`, `jovem-shell.tsx:266,290`). Print `390-agenda-tipografia-slots.png`. |
| 21 | home · jovem | design | P2 | M | nenhum | Home empilha ~12 blocos textuais (`jovem/page.tsx:687-1208`); manter núcleo “agora”, encolher contatos/consulta e transformar parte em visual/abas. Print `390-mentorado-home-densidade.png`. |
| 22 | navegação · ambos | design | P2 | M | nenhum | Mentor tem avatar→perfil no topo (`app-shell.tsx:231-253`); jovem tem nome+Sair e nenhum avatar (`jovem-shell.tsx:128-153`). Sheet do jovem também não tem bloco de perfil (`:314-346`). |
| 23 | ficha dupla · jovem | lacuna | P2 | M | RPC+RLS | Decisão já tomada: tela própria read-only, adaptada, não a ficha de staff com outro rótulo. Recorte e exclusões na seção de decisões. |
| 24 | PDM · mentor/jovem | lacuna | P2 | M | nenhum | Decisão já tomada: um único PDM/documento vivo com lentes por papel; a view gostada é referência de qualidade, não produto paralelo. |
| 25 | retroativo · mentor/jovem | bug | P1 | M | RPC+migration | Jovem tem guards de data oficial/edição; mentor pode adiantar jornada com realizado irreversível. |

## Fichas P1

### 2 — Selos fora do top-right no mobile
Sintoma: no 390×844 os selos aparecem numa linha própria, à esquerda/centro, depois da foto; não na quina superior direita. Repro: demo mentorado → `/jovem/perfil`; prints `390-mentorado-perfil-selos.png` e `1440-mentorado-perfil.png`.
Evidência: o pai é `flex flex-wrap ... justify-start` em `src/app/(jovem)/jovem/perfil/page.tsx:202`; o grupo só ganha âncora em `sm` (`sm:ml-auto`) em `src/app/(jovem)/jovem/perfil/vitrine-selos.tsx:47`; o comentário em `vitrine-selos.tsx:40-42` documenta o comportamento errado como intenção.
Causa provável: correção anterior tratou wrap/overflow, mas não criou âncora absoluta mobile. Correção: tornar o bloco de identidade `relative` e posicionar o grupo `absolute end-4 top-4` abaixo de `sm`, mantendo o fluxo atual em `sm+`; limitar largura/quantidade (3 selos + lápis) e reservar espaço superior só quando houver selos. Em 320 não colide com nome porque o nome está fora da linha; não colide com “Remover foto” porque ele permanece no fluxo junto à foto. Risco: alterar a promessa visual “ao lado da foto”; cobrir 320/390/1440 e reduced-motion.

### 8 — Resposta terminal sem saída
Sintoma: após enviar instrumento/avaliação, a tela diz “Pode fechar esta página”; não há “voltar”/“ir para minha página”. Repro: abrir `/f/<token>` ou `/avaliar/<token>`, enviar resposta. Não reproduzi em staging por bloqueio da automação; o código é determinístico.
Evidência: `src/components/instrumentos/flow.tsx:301-316` e `src/components/avaliacao-encontro-form.tsx:131-134`. Contraste: documentos internos já têm voltar (`src/components/roteiro-doc.tsx:24-35`; combinado em `src/app/(jovem)/jovem/combinado/page.tsx:59`).
Causa: sucesso foi desenhado para link público anônimo e depois reutilizado por usuários logados. Correção: estado terminal único com ação principal contextual — autenticado mentorado: “Voltar para minha página”; autenticado staff: “Voltar”; público anônimo: manter copy honesta, mas sem fingir ação. Aplicar a PDM, visão/metas/roda, avaliação/feedback; combinado/roteiro já têm saída. Risco: baixo; cuidar para não vazar destino interno em token público.

### 10 — PDM lento e sem continuidade visual
Sintoma: marcar meta ou descer prioridade espera a resposta do servidor e a página inteira atualizar; a lista “pula”. Repro: abrir PDM completo, concluir meta ou usar ⋮ → Descer. Não reproduzi o tempo em staging; a estrutura serial está provada. Print do documento: `390-mentorado-pdm-doc.png`.
Evidência: `src/components/pdm-dupla.tsx:56-60` declara “sem estado otimista”; `executar` aguarda action e chama `router.refresh()` em `:110-131`; reorder manda o nível inteiro em `:162-176`; actions/RPC em `src/lib/actions-pdm.ts:123-125`.
Causa: RPC como fonte da verdade foi implementada sem reconciliação local. Correção: mutation local/`useOptimistic` para status e ordem, reconciliação pelo resultado/refresh em background, rollback em erro; animar reorder com FLIP só transform/opacity e `prefers-reduced-motion` desligando deslocamento. Risco: médio; caps/permissões ficam no banco e erro precisa desfazer a lista local sem perder foco.

### 12 — “Refazer PDM” sem explicação / possível resposta órfã
Sintoma relatado: após logout/login apareceu nova pendência de PDM mesmo depois de respondido. Não reproduzi o logout nem inspecionei dado de produção; o caminho estrutural existe.
Evidência: `jovem_jornada` roda auto-cura em cada carga e só reconhece resposta com `dupla_id` da dupla atual; link órfão ou da dupla antiga gera novo pendente. A origem `auto` entra como `a_fazer` sem detalhe (“muda”), enquanto refazer decidido explica “resposta anterior segue salva” (`src/lib/jornada.ts:610-632`). Resposta em link órfão também não projeta no PDM porque a projeção exige `l.dupla_id` (migrations `0099`/`0109`, relatório estático).
Causa provável: emissão manual fora de contexto ou rematch. Correção: ao responder token órfão, vincular à dupla viva quando destinatário/mentorado casarem; auto-cura não deve remintar como pendência muda — ou adota a resposta válida, ou explica a nova rodada. Risco: médio/alto; exige migration/RPC e testes de rematch, token órfão e idempotência.

### 15 — “Mais” na ficha esconde ação crítica e quebra a barra
Sintoma: no mobile a ficha mostra primária ausente/variável e um “Mais” solto; pedir apoio, remarcar, especialista e gestões ficam atrás do mesmo menu. Print `390-mentor-ficha-mais.png`; 320 em `320-mentor-ficha.png`.
Repro: demo mentor DPP → `/duplas/de000000-0000-4000-8000-000000001537`. Evidência: barra em `src/app/(app)/duplas/[id]/page.tsx:1940-1948`; itens alimentados em `:1950-2016`; trigger genérico em `src/app/(app)/duplas/[id]/mais-menu.tsx:150-161`.
Causa: regra “uma primária + todo o resto no ⋯” levada ao extremo; menu não distingue segurança/rotina/gestão. Correção: barra com primária à esquerda e até duas secundárias contextuais à direita; tirar “Pedir apoio” do menu em dupla viva; `Mais` sempre como último item à direita, com grupos/separadores. Risco: voltar a poluir a linha; limitar por papel/estado e medir 320/390.

### 25 — Retroativo do mentor pode adiantar jornada irreversivelmente
Sintoma/cenário: mentor registra retroativo de passo cuja data oficial ainda não venceu; nasce `realizado`, trigger impede reversão e a jornada/instrumentos avançam. Não reproduzi em staging; o guard ausente está no código.
Evidência: action do mentor aceita qualquer data passada desde início da mentoria e grava `status:"realizado"`/`origem:"externo"` em `src/lib/actions.ts:3184-3297` (insert em `:3275-3284`); jovem tem guarda de passo oficial vencido e edição/desfazer só antes do registro em `src/lib/actions-jovem.ts:333-339` e migration `0208` citada.
Causa: caminho do mentor nasceu antes do guard do jovem e não herdou a régua. Correção: alinhar RPC/action do mentor à data oficial vencida ou tornar exceção explícita com confirmação e auditoria; nunca permitir antes do início nem depois de encerrada/pausada; definir janela e motivo obrigatório. Risco: médio; trilha especialista não tem `ciclo_eventos` e precisa de regra própria.

## Decisões que precisam do lead

`docs/planos/qa/decisoes-1125b.md` já fecha 6, 23 e o modelo de PDM; onde havia dúvida, estas linhas aplicam aquela decisão:

- **6/Liza BI — decidido:** coordenação/equipe pode perguntar com a própria sessão/RLS; mentor, mentorado e especialista seguem bloqueados, sem service role nem bypass. Implementação deve minimizar o que entra no contexto, registrar consulta e testar por papel. Trade-off: devolver linhas permitidas pela RLS melhora drill-down, mas aumenta o volume de PII que sai do banco; mesmo autorizado, `cor_raca`/menores pedem cautela jurídica e copy transparente.
- **23/ficha da dupla para jovem — decidido:** sim, mas tela própria “Minha dupla”, muito adaptada e read-only: mentor, encontros, combinados, o que fazer e PDM visível; nunca notas privadas, ações de staff, semáforo interno, observações do registro ou dados de terceiros. Trade-off: mais transparência e autonomia, ao custo de uma superfície/RPC de recorte nova.
- **24/PDM — decidido:** um único PDM/documento vivo com lentes por papel; a view que o usuário gostou é a referência. Não criar rota, registro ou view paralela. Reuso recomendado das peças de meta/árvore do `PdmDupla` no fluxo inicial, preservando a captura guiada do instrumento. Trade-off: refactor médio e testes de permissão/copy, em troca de uma só fonte de verdade.
- **25/retroativo — ainda aberto:** recomendo mentor e jovem poderem registrar, mas só passo vencido, dupla ativa, data entre início e hoje, motivo obrigatório após uma janela curta (sugiro 7 dias) e correção até o registro do mentor. Trade-off: menos fraude/métrica inflada versus mais fricção para recuperar dados legados.
- **22/navegação — ainda aberto:** recomendo padronizar o topo do jovem como o mentor (avatar → perfil) e manter “Perfil” no menu/nav por hábito; remover Sair do topo só se houver alternativa clara no sheet. Trade-off: paridade visual versus um toque a mais para sair em conta de menor.

## Ondas sugeridas

1. **Wave UI rápida:** 1, 2, 8, 15, 17, 20 — independentes, sem migration; validar em 320/390/1440.
2. **Wave PDM:** 10, 11, 12, 13, 14 — primeiro modelo/dedupe/pendência, depois otimismo/animação e reuso de componentes.
3. **Wave encontros:** 7, 18, 25 — alinhar vocabulário, motivo e guards antes de mexer em retroativo; exige RPC/migration e e2e de estados.
4. **Wave navegação/pessoas/home:** 3, 4, 5, 21, 22 — reorganização de superfícies; pode paralelizar com PDM se houver cuidado com `pessoas-listas` compartilhado.
5. **Wave decisões/RLS:** 6, 23 — só após decisão do lead, spec e revisão LGPD/RLS.

## O que não é issue / não reproduzi

- **1 não é regressão:** o rename `aa249dcf` cobria pill/card/semana/Liza; o artefato segue nomeado “O combinado” por decisão das specs 020/025. As rotas do jovem e do mentor usam o mesmo documento (`src/app/(jovem)/jovem/combinado/page.tsx:53-60`, `src/app/(app)/duplas/[id]/combinado/page.tsx:47-54`) e o demo passa pela mesma pipeline. A colisão real é de vocabulário: “O combinado” (documento) × “Meus combinados” (tarefas); se o lead quiser renomear o documento, isso é escopo novo, não correção esquecida.
- **16 não é issue:** “Ver/Ler combinado” não está morto no caminho principal. O href `/duplas/[id]/combinado` é passado em `src/components/acordos-central.tsx:129` e a rota existe (`src/app/(app)/duplas/[id]/combinado/page.tsx:47-54`). Se houve clique sem efeito, faltou reproduzir qual botão/estado; pode ter sido navegação por âncora/aba, não link morto.
- **9 parcialmente falso positivo:** o PDM documento é editável por mentor/mentorado da dupla viva; a resposta original do instrumento é snapshot imutável por desenho. O problema real é comunicação/UX, não impossibilidade de editar o plano.
- **11 seed oculto falso positivo:** não há seed de produção inserindo metas; as metas “inesperadas” vêm da projeção das respostas Visão/Metas/PDM no documento. Duplicação só vira issue quando a mesma meta entra manualmente ou em dois slots sem dedupe.
- **19 literal não reproduzi:** não existe “Dá pra fazer 10 encontros até 31 de dezembro” no código. Existe projeção dinâmica “cabem X dos Y até o encerramento”; a data vem do cronograma da turma.
- **7 “jovem antes do mentor” não é bug:** o retroativo do jovem nasce realizado justamente para destravar avaliação; o registro do mentor segue devido (`src/lib/actions-jovem.ts:320-323`). A issue é semântica/guarda, não a existência do gesto.
- **12 não reproduzi em runtime:** faltou inspecionar o link/resposta da dupla real e executar logout/login em staging. Não inventei o gatilho; o caminho órfão/rematch está evidenciado estaticamente.
- **10 não medi em ms:** automação contra staging foi bloqueada; a lentidão é inferida da sequência serial action→RPC→refresh, não de medição.
