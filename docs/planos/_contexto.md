# Contexto compartilhado — brainstorms de produto

**Repo:** `/home/thiago/realiza.vc` — Next.js 16 (App Router) + React 19 + Tailwind v4 + Base UI (`src/components/ui`) + Phosphor. Supabase remoto (project `yhjzmxleotahijinjepl`), RLS via `my_role()`/`my_profile_id()`, server actions em `src/lib/actions.ts` (retornam `{error}`/`{ok}`), queries server em `src/lib/queries.ts` com `React.cache`, domínio puro em `src/lib/ciclo.ts`. Demo mode completo em `src/lib/demo/` (cookies `demo_role`/`demo_onboarded`, client stub).

**Barra do produto (Thiago, AGENTS.md):** SLC não MVP; sem placeholder/stub; integrações reais; copy pt-BR; os guias oficiais são a fonte do domínio; **a dupla agenda os encontros, a coordenação monitora e faz nudge — não agenda por ela**.

## O que já existe (não reinventar)

- **Forms engine** (`0036`+`0042`): coord cria formulários em `/formularios` (builder, 8 tipos de campo), gera **links tokenizados** `formulario_links` → público responde sem login em `/f/[token]`. Forms oficiais são `sistema=true` imutáveis. Resposta 360 auto-marca checklist de encerramento.
- **Materiais** (`0010`): `materiais` com upload real (bucket privado + signed URL via `/api/material/[id]`), `materiais.encontro_num` renderiza link por encontro na ficha da dupla e na agenda.
- **Registros** pós-encontro com campos do form semanal (`atividades`, `avaliacao`, `dificuldade`, `proximo_passo`) + `registro_anexos` (bucket `registro-anexos`, signed URL `/api/anexo/[id]`) + `encaminhamentos` (combinados).
- **Encontros**: `encontros` por dupla (`unique(dupla_id, numero)`), `motivo_reagendamento`, `origem`; semáforo `saudadeDaDupla` deriva de `ciclo_eventos` (calendário oficial, 16 encontros, terças — **global, um só ciclo**).
- **Assinaturas** (`0033`+`0046`): termos versionados, `/assinar/[token]` público (precedente de link escopado), PDF com evidências.
- **Matching** (`0034`+`0038`): campos ricos em profiles/mentorados (`*_pessoal` coord-only), grade `disponibilidade` ambos os lados, `AfinidadePar` no board.
- **Notificações**: `notificacoes` com tipos (`pedido_apoio` etc.).
- **Especialista**: trilha completa (`duplas.trilha`, `especialista_eventos`, solicitação→mural→aceite, `devolutiva_pdm`).
- **Export já existe:** `/api/export?tipo=assinaturas` (CSV).
- **Uploads:** só avatar tem cap (`AVATAR_MAX_BYTES`); evidências/documentos/materiais sem cap ainda.

## O que a reunião decidiu (ata `~/Downloads/Novos sistemas Realiza.pdf` + análise `docs/analise-transcricao-mentor.md`)

- Spec de agendamento: bolinha oficial **laranja** "Encontro pendente de agendamento" → clique abre popup (nº, data, hora, link) → confirma → verde na data escolhida; células verde-pastel onde mentor+mentorado têm `disponibilidade` comum; painel lateral por estado com ações.
- "A telinha de dupla é a tela de trabalho do mentor" — concentrar, não tirar o mentor da ficha.
- Avaliação por encontro dos dois lados → agrega na 360.
- `supervisor` → renomear "assistente de coordenação".
- **Programa → Turma → Cronograma → Dupla**: turma atual já roda 2 cronogramas; `ciclo_eventos` global quebra semáforo/trilha se entrar um segundo.
- Perfil por programa (pessoa pode ser mentora num e especialista noutro) — `profiles.role` fixo hoje.
- Storage: offload frios p/ Google Drive nonprofit 6 TB; Supabase só o que alimenta dados.
- ViaCEP no cadastro; onboarding por papel; "e-mail não cadastrado" com ação real.

## Materiais oficiais encontrados (`~/Downloads`)

- `Guia do Mentor de Desenvolvimento Pessoal e Profissional - Realiza.vc (Equipe Executiva).pdf` — guia DPP completo. Instrumentos: **Perguntas Eficazes, Feedback Construtivo, PDM (metas SMART → submetas recursivas), Roda da Vida**. Estrutura de 16 encontros com tema por semana (abertura/vínculo → metas → submetas → execução → Roda da Vida ampliação → encerramento). **Linha crítica do guia: "O PDM e a Roda da Vida não ficam na plataforma: são documentos [externos]"** — hoje moram fora.
- `Guia do Mentor Especialista` — trilha de especialista.
- `definindo_metas_preenchivel.pdf` / `definindo minhas metas.pdf` — worksheet de metas (PDF-imagem, sem camada de texto — nota técnica: não é AcroForm legível, overlay/editor seria necessário).
- `Modelo Mentores/Mentorados_ dados para o matching (respostas)` CSV — estrutura real do form de matching (o que Léo quer importar).
- Zip `Metodologia da Mentoria` — fontes docx dos guias + `Base Comparativa` xlsx.
- Zip `Mentoria - Brasil Participativo` — export real do intake Google Forms (RG, comprovante, currículo, foto por pessoa).
- `termo mentorandos.pdf` — termo oficial.

## Acesso Google Workspace (configurado 02/out/2026)

- **MCP `gworkspace`** em `~/.config/devin/mcp_config.json` (user-level, fora do
  repo): `uvx workspace-mcp --tools drive forms sheets --read-only --single-user`
- Credencial OAuth bootstrapped em `~/.google_workspace_mcp/credentials/thiago@realiza.vc.json`
  (escopos read-only). Consent screen é **Internal** — só contas @realiza.vc.
- **Pegadinha do pacote:** em `--read-only` as tools de Forms somem — todas usam
  scope de escrita `forms.body` no decorator. Contorno: `forms.get` /
  `forms.responses.list` direto na Forms API v1 com a mesma credencial
  (script em `/tmp/forms-reader.py`).
- **Drive visível pra org é mínimo:** 6 arquivos, zero Shared Drives — dono real
  de quase tudo é `thixaraujo@gmail.com` (conta pessoal). O form "Avaliação
  semanal" é da `fernanda@realiza.vc`. Pra ler outros forms via API: compartilhar
  com `thiago@realiza.vc` ou mover pro Shared Drive nonprofit (6 TB, da ata).

## Google Forms oficiais (estrutura completa em `forms-google-mapeamento.md`)

- **"Avaliação de Encontro Semanal - Mentores"** — 10 campos, 20 respostas reais.
  `registros` já é a versão nativa fiel dele (atividades/avaliação/dificuldade/
  próximo passo/observações/anexo). Confirma o desenho.
- **"Matching de Mentores"** — 5 seções, ~26 campos: civil + perfil aberto
  (hobbies/inspirações/valores "até 3") + trabalho + disponibilidade
  **grid Seg–Sex × 09h–20h** + uploads (CV, foto, RG, comprovante 10MB).
  Intro cita **Signdoc** como fluxo de assinatura atual — plataforma substitui.
- **"Matching de Mentorados"** — mais leve: civil + perfil aberto + contato +
  objetivos + CV; **sem grid de disponibilidade, sem foto, sem documentos**.
- **"Cadastro de Voluntários - Brasil Participativo"** — outro programa; tem
  dados bancários (não importar sem decisão expressa).
- **Gap da forms engine** (hoje 8 tipos): falta `arquivo` (upload),
  `grid_disponibilidade` (hora×dia), `secao` (page-break), `visible_if`
  (condicional), e "Outro:" com texto livre em select.

## Regras de ouro pros planos

- Mentorado **não loga** — canal dele é link tokenizado (`/f/[token]`, `/assinar/[token]` são os precedentes).
- Mentor vive na ficha da dupla; coordenação precisa de visão agregada.
- Nada de stub: cada proposta precisa de caminho real de implementação no stack atual.
- Preservar: semáforo, RLS por papel, demo-mode honesto, copy pt-BR.
- Storage é escasso (1 GB free) — planos que criam arquivos devem considerar.

## Decisões de alinhamento (Thiago, 03/out/2026)

Respostas às perguntas-fundação — fecham as `decisão-pendente` do Linear:

1. **Turma × cronograma:** a dupla pertence à turma **E** ao cronograma. Cronograma pode ser por trilha (mentor especialista ≠ mentor DPP); duas trilhas podem ou não estar na mesma turma; turmas têm cronogramas gerais diferentes. → modelo `Programa → Turma → Cronograma (por trilha) → Dupla`.
2. **Criar turma por upload:** coord cria turma nova **upando o cronograma** — normalização robusta, multi-formato (PDF/planilha/doc), pode usar Gemini API na normalização. Wizard manual vira caminho secundário/edição.
3. **Mentor emite atividade:** sim, **dentro de catálogo curado** pela coord.
4. **PDM e Roda da Vida:** entram na plataforma. Todos os instrumentos que hoje são PDF viram experiências nativas interativas (DOM, não editor de PDF genérico primeiro). Mentorado recebe via mentor **ou coord** — disparo em lote por e-mail + botão compartilhar WhatsApp (deep link).
5. **Intake centralizado:** tudo na plataforma, substituindo Forms/Sheets — mas precisa de **modos de visualização familiares** pra quem vinha desses processos (visões tipo planilha).
6. **Mentorado sem conta (por ora):** não loga; mas **toda informação coletada via token precisa persistir vinculada à identidade do mentorado** pra futura conta sem regressão/perda.
7. **Ordem de execução:** livre — velocidade importa mais que sequência.
8. **Editor de PDF:** não urgente. Antes: PDM, metas e Roda da Vida como experiências interativas nativas.
9. **Papéis por contexto:** necessário **agora** — segunda turma entrando.
10. **Relatórios:** página especializada **exportável** (`/relatorios`), não digest por e-mail.
11. **IA:** tema separado — precisa de planejamento próprio (brainstorm, viabilidade, validação), não entra no fluxo atual.
12. **Arquivos:** agregação por dupla (todos os arquivos). "Copiar link da chamada" entra na spec de agendamento.
13. **Offload de storage:** planejar para Google Drive **ou** Google Cloud Storage — pesquisar como funciona o programa Google for Nonprofits (6 TB da ata).
14. **Em aberto:** grid de disponibilidade duplicado no form de mentores (confirmar no original).

## Refinamentos de agenda + governança (Thiago, 03/out/2026 — segunda rodada)

- **Agenda estilo Google Calendar** — não "parecido com": muito parecido. Fácil de marcar encontros direto na grade.
- **Overlay de disponibilidade da dupla:** cores da identidade = **verde = mentor, amarelo = mentorado**. Na agenda do mentor: overlay verde claro nos dias que o próprio mentor marcou livre, overlay amarelo claro nos dias que o mentorado marcou livre — a **sobreposição** evidencia os dias em que os dois podem.
- **Views da agenda pro mentor:** várias (mês, semana, **grade por horário** estilo Google semana).
- **Ações do encontro:** editar link da chamada **sem remarcar**; **remarcar encontro que já passou** (cuidado: guard `0043` torna `realizado` imutável — definir se remarcar-passado vale pra agendado-não-realizado ou exige permissão); **copiar link da chamada**.
- **Governança decidida:** coordenação é **global** (não por turma); **supervisor/auxiliar é por turma**; papel `supervisor` renomeia pra **"auxiliar executivo"** (ou semelhante) — atualiza a decisão anterior da ata ("assistente de coordenação").

## Decisões — terceira rodada (Thiago, 03/out/2026)

- **Visibilidade de duplas:** todo mundo devia ver duplas — mas sem acesso a dados pessoais que só a coord deve ver. `/duplas` pra não-coord: **"minhas duplas" por default**, "todas as duplas" fica mais escondido — **não** é a tela da coord.
- **Visibilidade de conteúdo (PDM/Roda/resultados):** coord vê **tudo** (inverte a recomendação status-only — é a forma de avaliar desempenho da dupla); **supervisor da dupla específica vê como o mentor**. Auxiliar por turma vê as duplas mas não os dados pessoais sensíveis (dados civis/documentos = coord).
- **Vaga do mentorado:** jovem **não pode** ter 2 DPPs ativas ao mesmo tempo; **pode** 1 DPP + 1 especialista. Mentor pode ter vários mentorados. → índice único fica `(mentorado_id, trilha)` parcial em status ativo — **global**, não por turma.
- **Papel por contexto:** granularidade **pessoa × turma** (mais fino que programa).
- **Formação:** **por turma** — DPP e especialista têm formação nas mesmas datas.
- **Turma parceira:** incluir Cidadão Pró-Mundo com **import automático** de duplas pré-formadas.
- **Remarcar encontro passado:** ser **permissivo** — se o mentor marcou, esqueceu de remarcar e a data passou, ele precisa poder regularizar sem mentir nem sobrecarregar a coord. (Guard `0043` de `realizado` imutável precisa de exceção/caminho auditado — log append-only cobre.)
- **Grid de disponibilidade:** o "duplicado" do form era artefato — é só **a** disponibilidade (tabela horário × dia).
- **Endereço completo:** vai no **cadastro** — princípio: reunir o máximo de dados no **perfil canônico da pessoa** pra facilitar migrações futuras.
- **Sugerir duplas:** precisa de camada de IA que ainda não existe — fica pendente junto com IA (REA-32), `AfinidadePar` não cobre.

## Cronogramas reais — Turma 1 e Turma 2 (ciclo 2026/2027, `~/Downloads`)

Os 2 PDFs oficiais mostram o formato real — bem mais rico que `ciclo_eventos` atual:

- **Estrutura em 4 seções:** (1) Preparação — etapas datadas com observação (inscrições, triagem/matching, onboarding mentores, onboarding mentorados, início); (2) Mentoria ativa — 16 encontros **com fases metodológicas** (1. vínculo+PDM, 2. prática, 3. autonomia, 4. aprofundar, 5. **Roda da Vida**, 6. encerrar/celebrar) e recesso; (3) Encerramento — evento com 360º; (4) Observações operacionais (reposição na mesma semana, feriados, cadência).
- **Turma 1** (13 duplas): início 08/09/2026, todas às terças, intervalo de 15 dias entre 8º–9º encontro, recesso 16/12–04/01, fim 12/01/2027.
- **Turma 2** (17 duplas, parceria ONG Cidadão Pró-Mundo): início **06/10/2026**, terças + **3 quintas de encontro duplo** (05/11, 03/12, 10/12) pra alinhar o fim com a T1; **duplas chegam pré-formadas pela ONG** (matching externo — nem toda turma usa o matching interno); triagem/matching aparece como etapa "concluída", não data.
- **Encerramento compartilhado:** evento único 15/01/2027 pras duas turmas (30 duplas simultâneas no pico nov–dez).
- **Implicação:** `ciclo_eventos` precisa de tipo de evento (etapa/encontro/evento), dia-da-semana variável, fase metodológica por encontro (instrumento deriva da fase), e observações/regras. O semáforo por dupla precisa do `cronograma_id` dela — caso contrário T1 e T2 corrompem um ao outro.

## Decisões — rodada modelo de dados (Kelyng × Thiago, 07–08/out/2026)

Discussão no grupo sobre `arquitetura-dados` + DER. Kelyng = analista de negócios senior, revisou o modelo ponto a ponto.

**Decidido:**

- **Grupo não é tabela** — conjunto derivado das duplas do auxiliar executivo (`duplas.supervisor_id`). Vira entidade só quando ganhar dado próprio (local físico, capacidade, maturidade). Kelyng chegou à mesma regra sozinha.
- **Supervisor de relacionamento** (mentor experiente que supervisiona) fica **fora** da estrutura — muda sob demanda; só as sessões viram registro (`supervisoes`).
- **Especialista é filha da DPP** — já implementado via `duplas.solicitacao_id` → solicitação → `dupla_dpp_id`; herda turma no aceite, sem cronograma próprio (trilha livre, 5 encontros/3 meses). Melhoria registrada como REALIZA-98: `duplas.dupla_dpp_id` direto (higiene, ~1 migration).
- **Campos de turma moram na turma** — Kelyng: dupla não carrega cronograma nem campos de turma, só `turma_id`, e deriva o resto. Hoje `duplas.turma` (texto) + `cronograma_id` podem divergir — resolve na -47 (turma entidade): ou dupla deriva via turma, ou regra de coerência.
- **Onboarding por papel** — cadastro base comum + dados por cargo. Destino: estrutural→tabela de extensão 1:1 (padrão `mentor_profiles`), questionário→forms engine. Gaps registrados na -36 (audiencia + mapping resposta→canônico) e -72 (escopo ampliado).
- **Pessoa única = modelo-alvo** — `pessoas` (identidade) + tabelas de papel. `mentorados` já é a "tabela de mentorado" dela; falta a camada de identidade compartilhada. Merge total NÃO é prioridade (T2 ao vivo, instrumentos na fila). Degraus: -16 (mentorado→conta), -48 (profile_roles). Caminho barato se adiar: `profiles.mentorado_id` link. Detalhe: dupla aponta `pessoas.id`; pra forçar papel, FK pode mirar `mentor_profiles(profile_id)`.
- **Papel de mentor é multi-valor na realidade** — evidência: form "Modelo Inscrição de Mentores" (`Atuação desejada, marque todas que se apliquem`) → **5/24 mentores marcaram DPP+Especialista** (incl. Kelyng), 4 só Especialista; Base Atados `Nome da função` → 20 DPP + 7 Especialistas. Modelo atual (`profiles.role` + `mentor_profiles.tipo`, valor único global) **não representa isso** — papel é identidade, não capacidade. Consequência: -48 (`profile_roles` pessoa×turma) vira requisito de import fiel, não só elegância. Pro import da -31: decidir modelagem mínima do dual-role (ex.: flag em `mentor_profiles`) vs. esperar refactor.

**Pendente (aguardando confirmação da Kelyng):**

- **Auxiliar executivo por turma × por dupla** — rodada 2 decidiu *por turma*, mas Kelyng argumentou *por dupla* (o Leo pode trocar o assistente de uma dupla só, sem mexer no resto; Leo confirmou "cada assistente acompanha um conjunto de duplas"). Ela disse "turma" na primeira frase mas o raciocínio todo sustenta dupla — Thiago vai confirmar. Trava REALIZA-32. Se fechar por dupla: o schema atual já é isso, a issue vira escopo de leitura/RLS.

**Abertas sem dono:** campos de turma no DER (o segundo que ela não lembrou — provável `programa`/`agendamento`); tabela por papel só quando tiver campo real pra guardar.

## Decisões — mentorado na plataforma (reunião Leo + alinhamento Thiago, 08–09/out/2026)

Jovem ganha **login real** (não portal por token). Identidade em `profiles`, `mentorados` vira extensão de papel (simétrico a `mentor_profiles`); `papel='mentorado'` nasce em `profile_roles` (-105). Token continua pra transações pontuais (form, assinatura).

**Avaliação do encontro pelo jovem** — nova tabela (por encontro, casada com `realizado`):
`estrelas 1-5` + `sentimento` (chips) + `avancei` (sim/um pouco/não) + `temas` (chips[]) + `comentario` + `pedir_apoio` (→ notificação coord+sup). Visibilidade: **especialista vê a estrela das suas sessões; DPP vê só a média agregada** dos próprios encontros (nada específico — privacidade: com 1 jovem, nota identifica); coord+supervisor veem tudo. Opção "mostrar ao mentor" existe mas **desabilitada por padrão**. Vai além do "5★+comentário" do Leo — 3 chips opcionais de 1 toque pra retrospectiva (avisar). Disparo: WhatsApp quando encontro vira `realizado`. Não-resposta é sinal pro semáforo. Migra respostas existentes (autoavaliação semanal descontinuada — template desativado, dados migram; 360º fica como instrumento de fim de ciclo).

**Agendamento DPP = edição livre com notificação** — corrigido 09/out após crítica. Modelo escolhido pelo Thiago (não simétrico, não assimétrico): **qualquer lado marca ou altera o encontro; o outro é notificado e pode reverter.** Sem portão de aceite — `registrarEncontroRetroativo` deixaria de ser brecha porque não há portão. Obrigatório: notificação em toda mutação de `data_hora`/`link` (trigger, não action) + tipos novos `encontro_marcado`/`_alterado`/`_desfeito`. Jovem ganha write em `encontros` via RPC. Proposta→aceite só existe pra especialista (D5).

**Especialista: novo modelo (jovem-iniciado)**
- Jovem vê catálogo de especialistas (aba Pessoas filtrada: especialistas + colegas da turma; whatsapp/socials OK, **dados sigilosos não** — sem dados civis/documentos)
- Especialista marca disponibilidade na agenda; jovem só pede em slot livre; cruza conflitos entre todos os jovens do especialista
- Pedido = motivo + slot → especialista recebe notificação (perfil do jovem + razão) → **aceita / recusa c/ justificativa em caixas / contra-propõe horário** → volta pro jovem aceitar ou contra-propor; botão de fallback "negociar no WhatsApp". Aceite cria a dupla especialista (como hoje). Fluxo antigo (mentor/coord pedem) **coexiste**
- **Jovem pode pedir especialista sem ter dupla DPP** → `solicitacoes_especialista.dupla_dpp_id` vira nullable
- **Múltiplos especialistas simultâneos** → `unique(ciclo, mentorado_id, trilha)` relaxa (chave por especialista)
- **Budget 5 sessões por PAR (jovem × especialista) por ciclo** — corrigido 09/out: jovem pode ter 5 com cada especialista; baixa na aceitação; recusa/cancelamento/`nao_aconteceu` devolve via RPC (delete é coord-only). Count cruza TODAS as duplas do par na mesma turma (anti-reset)
- **Prazo de 3 meses = sinal mole, não removido** — corrigido 09/out: badge/countdown/bloqueio morrem, mas trilha ativa 90d+ sem sessão nova → `atenção` no semáforo. Guia prescreve "contrato de até 3 meses"; sem sinal, trilha zumbi segura vaga e renderiza "Em dia" eternamente
- Duração livre dentro da whitelist 30-120min (default 60)
- Mentor pode ser DPP+especialista ao mesmo tempo → depende de -105 (views por trilha)
- **Pedido sem DPP exige ack da coord** — adulto de referência = coordenação; `solicitacao.turma` setada na triagem

**/jovem escopo:** home (minha dupla + dados do mentor DPP), agenda própria (ver + agendar), materiais (view centralizada de atividades), combinados (marca como feito — `encaminhamentos` já existe, só RLS), avaliações, catálogo. **Não vê** `registros`/`encontro_notas`/`interacoes` (instrumento do mentor). Aba Pessoas: especialistas + colegas de turma + **mentor DPP + coordenação**; whatsapp/socials de **adultos** visíveis, **colegas = opt-in** (`contato_compartilhado` default off — contato menor↔menor é superfície nova); civis/documentos nunca. Audiência `'todos'` inclui jovem (decisão mantida — exige auditoria one-off do conteúdo histórico antes do rollout). Assinatura/forms **híbrido**: token funciona logado ou não; notificação in-app abre o link; sessão×destinatário divergente = recusa + `respondido_por_profile_id`. Avatar = iniciais na v1 (CDN pública sem moderação, sem consentimento de imagem). Cibely precisa de remanejo; 3 mentores novos entraram.

**Disponibilidade do especialista:** grade semanal recorrente + **exceções datadas** (bloqueio/extra — modelo "working hours"). Grade dia×período atual é hint, não enforcement — modelo novo com slots reais. **Conflito checado dos DOIS lados** no aceite: overlap contra todas as duplas do especialista E do mentorado (zero checagem de overlap existe no schema hoje).

**Ajustes pós-revisão rodada 3 (09/out, Thiago):**
- **Jovem marca `nao_aconteceu`** — DPP e especialista. Reaproveita o sistema de marcar existente: flexível, sem burocracia, **auditável** (notificação ao outro lado carimba o ator). `realizado` segue exclusivo do mentor. Resolve o "especialista fantasma" (jovem marca → refund dispara, sem fila da coord) e dá voz de disputa ao jovem.
- **`motivo_reagendamento` no whitelist** do RPC do jovem — edição livre sem canal de "porquê" vira ping-pong mudo.
- **Máquina de estados da solicitação via RPCs definer**, não em `sol_update` (policy vira máquina de estados em SQL = frágil; padrão `realiza.sol_aceite` GUC já existe).
- **`contato_compartilhado`: o próprio jovem liga/desliga** via RPC (privacidade dele; coord pode pré-setar no intake com consentimento do responsável).
- **E-mail = pré-requisito de login aceito** ("todo mundo precisa de e-mail hoje") — adoção não é o risco, retenção é. **WhatsApp bot como canal = fora de escopo atual**, nota de futuro.
- **Sem infra de feature-flag** — ausência do papel `mentorado` é o flag; as 3 mudanças de superfície compartilhada (migration A, trigger em `encontros`, mural) mitigadas por staging + `create or replace` instantâneo.
- Piloto: 1-2 jovens + 1 mentor engajado antes do geral; auditoria `'todos'` + inventário de e-mails antes do piloto.
