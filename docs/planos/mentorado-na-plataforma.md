# Mentorado na plataforma — plano de refactor

Fonte: `_contexto.md` § mentorado na plataforma (reunião Leo + alinhamento Thiago, 08–09/out/2026) + 4 audits de implementação + 4 críticas de decisão + rodada 3 (bug-hunt de integração). Cada decisão lista o que muda, regressões (file:line auditado) e mitigação.

## Arquitetura-síntese

O redesign corta o agregado monolítico em fatias: **solicitação de especialista = pedido de sessão** (motivo+slot, por jovem ou terceiros), **dupla especialista = relação** (nasce no 1º aceite do par), **contra-proposta = thread append-only** na solicitação, **budget = 5 sessões por par por ciclo**, **DPP = edição livre com notificação** (sem portão de aceite — ambos escrevem `encontros`, o outro é avisado e pode reverter).

## D1 — Mentorado com login real

**Migration (3 fases — `ALTER TYPE ADD VALUE` não pode ser referenciado na mesma transaction, PG `55P04`):**

- **A — hardening sem enum:** reescrever auto-grants pra listas explícitas de papel (exclusão por omissão). Inventário completo: `profiles_select` (`0001:142`), `mentor_profiles_select` (`0001:150`), `ciclo_eventos_select` (`0001:260`), `materiais_select` (`0004:55` — mais fraca que comunicados, nem `is not null` tem) + storage mirror (`0010:22-35`), `cronogramas_select` (`0061:49`), `especialista_eventos_select` (`0027:46`), `comunicados_select` (`0019:60`), `documento_templates_select` (`0033:68` `using(true)` — inofensivo, aceitar), `notificacoes_insert` ramo `pedido_apoio` (`0041:105-108` — **manter: jovem ganha "pedir ajuda" de graça**), `assinaturas_select` (`0033:73-77` — precisa de ramo `mentorado_id` novo, não só hardening).
- **B — enum + vínculo:** `alter type app_role add value 'mentorado'` (+`if not exists`, irreversível) + `mentorados.profile_id uuid unique references profiles(id)` + `my_mentorado_id()` (`security definer ... and ativo` — o `and ativo` precisa estar NO helper, não só nas policies).
- **C — policies novas** referenciando `'mentorado'` + views + RPCs.

**Decisões estruturais (arbitradas):**
- **`duplas.mentorado_id` continua → `mentorados.id`** (sólida): `rematch_dupla`, `duplas_mentorado_ativa_key`, `solicitacao_integridade`, `assinaturas`, `formulario_links`, `pessoa_notas` dependem — e conceitualmente `mentorados.id` = "registro de participação", sobrevive a transição de papel.
- **Enum único:** `profile_roles` reutiliza `app_role` — NÃO criar `app_role_planejado` como o `der-planejado.dbml:453` sugere (dois enums divergindo pra sempre).
- **`my_mentorado_id()` é resolvedor de identidade** (imune ao -105); `my_role()` é resolvedor de papel. `profiles.role` segue fonte de `my_role()` até o flip do -105 — dual-write nas actions, nunca no resolver.
- **Role-gate obrigatório:** todo ramo `or d.mentorado_id = my_mentorado_id()` precisa de `my_role()='mentorado' and` — senão ex-mentorado-vira-mentor lê a dupla histórica (incl. encontros criados depois da transição) pra sempre. Vínculo é permanente; a revogação vem do papel.
- **Link explícito é o primário:** coord vincula `profile↔mentorado` no cadastro/convite (allowlist já exige row em `profiles`). `handle_new_user` auto-match por e-mail só como backstop `count=1 and email is not null` — `mentorados.email` é nullable, não-unique, e pode ser o e-mail do responsável (irmãos no programa compartilhariam).
- **Fonte de verdade por campo (o buraco das 17 colunas duplicadas):** `profiles` = canônico pra pessoa/contato (`nome, nome_social, email, whatsapp, avatar_path, cidade, uf, interesses, data_nascimento, genero, cor_raca, motivacao, dados_civis`); `mentorados` = registro do programa (`ong_origem, notas, objetivos, escolaridade, responsavel, disponibilidade, documento_path, form_bruto`). Leituras `coalesce(profile, mentorado)` nas views durante a transição. Sem isso, "mentorado vira mentor" forca a identidade. **Avatar = `profiles.avatar_path`** (self-upload já funciona); `mentorados.avatar_path` vira legado do intake.

**Regressões auditadas — superfícies (o plano original subestimava):**
- `getMinhasDuplas` filtra no app (`queries.ts:322` `.or('mentor_id.eq,supervisor_id.eq')`) — só policy nova não basta
- `/pessoas` gate é só `!me.role` (`pessoas/page.tsx:30`) — jovem entraria pela URL e veria diretório completo
- `DUPLA_SELECT` embed `mentorados(${MENTORADO_COLS_PUBLICAS})` (`queries.ts:53-54,257`) vaza `notas`/`documento_path` do próprio jovem — **projeção própria obrigatória**
- `TermoBanner`: `getMinhaAssinaturaTermo` filtra `termo-voluntario`+`profile_id` — banner eterno errado
- `setPessoaRole` (`actions.ts:785-790`) checa `mentor_id`/`supervisor_id` — precisa de check `duplas.mentorado_id`
- Via reversa: `profiles_select` expõe **card de todos os menores pra todos os adultos** — apertar pra excluir `role='mentorado'` de não-relacionados (mentor/sup da dupla lê via `mentorados`)
- **`profiles_select` pro jovem não pode ser "self apenas"** (achado rodada 3): o embed `DUPLA_SELECT` traz `mentor:profiles(...)` — escopo certo = `self` + profiles dos adultos das próprias duplas (`mentor_id`/`supervisor_id` onde `duplas.mentorado_id = my_mentorado_id()`) + `role='coordenacao'` (contato sempre alcançável) + catálogo de especialistas via view definer (não base table)
- `salvarOnboarding`/`meus_dados_*` leem/escrevem `profiles` — pela fonte-de-verdade arbitrada (`profiles` canônico pra pessoa) as RPCs estão certas, **mas exigem backfill `mentorados→profiles`** na transição, senão o prefill do `termo-mentorando` sai vazio pra quem já tem ficha (`meus_dados_civis` `0046:68-70` lê `profiles.dados_civis`; os dados civis do jovem moram em `mentorados.dados_civis`/`responsavel` `0046:24-28`)
- **`assinar_termo` hardcoda `'termo-voluntario'`** (`0046:169-170`) — o fluxo logado do jovem assinando `termo-mentorando` precisa de variante; o caminho por token `assinar_com_token` já trata o ramo mentorado (`0046:231-238`) — o "híbrido" do D2 resolve pela porta do token
- **`disponibilidade` do jovem não tem caminho de escrita** — `mentorados.disponibilidade` é coord-only (`0038:9-12`); pro jovem propor slot informado precisa de RPC self ou ramo próprio
- **`mentorados_select` precisa de ramo `id = my_mentorado_id()`** pro self-read (a policy hoje é coord/staff, `0023:43-55`)
- **`assinatura_reflete_termo_ok` retorna cedo com `profile_id is null`** (`0052:20-21`) — "termo_ok do jovem" é conceito novo que nada carimba; decidir se o carimbo mora em `mentorados` ou se o trigger ganha o branch mentorado
- **`profiles_self_columns`** (`0054:43-72`): e-mail é campo protegido — o jovem não edita o próprio e-mail (troca fica coord-only ou RPC nova; decidir)
- **E-mail é pré-requisito estrutural do login** (achado rodada 3): `profiles_email_ci_key` (`0059:75-76`) — dois irmãos cujo único e-mail é o do responsável **não podem ter dois profiles**; o segundo `createPessoa` toma 23505. Intake precisa do e-mail do JOVEM (não do responsável) — decisão de ops antes do rollout, não depois. Mesmo problema pra `whatsapp`: `mentorados_whatsapp_key`/`profiles_whatsapp_key` são índices **por tabela** (`0022:5-11`) — backfill do contato pra `profiles` pode colidir com número já cadastrado
- Demo: `personas: Record<AppRole>` força compile error até persona+dataset+ramos (~30 queries demo) existirem — bom, mas custo real
- e2e: persona nova na suite + `limparViaServiceRole` segue válido

**De graça:** `notificacoes` self select/update; `pedido_apoio` insert já abre pedido pra coord/sup; `stamp_solicitacao_autor` carimba `my_profile_id()`; storage `avatares` pasta própria; presenças/formação n/a.

## D2 — /jovem: shell + home + agenda + materiais + combinados

**Muda:** shell próprio (não nav filtrada — `app-shell.tsx`/`(home)/page.tsx`/`OnboardingFlow`/`TermoBanner`/`getMinhasDuplas` assumem staff/mentor; shell separado concentra o gate no route group e permite home própria: agenda + combinados + avaliações pendentes + pedidos de especialista).

**Combinados = `encaminhamentos` já existe** (`0001:95-104`): delta = ramo select pro jovem + **RPC `marcar_combinado(id, status)`** definer — valida vínculo + `responsavel='mentorado'` + whitelist de transição `pendente↔feito` (nunca `atrasado` — é do sistema). Column-grant não resolve (todos compartilham `authenticated`); trigger ficaria cego a regras de transição. INSERT continua mentor/coord.

**Decisões arbitradas:**
- `registros`/`encontro_notas`/`interacoes` **fora** — instrumento do mentor (default-deny: basta nunca adicionar o ramo). Adendo retroativo: `encaminhamentos.descricao` (texto livre escrito pra staff) e `encontros.motivo_reagendamento` ficam visíveis — projeção colunar na view do jovem (numero/data_hora/status/link/realizado_em), não `encontros(*)`.
- `assinaturas`/`forms`: **híbrido** — token funciona logado ou não; notificação in-app abre o link tokenizado. Com hardening: quando autenticado e `my_mentorado_id()`/`my_profile_id()` diverge de `dest_*` do link → recusar ("este link é de outra pessoa"); persistir `respondido_por_profile_id` quando autenticado (auditoria resposta-por-sessão vs por-portador).
- Audiência `'todos'`: **mantida ampla** (decisão do usuário — aceita exposição retroativa). Mitigação exigida: **auditoria one-off do conteúdo 'todos' em produção** (nomes de jovens nos corpos) antes do rollout — query no §verificação.
- Avatar do jovem: **iniciais na v1** — bucket `avatares` é CDN pública sem moderação, e a autorização do responsável (rascunho jurídico, `texto.ts:101-126`) não cobre uso de imagem. Foto só quando houver cláusula + aprovação da coord.
- LGPD art. 18: `dificuldade`/`reflexoes` são dados do titular — pedido de acesso do responsável exige processo coord-mediado (precedente `/api/export`). Uma linha no plano/ops.
- hrefs de notificação pro jovem precisam ser `/jovem/…` — CHECK aceita qualquer path, callers hardcodam rotas de staff.

## D3 — Agendamento: edição livre com notificação (DPP) / proposta-aceite (especialista)

**DECIDIDO (modelo do usuário, não o simétrico nem o assimétrico):** no DPP, **qualquer lado marca ou altera** o encontro; o outro recebe notificação e pode ajustar de volta. Sem portão de aceite — a brecha retroativa (`registrarEncontroRetroativo`, ~25% dos encontros são `origem='externo'` no demo) desaparece porque não há portão pra contornar. Retroativo segue como está, sem confirmação do jovem.

**Consequências:**
- Jovem ganha **write em `encontros`** da própria dupla — **mas só via RPC definer, nunca policy branch** (achado rodada 3, crítico): um ramo `d.mentorado_id = my_mentorado_id()` em `encontros_mentor_insert` daria (a) write na dupla **especialista** também — sem `trilha='dpp'` no predicado, bypassa aceite+budget inteiros; (b) TODAS as colunas — `status='realizado'` born-externo (fake → `feitos++`, marcos disparam), `duracao_min`, `origem='externo'`. Policy não filtra coluna nem status. RPC `agendar_encontro_mentorado(dupla_id, numero, data_hora, link, motivo_reagendamento?)` definer: valida vínculo + `d.trilha='dpp'` + `status in ('agendado')` no WHERE do update + `data_hora > now()`. **`motivo_reagendamento` entra no whitelist** (decisão: "ja era pra ser assim") — edição livre sem canal de "porquê" vira ping-pong mudo; a notificação carrega o diff + o motivo. `realizado` fica com o mentor. Mesmo padrão `marcar_combinado`/`aceitar_solicitacao`.
- **Jovem marca `nao_aconteceu` — DPP e especialista** (DECISÃO nova, resolve o "especialista fantasma" e dá voz de disputa ao jovem): RPC `marcar_nao_aconteceu_mentorado` definer — valida vínculo + `status='agendado'` + data passada. Flexível e sem burocracia, **mas auditável**: notificação ao outro lado carimba o ator ("o jovem marcou como não realizado") e a trilha de notificações é o registro. Anti-abuso natural: `realizado` é irreversível por não-coord (`guard_encontro_status`) — se o especialista/mentor já marcou, o jovem não desmarca; a disputa de "marcou realizado no que não aconteceu" segue pelo canal da avaliação (1★ + `pedir_apoio`). Na trilha especialista, o `nao_aconteceu` do jovem dispara o refund de budget — sem fila da coord nem lazy-refund.
- `realizado` **não** é do jovem — segue com o mentor (é o registro dele); o jovem contesta via avaliação/`pedir_apoio`, nunca escrevendo `realizado` (o RPC não oferece o campo).
- **Semântica "edição livre" = upsert:** `insert ... on conflict (dupla_id,numero) do update` — os dois lados agendando o mesmo nº vira merge, não 23505 com copy errada ("Já existe um cadastro com esses dados" `utils.ts:131`). O `do update` re-checa `status='agendado'` — remarcação não ressuscita `nao_aconteceu` recém-marcado.
- **Cancelamento = DELETE do próprio `agendado`.** `'cancelado'`/`'remarcado'` são valores-fantasma do enum — nada os escreve hoje (`agendarEncontro` sempre grava `'agendado'` :2077). Row `agendado` nunca tem registro/cascata (select exige `realizado` desde 0053:641-652) → `delete where created_by=my_profile_id() and status='agendado'` é seguro e **preserva o nº** (cancelado queimaria o nº oficial do DPP). `cancelado` fica reservado pra trilha especialista — onde é o veículo do refund auditável via RPC.
- **Zero notificação em agendamento hoje** — vira obrigatório: tipos novos `encontro_marcado`/`encontro_alterado`/`encontro_desfeito` no CHECK (`0042:304-311`) + ramos na policy `notificacoes_insert` (`0041:99-141` — hoje só staff/especialista/coord são destinos válidos pra não-coord; mentor↔mentorado precisa de ramo novo) + trigger em `encontros` (não hook de action — cobre action+RPC+retroativo+PATCH direto).
- **Detalhes do trigger (achado rodada 3):** (a) atribuição pelo **ator corrente** `my_profile_id()`, NUNCA `created_by` — imutável por `guard_autoria` (0023:83-85); mentor editando encontro criado pelo jovem notificaria a direção errada; (b) `WHEN` correto — `salvarRegistro` grava `status='realizado'`+`duracao_min` na mesma update (:2308-16); o prompt de avaliação é `status→'realizado'` (insert born-realizado do retroativo dispara avaliação, não "marcado"); (c) dedup: trigger por-statement → 5 edições rápidas = 5 notificações — coalesce se existir não-lida de mesmo `(profile_id, tipo, href)`; (d) insert em `notificacoes` dentro do trigger roda sob RLS do caller → trigger `security definer` (precedente `0042:266-269`).
- **Histórico: `encontro_notas` NÃO serve** (correção factual — o plano errava): é row única mutável por `(dupla_id,numero)` (`0015:5-13`), `salvarNotaEncontro` sobrescreve e delete quando vazio (:2460-71), policy `for all` inclui DELETE, e é invisível pro jovem (0015:21-29). Misturar auditoria com plano de aula do mentor é errado. v1: diff na própria notificação; se auditoria virar requisito, `encontro_alteracoes` append-only dedicada.
- Conflito de overlap: checagem **warning** no DPP, mas a query de conflito tem que ser **definer** — o mentor DPP não lê os encontros da dupla especialista do mesmo jovem (RLS `encontros_select` 0001:181-189); client normal não enxerga a outra trilha. Checagem RLS-scoped é decorativa.
- Semáforo: sem mudança — encontro agendado conta como hoje.

**Guards que continuam valendo (critique):**
- `encontros` write: `encontros_mentor_insert`/`_update` (0047) **não morrem** — `salvarRegistro` (`actions.ts:2308-16`), `marcarNaoAconteceu`/`desfazerNaoAconteceu` (:2104,:2123) e `registrarEncontroRetroativo` (:2199) escrevem `encontros` por essas policies. O plano original dizia "morrem ou ficam coord-only" — **errado**: coord-only + actions que rejeitam coord (`:1994`,`:2150`,`:2235`) = ninguém escreve. Correto: policies do mentor seguem; o jovem escreve só via RPC definer; delete coord.
- `guard_encontro_identidade` trava `dupla_id`/`numero` p/ não-coord (0053:676-693); `guard_encontro_status` só barra SAÍDA de `realizado` (0043:23-25) — o RPC do jovem nunca toca esses campos.
- `marcarNaoAconteceu` não checa `eu.id`/`role` — o gate é 100% RLS + `.eq('status','agendado')` (:2091-2115) + data passada (:2098). Sem ramo de policy pro jovem ele não ganha isso por acidente (reforça o RPC-only acima).
- Guards por role nas actions precisam de ramo `my_role()='mentorado'` com erro de domínio (jovem chamando retroativo toma RLS cru hoje).
- `e2e`: spec "agendar encontro pela home" vira "jovem agenda também" — nova asserção.
- Demo: dataset de encontros precisa de `created_by` do jovem em alguns casos.

## D4 — Avaliação estrela do jovem

**Estrutura (sólida):** `avaliacoes_encontro` tabela dedicada — `formulario_respostas` é coord-only por tabela inteira (0036:86-99); RPC por token própria espelhando `assinatura_por_token` (grant `anon, authenticated`). Colunas: `dupla_id, encontro_id unique, estrelas 1-5, sentimento, avancei, temas[], comentario, pedir_apoio`.

**Visibilidade (corrigindo drift + buraco matemático):**
- **Especialista vê SÓ `estrelas`** das suas sessões (+ talvez `avancei`) — NÃO comentario/sentimento/temas/pedir_apoio. A justificativa do agregado DPP ("com 1 jovem, nota identifica") se aplica identicamente: comentário pro avaliado = autocensura + retaliação possível. A decisão original dizia "a estrela" — o plano tinha derivado pra "linhas". Form diz explicitamente ao jovem quem lê o quê.
- **DPP: RPC `avaliacao_media_dpp(dupla_id)` definer** retornando `{n, media, liberado}` — com dois reforços contra ataque por diferença (`estrela_k = k·média_k − (k−1)·média_{k-1}`): (a) **média quantizada no 0,5 mais próximo**; (b) **release em lotes** — libera em n≥3 e só atualiza a cada ≥3 avaliações novas (snapshot, não média corrente). Abaixo do limiar `{liberado:false, n}` com copy honesta "a média aparece quando houver ≥3 avaliações".
- **`avaliacao_visivel_mentor`: dono do toggle = O JOVEM** (por avaliação, idealmente — não flag global da dupla ligada pela coord). Com 1 votante, ligar = identificação plena — coerção estrutural se a coord liga a pedido do mentor.
- `pedir_apoio`: flag persiste na avaliação + notificação `apoio_jovem` coord+sup + **e-mail redundante** (`enviarEmailsIndividuais` existe — canal de segurança de menor não pode depender de alguém abrir o sino) + flag só-coord-limpa (molde `guard_registro_apoio` 0004:15-29) + contador na home da coord (molde `getAlertasRegistros`) + **botão standalone "Preciso de ajuda"** no shell (a policy já permite — `0041:105-108`) + SLA declarado ("1 dia útil") + copy pós-submit "a equipe foi avisada; se urgente, fale direto" + waLink.
- Disparo do prompt: **trigger em `encontros.status`→`realizado`** (cobre `salvarRegistro`, retroativo e PATCH direto) → notificação in-app + link `wa.me` pronto. Automação real de WhatsApp = integração separada. **Trigger pula quando `mentorado.profile_id` é null** — jovem sem login só recebe o link tokenizado via WhatsApp/coord; não quebra o insert de notificação. **Decidir se suprime em dupla `encerrada`** — `salvarRegistro`/retroativo já bloqueiam não-ativa, então `realizado` em encerrada só chega via escrita da coord; a avaliação histórica continua útil (presumo manter o prompt).
- **A avaliação é também o canal de disputa** — o prompt deve perguntar explicitamente "teve algum problema com este encontro?" (afordância, não só estrelas): é o caminho do jovem pra "o mentor marcou realizado no que não aconteceu" — já que `nao_aconteceu` do jovem só existe enquanto `agendado`, e `realizado` é irreversível pra ele.
- **Backfill não dispara trigger** — varrer histórico ou `created_at < deploy_ts` dispara notificações fantasmas. Supressão via `set_config('realiza.no_notify','on')` por sessão (precedente de GUC `realiza.*` em `0025`/`0043`/`0052`).
- **Três escalas que não se misturam** (achado rodada 3): `registros.avaliacao` (4-pt qualitativa do MENTOR, `0002:4`), `avaliacoes_encontro.estrelas` (1–5 do JOVEM, novo), `avaliacao_360` (forms engine). Nada migra entre elas e nenhum agregado pode cruzar. **`AvaliacaoJovem` já é nome tomado** — é o tipo da avaliação do mentor (`types.ts:8`, labels em `ciclo.ts:104-109`); a estrela do jovem precisa de outro nome (`AvaliacaoEncontro`) ou confusão garantida em UI/agregados.
- **`emails_enviados` é coord-only** (`0056:31-37`) + `tipo` CHECK só tem comunicado/material (`0056:10`) — o e-mail `apoio_jovem` disparado pela ação do jovem não pode ser logado por esse caminho: log via definer/RPC ou ramo novo.
- Semáforo: sinal separado `avaliacaoJovemPendente` — não dobrar com `registroPendente`.
- **Migração**: queries de produção obrigatórias antes (§verificação) — form "Avaliação Semanal - Mentores" mapeia `registros`, não a tabela nova. Migráveis: só `dest_mentorado_id` + `contexto.encontro`/data casando `realizado_em`.
- `der-planejado.dbml:500-507` desatualizado — alinhar antes da migration.

## D5 — Especialista jovem-iniciado (o refactor pesado)

**Guia valida o modelo:** "o Mentor DPP, **ou o próprio jovem**, quem identifica a necessidade" (`guia-especialista-pdf.txt:1245-1251`); fallback oficial = "Mentor DPP ou coordenação" (:348-350).

**Shape do pedido (resolvendo "duas máquinas bilaterais"):** TODA sessão especialista = uma `solicitacao_especialista` (motivo + slot proposto). Primeira = gate de demanda (payload rico: motivo, perfil do jovem); sessões 2-5 = slot-only, mesmo entity. `solicitacao_propostas` append-only = thread de contra-propostas. `encontros` só nasce no aceite — N solicitações → 1 dupla (perde `unique(dupla_id)` `0027:56`).

**Muda (auditado):**
- `dupla_dpp_id`→nullable; +`origem`, `motivo`, `slot_proposto`, `justificativa_recusa` (caixas de opção), estado com contra-proposta
- **`demanda` vira CHECK condicional** (`0027:52` é `not null check(10..1000)`): obrigatória só no pedido-gate (primeiro pedido do par / `origem='demanda'`); sessões 2-5 são slot-only. Backfill: rows existentes setam `origem='staff'`/`'legado'` + `turma` da `dupla_dpp_id` — demanda sempre presente nelas, passam no CHECK novo. E `solicitacao_integridade` trata o campo mutável novo (`motivo`/`slot_proposto` editáveis pelo autor — hoje `demanda` é congelada p/ não-coord `0029:30`)
- **`sol_insert` (`0028:51-62`) exige `exists(dupla_dpp_id)` ou coord** — o ramo jovem precisa ser explícito: `my_role()='mentorado' and mentorado_id = my_mentorado_id() and origem='jovem'` + `status='aberta' and especialista_id is null and dupla_id is null and respondida_em is null`. Sem ramo novo o insert morre na policy (o buraco do trigger ficaria latente — mas a intenção é nunca deixar passar, então os dois são corrigidos juntos)
- **`criarSolicitacao` dedup quebra em silêncio com NULL** — `.eq("dupla_dpp_id", ...)` (`actions-especialista.ts:83-91`) nunca casa em coluna NULL → dedup inexistente no modelo novo. Re-escopar pra "máx K pedidos abertos por jovem" + "1 aberto por par" (já decidido, mas o mecanismo muda — não é `.eq`, é count server-side)
- **A máquina de estados NÃO vai pra policy — vai pra RPCs definer** (decisão, rodada 3+): `sol_update` (`0053:548-578`) já hardcoda transições em USING+WITH CHECK; adicionar `aguardando_coord`/`contra_proposta`/`recusada`/`expirada` ali transforma a policy numa máquina de estados em SQL — ilegível e frágil. O padrão que o repo já usa (`realiza.sol_aceite` GUC) é o certo: **toda transição não-coord via RPC definer** (`aceitar`, `recusar`, `contra_propor`, `reconhecer` pela coord, `cancelar` pelo autor), cada uma validando `(ator, estado_atual → estado_novo, campos)` numa função testável; `sol_update` fica quase congelada — só o caminho flag-guardado (`realiza.sol_transicao='on'`, setado pela RPC) + cancelamento do autor. `cancelarSolicitacao` vira RPC também (`actions-especialista.ts:210-212` hoje só aceita `'aberta'` — pedido em negociação ficaria incancelável).
- Trigger `solicitacao_integridade` (`0029`): branch `dupla_dpp_id is null` — **e `mentorado_id`/`created_by` derivados server-side** (`my_mentorado_id()`/`my_profile_id()`) via RPC definer, NUNCA client-supplied (com NULL a comparação `mentorado_id <> (select …)` vira NULL e o `if` **passa em silêncio** — qualquer autenticado pede em nome de outro jovem via PostgREST; confirmado `0029:15-21`)
- **`aceitar_solicitacao` morre com `dupla_dpp_id` NULL hoje** (`0061:220-228`: deriva `turma` via join na dupla → zero rows → `'Solicitação sem dupla de origem'`). Na **mesma transaction** da coluna nullable precisam entrar: branch NULL do `solicitacao_integridade`, `aceitar_solicitacao` novo (turma via triagem da coord, não via DPP), drop de `solicitacoes_dupla_uk` (`0027:66-67`), `sol_update`/`sol_insert` reescritas, e fix do `.maybeSingle()` (abaixo) — é a migration de maior risco do refactor
- Turma de pedido sem DPP: `solicitacao.turma` setada na **triagem da coord** (régua: DPP ativa → `cronogramaVigente`; `importar-duplas.ts:419-429`) — `mentorados` não tem turma, jovem sem dupla não tem coorte
- **Pedido sem DPP exige ack da coord** — adulto de referência vira coordenação (dupla esp não tem supervisor; notificações do pedido/aceite/devolutiva vão pra coord)
- `unique` vaga → índices parciais: `(mentorado_id) where trilha='dpp'` + `(mentorado_id, mentor_id) where trilha='especialista'`; mesma lógica em `createDupla`, `rematch_dupla` (`0064:72-79` vaga por trilha), `importar-duplas.ts:393-399`, `duplas_mentorado_ativa_key` (`0061:129-131`), 3 dialogs (`Set<trilha>`→`Set<mentor_id>`). E `solicitacoes_status_idx` (`0027:68-69`, parcial em `status='aberta'`) repensar — com estados novos o índice de fila cobre `aguardando_coord`/`contra_proposta` também
- **Budget: 5 por PAR `(mentor_id, mentorado_id)` na mesma `turma`** — count cruza TODAS as duplas do par (barra reset por reengajamento), inclusive `remanejada_de` (`0063:8-16` — decidir se a contagem segue a LINHAGEM do rematch ou só o par; presumo par+turma, independente de linhagem); consome na aceitação; devolve em recusa/cancelamento/`nao_aconteceu` via **RPC de refund** (delete é coord-only, `numero` imutável — não pode ser delete). `encerrar_trilha_especialista` (`0037:192-243`) precisa refundar o que estava `agendado` + notificar o jovem quando não há DPP
- **Refund × número — a interação crítica (achado rodada 3):** `numero→passo` é mapping exato (`jornadaDaDupla` `ciclo.ts:1065-1078`; `registros/page.tsx:124-127` `tituloEsp.get(numero)`), `numero` imutável + `unique(dupla_id,numero)` + cap 5 app-level (`TRILHA_LEN.especialista=5` `ciclo.ts:26`). Se o refund devolve sessão sem devolver nº: `nao_aconteceu` no nº 3 queima o passo 3 pra sempre, próximo aceite vai pro nº 4, e um nº 6 sai da trilha — `completa`/`cicloCompleto` nunca true. **Fix: `numero` = ordinal de tentativa dentro da dupla (cap 16 já cabe); o passo do guia deriva do rank entre `realizado`**, não do `numero`. Reescreve `jornadaDaDupla` + o map de títulos
- **Especialista fantasma — resolvido pela decisão do `nao_aconteceu` do jovem** (D3): sessão aceita (`agendado`, budget consumido), especialista fura e nunca marca — o **jovem marca `nao_aconteceu`** via `marcar_nao_aconteceu_mentorado` (data passada + `status='agendado'`), o que dispara o refund. Auditável pela notificação ao especialista; abuso contido porque `realizado` é irreversível pra não-coord (quem chega primeiro "ganha" — e a disputa aparece na trilha de notificações pra coord)
- **Teto sugerido: 2 trilhas especialistas simultâneas por jovem** (crítico — sem isso, N×5+16 sessões é ilimitado e o jovem é o lado sem gatekeeper; a confirmar)
- **Conflito atômico no aceite — DOS DOIS LADOS, via RPC definer:** overlap `[data_hora, data_hora+duracao_min)` contra todos `encontros` `agendado`/`remarcado` (a) das duplas do especialista E (b) das duplas do mentorado — zero checagem de overlap existe hoje em todo o schema; o jovem é o recurso mais compartilhado. Advisory lock por `(mentor_id)` + re-check `exists` anti-zumbi. **Tem que ser definer**: o especialista não lê os encontros das outras duplas do jovem (RLS) — check via client normal é decorativo (o conflito DPP×esp do jovem é exatamente o que importa)
- `capacidade=1` upsert cego (`0053:611-613`) — vira config explícita; e `check_mentor_capacidade` poola todas as trilhas juntas (`0025:25-29` — dual-role com `capacidade=2` gasta tudo em DPP e **hoje já não aceita especialista**) — `capacidade` por-trilha ou UX explícita
- Devolutiva sem DPP: notifica jovem+coord, href cai pra ficha da trilha/`/jovem` (não `/duplas/null` → 404, `actions-encerramento.ts:313`); `solicitacoes_mural` ganha branch `created_by=my_profile_id()`
- `getSolicitacaoPorDupla` `.maybeSingle()` (`actions-encerramento.ts:277-282`) — com N sol→1 dupla o PostgREST retorna erro multi-row, `s` vira null e **o solicitante deixa de ser notificado da devolutiva em silêncio** (o `error` nem é checado). → lista + notificar todos os solicitantes
- **Pedido dirigido já vaza HOJE** (`sol_select` `0027:83` + view `0030:80`/`0037:280` expõem TODA `aberta` a qualquer `mentor_especialista` — filtro só client-side `demandas-especialista.tsx:30-34`): a `demanda` do jovem (contexto sensível) é legível via PostgREST por todos os especialistas. No redesign vira leak de dado de menor — correção obrigatória na policy+view: `and (especialista_desejado_id is null or especialista_desejado_id = my_profile_id())`. E decidir se `mentorado_nome` (`0037:267`) continua aberto no mural — nome de menor exposto a especialistas não-relacionados
- Dedup reescopado: "já aberta pra essa dupla" → **máx K pedidos abertos por jovem** (spam protection pro mural)
- **1 pedido aberto por par** — força cadência, simplifica `numero`
- Fim de jogo do ping-pong: **máx 2-3 rodadas** de contra-proposta → botão WhatsApp (estado "combinem por outro canal") + expiração lazy (sem `pg_cron`: `pendente && slot<=now()` vira expirada na leitura; `respondida_em` continua null em `expirada`-lazy — queries "sem resposta" seguem corretas)
- **Pedido pendente é invisível ao semáforo** — `saudadeDaDupla` não consome `solicitacoes`; especialista tem `esperado=feitos` (`ciclo.ts:785-786`). Pedido `aberta` pendente 10 dias é não-resposta do pool, não demora do jovem → superfície própria (badge no mural/`solicitacoes-coord-card.tsx`), NÃO `saudadeDaDupla` (que é sinal da DUPLA, não do PEDIDO)
- Pedido legado (staff pede em nome do jovem) **sem slot** — jovem completa no turno 2 ou especialista propõe na resposta. Escolher.
- Duração: dentro da whitelist 30-120 (não literalmente livre) — default 60 (fidelidade ao guia). **A whitelist vive só na action** (`actions.ts:2229`); `duracao_min` é `smallint` sem CHECK (`0001:72`) — a restrição precisa virar CHECK no banco (`in (30,45,60,90,120)` ou range) senão RPC/PATCH direto a burla

**Prazo: sinal mole, não removido.** `TrilhaPrazoBadge`/countdown/bloqueio morrem; o semáforo ganha input de estagnação no branch especialista (ativa 90d+ sem sessão nova → `atenção`, mesmo padrão `limbo` do DPP `ciclo.ts:862-883`). Justificativa: guia prescreve "contrato de até 3 meses" (:1273-1275); sem sinal, trilha zumbi segura vaga (`check_mentor_capacidade`), bloqueia reengajamento do par, e renderiza "Em dia" pra sempre (`esperado=feitos` `ciclo.ts:785-788`).

## D6 — Pessoas filtrada pra jovem

**Muda (DECIDIDO):** jovem vê especialistas + colegas da turma + mentor DPP + coordenação. WhatsApp/socials: **adultos visíveis por default; colegas = opt-in** (`contato_compartilhado` flag default false — **dono do toggle = o próprio jovem** via RPC self, é a privacidade dele; coord pode pré-setar no intake com consentimento do responsável). Civis/documentos nunca.

**Regressões (audit):** grant público de `mentorados` (0034:194-196) inclui `notas`/`documento_path` — **view `mentorados_turma`** projeção mínima `id, nome, nome_social, avatar_path, cidade, uf, interesses` + whatsapp `CASE WHEN contato_compartilhado` + `WHERE` coorte (mesma `turma`/`cronograma_id` via `my_mentorado_id()`); **sem coorte → só especialistas+coord**. Contato de adultos via view dedicada (não `profiles_contato` — ela devolve tudo pra coord). `DUPLA_SELECT` projeção própria. `getEspecialistas` variante segura. **Apertar `profiles_select`** — menores invisíveis pra adultos não-relacionados.

## Sequência proposta

1. **-105 fase aditiva** (`profile_roles` + dual-write, enum único `app_role`) — fundação D1+D5
2. **Auth mentorado** (migrations A→B→C + shell /jovem + home) — fundação de tudo
3. **Avaliação estrela** (D4) — valor alto, acoplamento médio
4. **Edição livre DPP** (D3) — write novo do jovem + notificações de agenda
5. **Especialista jovem-iniciado** (D5+D6) — o refactor pesado, depende de tudo
6. **Pessoas filtrada** (D6) — pode entrar em 2 ou 5

**A migration de maior risco é a do `dupla_dpp_id` nullable** — na mesma transaction: branch NULL do `solicitacao_integridade` (senão forja de `mentorado_id` abre no deploy), `aceitar_solicitacao` reescrito (morre com NULL hoje), drop de `solicitacoes_dupla_uk`, ramos novos de `sol_update`+`sol_insert`, fix do `.maybeSingle()` no encerramento, CHECK condicional de `demanda`. Não fatiar.

**Ordem de deploy (cada passo verde no e2e-preview antes do próximo — AGENTS.md exige migration no staging antes/junto do push e em prod antes do merge):**

A. Hardening aditivo sem enum (reversível por `create or replace policy`) — inventário completo em D1. Risco: esquecer papel existente corta acesso na hora — testar as 4 personas no staging.
B. Enum + vínculo (transação que NÃO usa o valor): `add value if not exists 'mentorado'` + `mentorados.profile_id` + `my_mentorado_id()` + grants. **Irreversível** — o valor fica no enum; rollback = feature-off (ninguém recebe o papel).
C. Policies/views/RPCs que referenciam `'mentorado'` + código. `database.types.ts` regerado depois de aplicar no remoto-alvo — **`check-schema-contract` só cobre Tables, não Views nem Enums** (`check-schema-contract.mjs:35-36`): enum novo não é pego pelo gate mas uso do valor quebra em runtime — o e2e-preview é o guard real.
D. A migration atômica de `solicitacoes_especialista` (acima) + backfill `origem='staff'`/`turma` da DPP. Rollback parcialmente irreversível (estados novos gravados não voltam pro CHECK antigo sem perda); dados ficam consistentes.
E. Encontros/notificações/avaliações (trigger + `avaliacoes_encontro` + RPCs + CHECK de tipos). Rollback: drop trigger/view/RPC; notificações geradas ficam como histórico benigno.

**Rollback por fatia (revisado — sem infra de feature-flag, e não precisa):** a ausência do papel `mentorado` **é** o flag de D1/D2/D3-RPC/D4 — ninguém tem a role → nenhuma superfície existe; D5 mantém os fluxos legados vivos via backfill (`origem='staff'` + `dupla_dpp_id` continua válido). Enum `mentorado` permanente (off = não conceder o papel); `dupla_dpp_id` nullable reversível só se nenhuma row nova tiver NULL; policies/views/RPCs revertíveis por `create or replace`; dados append-only ficam como histórico benigno.

**As 3 mudanças que tocam superfície compartilhada SEM role-gate** — essas são o risco real de deploy, não flag: (a) migration A reescreve `profiles_select` (bug = corta acesso de adultos hoje); (b) trigger de notificação em `encontros` (bug = afeta todo write de encontro); (c) `solicitacoes_mural` com filtro dirigido (muda o que especialistas existentes veem — fix de privacidade desejado mas visível: comunicar no changelog). Mitigação = teste das 4 personas no staging + rollback instantâneo `create or replace` — não flags.

**Piloto (decidido na reunião):** equipe onboardada → **1-2 jovens com conta real + 1 mentor engajado** (Fernanda escolhe) → geral na semana seguinte. Auditoria de conteúdo `'todos'` + inventário de e-mails rodam **antes do piloto**. Medir ativação: `% profiles criados → 1º login → 1ª ação`. WhatsApp bot como canal = fora de escopo atual (nota de futuro).

**Antes de expor rotas ao jovem:** revisar auth de `/api/export` e `/api/material/[id]` — route handlers podem assumir papel staff.

Jira: **Epic REALIZA-106** + filhas por slice — REALIZA-107 (auth, absorve -16) · 108 (shell /jovem) · 109 (avaliação estrela) · 110 (agenda livre DPP) · 111 (disponibilidade) · 112 (especialista jovem-iniciado, migration atômica) · 113 (diretório). Links: -105 (profile_roles), -98 (dupla_dpp_id), -99 (supervisor=coord), -16 (identidade).

**Status de implementação (10/out/2026):**

- ✅ **REALIZA-107 concluída** — A (`0065`, PR #3): auto-grants de `profiles`/`mentor_profiles`/`ciclo_eventos`/`especialista_eventos`/`cronogramas` com lista explícita dos 4 papéis; `materiais`+storage ganharam o gate `my_role() is not null` que nunca tiveram (bug pré-existente: qualquer autenticado lia `'todos'`). B (`0066`, PR #4): enum `mentorado` + `mentorados.profile_id` + `my_mentorado_id()` (herda `and ativo` via `my_profile_id()`). C (`0067`–`0069`, PR #5): camada de leitura — views definer `jovem_perfil`/`jovem_duplas`/`jovem_contatos`/`jovem_assinaturas`, branch `exists(jovem_duplas)` em `encontros_select`, branch `pedido_apoio`→`jovem_contatos` em `notificacoes_insert`. Tudo aplicado em staging+prod, persona test no staging (14 cenários, JWT real) — escopo exato, regressão zero.
- **Lição de RLS que fica (descoberta do persona test):** subquery dentro de policy avalia sob o RLS do invoker na tabela referenciada — `exists(duplas)` falhava pro jovem (sem SELECT em `duplas`, `exists`=false). Oracle de pertencimento pra papel sem SELECT na base = view/função definer. Documentado nas migrations 0068/0069.
- **Decisões de projeção:** `profiles_select` sem branch mentorado (row-access vazaria `dados_civis` do mentor — `jovem_contatos` cobre nome/avatar/whatsapp/e-mail dos adultos); `jovem_duplas` sem `devolutiva_pdm`; `encontros` = colunas todas seguras → branch de policy, não view.
- **Papel inerte:** ninguém tem `mentorado` ainda — rollback operacional = não conceder. `/jovem` (108) tem tudo que precisa pra renderizar.
- **Fix de CI no PR #5:** e2e-preview pinado em `environment == 'Preview – realiza.vc'` — a race entre os dois projetos Vercel que deployam o repo deixava o órfão `realiza` (sem bypass token) vencer e os testes caíam no SSO wall.
- ✅ **REALIZA-108 concluída** — app-side do `/jovem`: route group `(jovem)` com gate próprio (mesmas telas de conta + `redirect` recíproco com o `(app)`), `JovemShell` com 4 destinos fixos e acento `--role-mentorado`, boas-vindas de tela única (não o wizard de staff), home com dupla/contatos/encontros/combinados/documentos/avisos, agenda read-only, materiais (só `'todos'` chega — a audiência mora na RLS), perfil self-service enxuto. Escritas: `marcarCombinadoFeito` → RPC `marcar_combinado` (0070); `pedirAjudaJovem` → `notificacoes` `pedido_apoio` com destinatários lidos da própria `jovem_contatos` (a policy da 0069 revalida). Download da via assinada vai por `/api/assinar-token/<token>` — a RLS de `assinaturas` (self+coord) não tem ramo mentorado e não precisa: a 0070 expõe o token na view justamente pra isso. `setPessoaRole` recusa atribuir `mentorado` (o papel vem do vínculo `mentorados.profile_id`) e bloqueia trocar papel de jovem em dupla ativa. Demo completa (`b129f1d`): `DEMO_ROLES` ganha `mentorado` + 5º card na `/demo`; as 6 leituras de `queries-jovem` ramificam em demo projetando **exatamente** as colunas das views (sem `notas`/`registro_id`/evidências — a fronteira vale até na demo); a `DemoBar` monta no shell jovem e nas boas-vindas; a Ana ganhou `termo-mentorando` pendente pro botão Assinar renderizar; `demoMateriais` passou a filtrar por audiência como a policy 0065 (bug pré-existente — devolvia o catálogo inteiro a qualquer papel).
- ✅ **REALIZA-109 concluída** — D4 implementado (PR #7, `929b611`; migration `0071` em staging+prod): `avaliacoes_encontro` + `avaliacao_links` + trigger `encontros→realizado` (minta link sempre, notifica `avaliacao_pendente` só com `profile_id`; backfill dos 24 históricos sob GUC `realiza.no_notify` — zero fantasma). RPCs `submeter_avaliacao` (token bearer OU vínculo autenticado — os dois caminhos num lugar), `avaliacao_por_token`, `avaliacao_media_dpp` (média quantizada no 0,5, libera em n≥3 e re-libera a cada ≥3 novas — snapshot anti-ataque-por-diferença), `definir_visibilidade_avaliacao` (toggle do jovem), `registrar_email_apoio_avaliacao` (log definer pra `emails_enviados` coord-only). Visibilidade por trilha como especificado: especialista vê só estrelas via `especialista_avaliacoes` definer; DPP vê a média agregada + linha completa só quando `avaliacao_visivel_mentor`; jovem lê as próprias via `exists(jovem_duplas)`. `pedir_apoio` → `apoio_jovem` coord+sup in-app + e-mail Resend redundante pela action (falha de e-mail não desfaz o submit persistido — log registra o erro). App: `/avaliar/[token]` pública híbrida com todos os estados honestos (inválido/expirado/respondido/`outra_pessoa`), `/jovem` "Suas avaliações" (pendente→dialog de submit, histórico, toggle), `/duplas/[id]` rail "Voz do jovem" por papel + pendências com link copiável/wa.me (canal do jovem sem login), banner dedicado no radar da coord + filtro `?filtro=avaliacao`, semáforo com `apoioJovem` (força risco) e `avaliacaoJovemPendente` (nunca exposto a mentor — contaria invisíveis). Migração de forms = no-op documentado (prod tinha 1 link genérico, 0 respostas com contexto). Bug real pego pelo e2e: card de sucesso de `/avaliar` era inalcançável (re-render da route trocava o form por "já registrada" antes do sucesso pintar) — fix em `avaliar-token-flow.tsx` client com latch de `submeteu`. Verificação: 24 cenários de persona no staging com JWT real; `avaliacao.spec.ts` 8/8 + regressão; fixes de CI: `limparEncontrosDaDupla` ordena filhos-0071→pai (FK 409), environment `'Preview'` a seco pós-deleção do Vercel órfão. **Limitação:** link expirado não é reemitido — UI direciona a pedir novo (reissue RPC = follow-up).
- ✅ **REALIZA-110 concluída** — D3 implementado (PR #8, `3e1515b`; migration `0072` em staging+prod): agenda livre DPP via RPCs definer — `agendar_encontro_mentorado` (upsert por (dupla,numero): só DPP ativa dele, futuro, link http(s), motivo 2..1000 quando a data muda; não toca `realizado`/`nao_aconteceu`; teto no cronograma DA DUPLA), `marcar_nao_aconteceu_mentorado` (agendado passado, DPP+especialista — refund semântico: `nao_aconteceu` não consome sessão), `desmarcar_encontro` (DELETE bilateral jovem/mentor/coord, só agendado futuro — passado vira `nao_aconteceu`), `conflito_encontro` (overlap <1h nas outras duplas do jovem — definer porque o mentor DPP não lê a trilha especialista). Trigger `encontros_agenda_notify` (definer, INSERT/UPDATE/DELETE): notifica o outro lado, distingue data×só-link no corpo, dedup não-lida por (destino,tipo,corpo), ator = `my_profile_id()` com fallback "A coordenação", supressão via GUC. Achado de policy: ramo `encontro_*` em `notificacoes_insert` não pode referenciar `mentorados` direto — `authenticated` sem grant toma 42501 em tempo de plano (sem short-circuit nos ORs); resolvido com oracle `par_de_mim` definer (mesma lição das views `jovem_*`). CHECK `encontros_duracao_faixa` (30–120) era só app-level → banco. App: `/jovem/agenda` com CTA "Agendar encontro" (Select nº + data oficial do ciclo), Remarcar/Desmarcar/"Não aconteceu" por linha conforme status×tempo, warning de overlap nos dois dialogs; mentor ganhou "Desmarcar encontro" (não tinha delete — 0047 é coord-only; a RPC cobre os dois lados); sino com os 3 tipos novos; demo da Ana com encontro futuro pros gestos renderizarem. Verificação: ~30 cenários de persona no staging com JWT real (incl. bilateral mentor→jovem, dedup, GUC, regressão `pedido_apoio`); e2e `jovem-agenda.spec.ts` 7/7 com asserts service-role das notificações; e2e-preview verde. Nuance de teste: `Prefer: return=representation` no insert de notificação aplica a policy de SELECT na linha devolvida (destinatário ≠ autor → 42501 legítimo — o app usa `return=minimal`, nunca bate).

## Aberto (menor)

- Teto de 2 especialistas simultâneos por jovem (sugestão do crítico — confirmar)
- Pedido legado sem slot: jovem completa ou especialista propõe (escolher)
- Reengajamento do mesmo par: teto compartilhado por (par,turma) — presumo sim
- Budget cruza linhagem de rematch (`remanejada_de`)? Presumo count por par+turma, ignorando linhagem
- `mentorado_nome` continua aberto no mural de especialistas? (nome de menor pra especialistas não-relacionados)
- ~~Prompt de avaliação em dupla `encerrada`: suprimir ou manter~~ — resolvido na 0071: mantido (link minta sempre; encontro aconteceu, avaliação histórica é útil)
- `interacoes.tipo` CHECK (`0008:10`) precisa de `proposta`/`contraproposta` pro fallback WhatsApp logar a negociação fora da plataforma
- Troca de e-mail do jovem: `profiles_self_columns` protege — coord-only ou RPC nova
- "termo_ok do jovem": onde mora o carimbo (`mentorados` vs branch em `assinatura_reflete_termo_ok`)
- ~~Report do jovem de "não aconteceu" no especialista~~ — **decidido**: o jovem marca `nao_aconteceu` direto (`marcar_nao_aconteceu_mentorado`), sem fila da coord
- ~~Dono do `contato_compartilhado`~~ — **decidido**: o próprio jovem (RPC self; coord pode pré-setar no intake)
- ~~Numeração de sessões por dupla~~ — **resolvido na rodada 3**: `numero`=tentativa + passo=rank entre `realizado`

## Verificação de produção antes de migration de dados

**EXECUTADA 10/out (PostgREST+service, comentário no Epic REALIZA-106)** — achados: `solicitacoes_especialista` **vazia** (migration atômica toca zero rows; sem backfill) · 26×`dpp` todos cap=1 uso=1 (pooling bug **latente**, dispara no 1º dual-role) · 24 encontros **100% `externo`+`realizado`** (edição-livre validada empiricamente; backfill de trigger suprime via GUC) · 30 mentorados todos com e-mail único sem colisão · `'todos'` = 0 comunicados + 4 materiais benignos · forms: 1 link genérico sem resposta. Pendente: ~~`pg_cron`/`pg_proc`~~ — resolvido: `pg_cron` disponível (1.6.4) não instalado → expiração lazy confirmada; nenhuma função de agregação deployada (`avaliacao_media_dpp` é greenfield).

Read-only, `yhjzmxleotahijinjepl` — rodar antes de cada fase de migration de dados:

```sql
-- 1) forms: inventário + classificação de links (migração de avaliações)
select sistema, ativo, count(*) from formularios group by 1,2;
select fl.formulario_id, count(*) total, count(*) filter (where fl.usado_em is not null) respondidos,
       count(*) filter (where fl.dest_mentorado_id is not null) dest_mentorado,
       count(*) filter (where fl.dest_profile_id is not null) dest_profile,
       count(*) filter (where fl.dest_profile_id is null and fl.dest_mentorado_id is null) genericos
from formulario_links fl group by 1 order by 1;
select distinct jsonb_object_keys(contexto) as chave from formulario_links;
select contexto, count(*) from formulario_links group by 1 order by 2 desc limit 20;

-- 2) auditoria de conteúdo 'todos' — revisar corpos antes do rollout
select id, titulo, created_at from comunicados where audiencia = 'todos' order by created_at;
select id, titulo, coalesce(path,url) ref from materiais where audiencia='todos';
select c.id,c.titulo from comunicados c join mentorados m
  on c.corpo ilike '%'||split_part(m.nome,' ',1)||'%' where c.audiencia='todos';

-- 3) share de retroativos (valida a edição livre)
select origem, status, count(*) from encontros group by 1,2 order by 1,2;

-- 4) viabilidade do auto-link por e-mail + colisões pro backfill
select count(*) total, count(email) com_email from mentorados;
select email, count(*) from mentorados where email is not null group by 1 having count(*)>1;
select m.id, m.email from mentorados m join profiles p on lower(p.email)=lower(m.email);
select m.whatsapp from mentorados m join profiles p on p.whatsapp=m.whatsapp;

-- 5) capacidade/especialistas reais
select mp.profile_id, mp.capacidade, count(d.id) filter (where d.status in ('ativa','pausada')) em_curso
from mentor_profiles mp left join duplas d on d.mentor_id=mp.profile_id
where mp.tipo='especialista' group by 1,2;
select status, count(*) from solicitacoes_especialista group by 1;
select count(*) from solicitacoes_especialista where dupla_id is not null;

-- 6) funções de agregação já deployadas
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and (proname ilike '%media%' or proname ilike '%avaliacao%');

-- 7) pg_cron
select * from pg_available_extensions where name='pg_cron';

-- 8) volume de avaliações que um backfill dispararia (supressão via GUC)
select count(*) from encontros where status='realizado';
```
