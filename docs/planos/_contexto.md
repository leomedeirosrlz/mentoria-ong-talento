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
