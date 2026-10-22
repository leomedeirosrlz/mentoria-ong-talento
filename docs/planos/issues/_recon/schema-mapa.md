# Mapa de verdade do banco — realiza.vc

> Fonte única: `supabase/migrations/NNNN_*.sql` (104 arquivos, 0001–0105; **0039 não existe**).
> Cada afirmação cita a migration que a introduziu/alterou por último. Convenção:
> "sd" = `security definer`; policies resumidas por quem→o quê.
> Papéis (`app_role`): `coordenacao`, `supervisor` (= "auxiliar executivo"),
> `mentor_dpp`, `mentor_especialista`, `mentorado` (jovem — 0066).
> `my_role()`/`my_profile_id()` retornam NULL p/ `ativo=false` (0003/0004).
> `my_mentorado_id()` resolve `mentorados.id` via `mentorados.profile_id` (0066).
> `has_papel(papel, escopo_turma?)` = papel em `profile_papeis` (secundários contam; 0085).
> Flags transaction-local `realiza.*` usadas como bypass interno:
> `assinatura_sync` (0052), `formacao_sync` (0040), `sol_aceite` (0053→0074 virou
> `sol_transicao`), `no_notify` (0071/0072), `import_registros` (0082),
> `chamado_flag_sync` (0084).

---

## 1. Catálogo de tabelas

### profiles — pessoas com conta/staff (0001)
| coluna | tipo / constraints | origem |
|---|---|---|
| id | uuid PK gen_random_uuid | 0001 |
| user_id | uuid → auth.users, unique, on delete set null | 0001 |
| nome | text NOT NULL | 0001 (title-case via 0059) |
| email | text NOT NULL unique + unique index `profiles_email_ci_key` em lower(email); CHECK `email = lower(email)` | 0001/0059 |
| whatsapp | text; unique parcial (≠''); CHECK `~ '^\d+$'` | 0001/0022/0059 |
| role | app_role (projeção do primário de profile_papeis — sync trigger, 0085) | 0001 |
| ativo | boolean NOT NULL default true | 0001 |
| documento_path | text; unique parcial | 0012 |
| avatar_path | text | 0014 |
| bio, linkedin, areas, voluntariado | bio ≤1000; linkedin `^https?://`; areas ≤10 tags ≤40 (`areas_perfil_ok`); voluntariado ≤300 | 0030 |
| onboarded_em | timestamptz | 0031 |
| nome_social, data_nascimento, genero, cidade, uf, interesses, motivacao, pref_genero_par, cargo, empresa, origem, consent_lgpd_em | ficha matching; checks de domínio/caps (0034) | 0034 |
| dados_civis | jsonb objeto (PII civil, coord-only) | 0046 |
| cor_raca, form_bruto | enum cor/raça; jsonb payload do intake | 0054 |
| created_at | timestamptz | 0001 |

**Grants (não-RLS):** SELECT table-level revogado; grant por coluna pras públicas
(0026/0030/0031/0034). Sensíveis (`data_nascimento, genero, pref_genero_par,
motivacao, dados_civis, cor_raca, form_bruto, email, whatsapp, documento_path`)
fora do grant → views coord-only ou RPC self.
**Policies:**
- `profiles_select`: self (user_id=auth.uid) OU coord OU (sup/dpp/esp E (alvo.role≠'mentorado' OU `jovem_relacionado(id)`)) — 0076
- `profiles_self_update`: própria row, role travado — 0001
- `profiles_coord`: for all, coord — 0001

**Triggers:** `profiles_self_columns` (guard: email/role/ativo/user_id/
documento_path/form_bruto/created_at imutáveis no self + latch consent_lgpd_em — 0023/0053/0054);
`profiles_role_para_papeis` (role→papeis sync, 0085);
`on_auth_user_created`→handle_new_user (vincula por lower(email); 0001/0045/0059);
`on_auth_user_allowlist` (signup só se e-mail pré-cadastrado em profiles; 0045);
`on_auth_user_email_sync`→sync_profile_email (0060).

### mentor_profiles — extensão de mentor (0001)
| coluna | tipo | origem |
|---|---|---|
| profile_id | uuid PK → profiles cascade | 0001 |
| tipo | text CHECK ('dpp','especialista') | 0001 |
| areas | text[] | 0001 |
| capacidade | smallint default 1 (pool DPP) | 0001/0073 |
| capacidade_especialista | smallint default 1 ≥1 (pool esp, separado) | 0073 |
| termo_ok, formacao_ok | boolean default false | 0001 |
| experiencia_previa, formacao_externa | text ≤2000 | 0034 |
| disponibilidade | jsonb — forma canônica `{"celulas":[{dia,periodo}],"dias":[],"periodos":[]}` (`disponibilidade_ok`, 0034→0100) | 0034/0100 |

**Policies:** select = os 4 papéis staff (0065); self_update própria row (0001);
coord for all (0001). **Trigger `mentor_profiles_guard`:** termo_ok/capacidade/
capacidade_especialista/tipo/formacao_ok só coord, com exceções
`realiza.assinatura_sync`/`realiza.formacao_sync` (0004→0052→0079).

### mentorados — jovens (0001)
| coluna | tipo | origem |
|---|---|---|
| id | uuid PK | 0001 |
| nome, email, whatsapp | nome NOT NULL; email/whatsap normalizados (0059); whatsapp unique parcial | 0001/0022/0059 |
| ong_origem, notas (≤10000) | text | 0001 |
| documento_path, avatar_path | text, unique parcial no doc | 0012/0016 |
| nome_social, data_nascimento, genero, cidade, uf, interesses, motivacao, pref_genero_par, objetivos, escolaridade, origem | ficha matching (checks 0034) | 0034 |
| disponibilidade | jsonb células (0038/0100) | 0038 |
| dados_civis, responsavel | jsonb coord-only (responsavel = DadosCivis+parentesco) | 0046 |
| cor_raca, form_bruto | sensíveis | 0054 |
| profile_id | uuid UNIQUE → profiles — vínculo jovem↔conta (nullable; 1 conta = 1 mentorado) | 0066 |
| contato_compartilhado | boolean default false (opt-in colega↔colega) | 0076 |
| situacao, saiu_em, motivo_saida | enum ('ativo','desistente','concluido'); CHECK trio coerente; motivo ≤300 | 0077 |
| curriculo_path, curriculo_url | confidencial; unique parcial; url `^https?://` | 0081 |
| created_at | | 0001 |

**Grants:** SELECT por coluna (0034+); sensíveis fora (`data_nascimento, genero,
pref_genero_par, motivacao, dados_civis, responsavel, cor_raca, form_bruto,
curriculo_*`). **Policies:** `mentorados_select` = coord OU existe dupla da
pessoa como mentor/supervisor (0023); `mentorados_coord` for all (0001).

### duplas — par mentor×mentorado (0001)
| coluna | tipo | origem |
|---|---|---|
| id | uuid PK | 0001 |
| turma | text NOT NULL (era `ciclo`, renomeada 0061; sem default) | 0001/0061 |
| mentor_id | uuid → profiles NOT NULL | 0001 |
| mentorado_id | uuid → mentorados NOT NULL | 0001 |
| supervisor_id | uuid → profiles NULL | 0001 |
| status | dupla_status default 'ativa' | 0001 |
| iniciada_em | date | 0001 |
| trilha | text default 'dpp' CHECK ('dpp','especialista') | 0027 |
| demanda | text | 0027 |
| solicitacao_id | uuid → solicitacoes_especialista (a solicitação que gerou a 1ª dupla esp) | 0027 |
| encerrada_em, motivo_encerramento (3–300), devolutiva_pdm (10–4000) | só trilha esp: CHECK `trilha='especialista' OR (os 3 null)`; `encerrada_em ⇒ motivo` | 0037 |
| cronograma_id | uuid → cronogramas; CHECK `duplas_dpp_precisa_cronograma` (dpp ativa/pausada exige) | 0061 |
| remanejada_de | uuid → duplas (linhagem de rematch) | 0063 |
| ~~pdm_url~~ | **REMOVIDA em 0098** (existia 0044–0097; RPC definir_pdm_url também dropada) | 0098 |
| created_at | | 0001 |

**Unique:** `duplas_mentorado_dpp_uk` (mentorado_id) where ativa/pausada AND
trilha='dpp'; `duplas_mentorado_esp_uk` (mentorado_id, mentor_id) where
ativa/pausada AND trilha='especialista' — 0074. **Policies:** select = coord /
mentor / supervisor da dupla (0001; mentorado NÃO lê tabela — usa jovem_duplas);
write = coord for all apenas (0001; supervisor update dropada 0004).
**Triggers:** `duplas_capacidade`→check_mentor_capacidade (advisory lock +
pool por trilha; 0025→0073); `duplas_jornada_autoemit` (insert→auto-emissão de
instrumentos, 0099); `duplas_jornada_expirar` (status→expira links de
instrumentos ao fechar, 0099). O fechamento automático é trigger em
**encontros** (`encontros_encerramento_auto`/`_upd`→`dupla_encerramento_auto`,
0102).

### ciclo_eventos — calendário oficial por cronograma (0001/0061/0062)
| coluna | tipo | origem |
|---|---|---|
| id, cronograma_id → cronogramas NOT NULL, tipo, numero, data, data_fim, titulo, fase, instrumentos text[] | tipo CHECK ∈ ('etapa_preparacao','encontro','recesso','evento_encerramento','formacao'); numero smallint; data NULL só se etapa_preparacao+concluida; data_fim exige data | 0001/0062 |
| status | text default 'pendente' CHECK ('pendente','concluida') | 0062 |
| observacao | text | 0062 |
| ordem | smallint NOT NULL (sequência do PDF; não unique) | 0062 |
Unique: `(cronograma_id, numero)`. **Policies:** select = 4 papéis staff (0065);
coord for all (0001).

### encontros — sessões por dupla (0001)
| coluna | tipo | origem |
|---|---|---|
| dupla_id → duplas cascade; numero smallint 1–24 (é TENTATIVA desde 0074); unique(dupla_id,numero) | 0001/0074 |
| data_hora timestamptz; duracao_min smallint CHECK ∈ (30,45,60,90,120) | 0001/0072/0074 |
| status encontro_status default 'agendado' | 0001 |
| origem text CHECK ('plataforma','externo') | 0001 |
| link text CHECK `^https?://`; motivo_reagendamento ≤1000 | 0001/0023/0011 |
| realizado_em timestamptz | 0007 |
| created_by → profiles | 0001 |

**Policies:** select = coord/mentor/supervisor da dupla OU mentorado via
jovem_duplas (0067/0068/0098); insert = coord OU mentor da dupla (0047);
update = idem (0047); **delete = coord-only** (0047).
**Triggers:** `guard_autoria(created_by)` (0023); `encontros_status_guard`
(realizado imutável, 0043); `encontros_identidade_guard` (dupla_id/numero
imutáveis p/ não-coord, 0053); `encontros_agenda_notify` (insert/update/delete
→ notifica outro lado, 0072); `encontros_avaliacao_prompt` (→realizado minta
avaliacao_link + notif jovem, 0071); `encontros_jornada_autoemit(+_upd)`
(→realizado auto-emite instrumento, 0099); trigger `dupla_encerramento_auto`
(→realizado: reta-final/conclusão automática, 0102).

### registros — follow-up do mentor por encontro (0001/0002)
| coluna | tipo |
|---|---|
| encontro_id uuid unique → encontros cascade; tema, ferramenta, reflexoes, observacoes; precisa_apoio bool | 0001 |
| atividades text[]; avaliacao CHECK ('excelente','boa','regular','baixa'); dificuldade CHECK ('nenhuma','aprendizagem','participacao','comportamental','organizacao','outro')+detalhe; proximo_passo CHECK ('continuar','reforcar','novo_feedback','acompanhar_de_perto','conversa_individual','outro')+detalhe | 0002 |
| caps: tema/ferramenta ≤500, reflexoes/obs ≤20000, detalhes ≤2000 (0023) | |
**Policies:** select escopo dupla (0001); insert = coord OU mentor da dupla E
encontro realizado (0053); update = coord/mentor (0047); delete = coord (0047).
**Triggers:** `registros_touch` updated_at (0001); `registros_guard_apoio`
(só coord limpa precisa_apoio, exceto `chamado_flag_sync`; 0004→0084);
`guard_autoria` (0023→0082 com bypass import); `registros_encontro_guard`
(encontro_id imutável, 0053); `registros_apoio_chamado_sync` (precisa_apoio
↔ chamado dual-run, 0084).

### encaminhamentos — combinados por dupla (0001)
dupla_id, registro_id→registros set null, descricao, responsavel CHECK
('mentor','mentorado') default 'mentorado', prazo, status encaminhamento_status.
Policies: select escopo dupla; write (all) = coord/mentor da dupla (0001).
O jovem lê via `jovem_encaminhamentos` e flipa status via `marcar_combinado` (0070).

### materiais — biblioteca da coordenação (0001/0010)
titulo, descricao, tipo CHECK ('guia','template','conteudo','link'), url CHECK
`^https?://`, audiencia CHECK ('todos','dpp','especialista','coordenacao'),
encontro_num, ordem, **path** unique parcial (0010).
Policies: select = papel≠null E audiência do papel (0004→0065); coord for all.
Storage: bucket `materiais` privado espelha audiência; objeto exige row com
path=name (0010/0065).

### interacoes — log de nudges (0008)
dupla_id, autor_id, canal CHECK ('whatsapp','email','outro','in_app' — in_app
0094), tipo CHECK ('nudge','contato','apoio'), nota. Policies: select/insert =
coord OU mentor/supervisor da dupla (0008). Trigger guard_autoria('autor_id').

### registro_anexos — evidências por registro (0009)
registro_id→registros cascade, path unique, nome, tamanho, mime, created_by.
Policies: select escopo registro (0009); insert = mentor da dupla ativa +
created_by=self + path like `<registro_id>/%` (0020/0021); delete = coord OU
mentor da dupla (0020); sem update (imutável). Bucket `registro-anexos` privado;
objeto exige row path=name; insert = mentor da dupla (0020); delete = coord/mentor.

### encontro_notas — anotações pré-encontro do mentor (0015)
unique(dupla_id,numero), texto ≤10000. Policies = mesmo escopo de
encaminhamentos (coord all; mentor write; supervisor select). Trigger touch+autoria.

### pessoa_notas — caderneta privada por pessoa (0016/0017)
profile_id XOR mentorado_id (CHECK num_nonnulls=1), texto 1–10000, created_by.
Policies: select/delete = **só o autor** (0017 — nem coord lê); insert = staff
qualquer pessoa OU mentor no próprio mentorado (0016→0091 has_papel). Trigger
guard_autoria (0023).

### comunicados — avisos da coordenação (0018/0019/0055)
titulo ≤140, corpo ≤5000, audiencia ∈ ('todos','dpp','especialista','coordenacao',
'equipe'), created_by, **prioridade** ∈ ('normal','importante','urgente') +
prioridade_ord gerada (0055).
Policies: select = papel≠null E audiência (0019→0090/0091 has_papel); insert =
coord E created_by=self (0019); delete = coord; sem update (delete+republica).

### notificacoes — sino in-app (0018)
profile_id→profiles cascade; tipo ∈ lista fechada — **verdade final (0102)**:
`comunicado, pedido_apoio, apoio_resolvido, dupla_formada, demanda_especialista,
solicitacao_registrada, especialista_aceitou, solicitacao_cancelada,
trilha_encerrada, supervisao_registrada, formulario_respondido,
avaliacao_pendente, apoio_jovem, encontro_marcado, encontro_alterado,
encontro_desfeito, solicitacao_triagem, solicitacao_recusada,
solicitacao_proposta, chamado_aberto, chamado_atribuido, chamado_atualizacao,
chamado_resposta_autor, chamado_resolvido, chamado_reaberto, chamado_mencao,
sugestao_especialista, devolutiva_especialista, lembrete, dupla_reta_final`.
titulo ≤200, corpo ≤1000, href CHECK interno (`/` ou `^/[^/\\]`), comunicado_id
cascade, created_by, lida_em.
Policies: select/update = próprio destinatário (0018); update só altera lida_em
(trigger `notificacoes_guard_update`, 0019); insert = coord OU ramos por tipo
com autoria própria (verdade final 0090/0091: pedido_apoio→staff/jovem_contatos,
demanda_especialista→esp, solicitacao_*/especialista_aceitou/trilha_encerrada
escopados, supervisao_registrada, ramo encontro_* via `par_de_mim`, ramos com
has_papel); delete = coord (0019).

### especialista_eventos — catálogo dos 5 passos (0027)
PK numero 1–5, titulo, foco. Seed dos 5 passos inline. Select = 4 papéis staff
(0065). O jovem lê via `jovem_trilha_esp` (0088).

### solicitacoes_especialista — pedido de sessão esp (0027→0074→0086)
| coluna | tipo |
|---|---|
| mentorado_id → mentorados NOT NULL; dupla_dpp_id → duplas **NULLABLE** (0074) | |
| demanda text NULLABLE (10–1000 quando presente; gate: pedido novo exige demanda) | |
| especialista_desejado_id, especialista_id → profiles; dupla_id → duplas | |
| status ∈ ('sugerida','aberta','aguardando_coord','contra_proposta','aceita','recusada','cancelada','expirada') — 0086 | |
| origem ∈ ('staff','jovem','mentor') default 'staff' — 0086 | |
| motivo (3–500), justificativa_recusa (3–500), turma text, slot_proposto timestamptz | 0074 |
| respondida_em, created_by, created_at | 0027 |
**Policies:** insert = coord/mentor-DPP da dupla de origem, nasce 'aberta' sem
resposta (0028; jovem só via RPC); select = coord / mentor+supervisor da
dupla_dpp / esp em aberta+contra_proposta escopo dirigido / especialista_id /
created_by / mentorado dono (0074/0087 has_papel); update = coord OU flag
`realiza.sol_transicao` (0074 — toda transição via RPC).
**Triggers:** `solicitacoes_autor` stamp (0027→0053); `solicitacoes_integridade`
(insert: mentorado casa com dupla_dpp, destinatário é esp ativo, dupla destino
válida, gate demanda, autoria/origem; update: campos de identidade imutáveis
p/ não-coord — 0029→0074→0086).

### solicitacao_propostas — thread de contra-propostas (0074)
solicitacao_id cascade, autor_id→profiles, slot_proposto, mensagem ≤500.
Append-only (sem policy de insert — só RPCs definer; máx. 4 por solicitação).
Select = partes da negociação + quem vê a solicitação pai (0074).

### documento_templates (0033)
slug unique, titulo, versao int, signatario CHECK ('profile','mentorado'),
ativo. Seeds: `termo-voluntario` (profile), `autorizacao-responsavel`
(mentorado), `termo-mentorando` (mentorado, 0046).
Select = authenticated (metadados públicos, 0033). Escrita: sem policy (migração).

### assinaturas (0033)
template_id→templates; profile_id XOR mentorado_id; status ∈
('pendente','assinado','revogado','expirado'); dados_snapshot jsonb;
token uuid default + token_expira_em; assinatura_texto, assinado_em, ip,
user_agent, hash_documento (sha256 no banco, 0053); created_by.
Unique parcial `assinaturas_viva_uk` (alvo, template) where
pendente/assinado (0053).
Policies: select = signatário profile OU coord (0033); insert = coord E alvo
casa com signatario do template (0058); sem update/delete — tudo via RPC.
**Trigger `assinaturas_termo_ok`:** sync termo_ok em mentor_profiles (0033→0052).

### formularios — engine de forms (0036/0042/0080/0104)
titulo, descricao, **campos jsonb[]** ({id,tipo,label,obrigatorio,opcoes?,
descricao?}), ativo, versao, **sistema** ∈
('anamnese','avaliacao_360','autoavaliacao_mentor','visao','roda_vida','pdm',
'metas','avaliacao_especialista') — unique parcial por sistema (0042→0080→0104).
Policies: for all coord-only (0036). **Trigger `formularios_sistema_guard`:**
definição oficial imutável/delete bloqueado; `ativo` livre; sistema só nasce
por migração (0042). Tipos de campo aceitos pela fronteira
`formularios_limpa_respostas`: `texto, texto_longo, data, select, sim_nao,
escala_1_5, escala_1_10, checkbox, multi_select` + `secao` (estrutural, nunca
responde/grava — 0080). Seeds oficiais: ids `5eed0001-…-01..08`.

### formulario_links (0036/0070)
formulario_id cascade; token text unique ≥20 (192 bits base64url);
dest_profile_id XOR dest_mentorado_id (≤1); dupla_id; contexto jsonb;
usado_em; expira_em; **respondido_por_profile_id** (0070); created_by.
Policies: for all coord-only; público só via RPCs.

### formulario_respostas (0036)
link_id unique cascade; respostas jsonb {campo_id:valor}; respondido_em.
Coord-only.

### encerramentos — rito de fechamento DPP (0037)
dupla_id unique; tipo CHECK ('concluida','encerrada') nullable; checklist jsonb
(`encerramento_checklist_ok`: chaves ∈ {feedback_final, feedback_mutuo,
revisao_pdm, avaliacao_360_enviada, autoavaliacao}, valores bool);
autoavaliacao_mentor ≤4000; disponivel_proximo_ciclo bool; resumo_jornada;
decidido_por; CHECK `(tipo is null) = (decidido_por is null)`.
Policies: select = coord/mentor/supervisor da dupla; for all coord. Grant
select/insert/update. Trigger `encerramentos_decisor` stamp (0037→0053).

### presencas — chamada por evento (0040)
unique(ciclo_evento_id, profile_id); presente bool; marcado_por/em (trigger
stamp). Policies: select = coord/self/supervisor-dos-mentores; write coord.
Trigger `presencas_sync_formacao` → formacao_ok quando presente em TODOS os
'formacao' da TURMA (0040→0061).

### supervisoes — sessão supervisor↔mentor (0041)
supervisor_id, mentor_id, dupla_id nullable, data, resumo 10–4000, created_by.
Policies: select = coord/autor/mentor-alvo/supervisor-da-dupla-vinculada;
insert = supervisor autoral OU coord, mentor precisa ter dupla supervisionada,
dupla vinculada precisa casar (0041→0053/0091); delete = coord; sem update.

### login_handoffs (0049/0050)
nonce uuid PK; access_token, refresh_token, expires_at (10min), failed bool.
Sem policies; revoke total — só RPCs (uso único via delete).

### documentos_pessoa — arquivo morto do intake (0054)
profile_id XOR mentorado_id; tipo ∈
('rg','cpf','comprovante_residencia','comprovante_bancario','curriculo','outro');
path unique; nome ≤300; created_by. **Coord-only integral** (nem o dono lê).
Policies de storage do bucket `documentos` exigem path registrado.

### emails_enviados — log Resend (0056/0057/0071/0084)
autor_id; tipo ∈ **('comunicado','material','assinatura','apoio_jovem',
'chamado')** — verdade final 0084:1054; ref_id (sem FK, sobrevive à exclusão);
assunto; audiencia text[]; destinatarios, enviados int; falhas text[].
Select/insert = coord-only.

### cronogramas — calendário por turma (0061)
nome ≤120, **turma text** ≤80 (não é entidade — label compartilhado com
duplas.turma), trilha CHECK só 'dpp', inicio_em, fim_em, encontros_esperados,
status ∈ ('rascunho','ativo','encerrado'), created_by. Select = 4 papéis staff;
coord for all.

### avaliacoes_encontro — avaliação do JOVEM por encontro (0071)
dupla_id, encontro_id unique, estrelas smallint 1–5, sentimento, avancei CHECK
('sim','um_pouco','nao'), temas text[], comentario, pedir_apoio bool,
avaliacao_visivel_mentor bool default false, respondido_por_profile_id.
Policies: select = coord / supervisor-da-dupla / **mentor_dpp só se
avaliacao_visivel_mentor AND trilha≠especialista** (0090/0098) / mentorado via
jovem_duplas; update = coord (limpa pedir_apoio); insert só RPC; delete ninguém.
**Trigger `avaliacoes_encontro_guard`:** imutável exceto pedir_apoio (só coord
limpa, exceto flag sync; 0071→0084). Trigger `avaliacoes_apoio_chamado_sync`
dual-run (0084).

### avaliacao_links — bearer token por encontro (0071)
token unique ≥20; encontro_id unique; dupla_id; expira_em (60d); status ∈
('pendente','respondido','expirado'); respondido_em; respondido_por_profile_id.
Select = coord-only (reemissão por WhatsApp). Mintado por trigger
`encontros_avaliacao_prompt` ao virar realizado + backfill (0071).

### especialista_grade / especialista_excecoes — agenda real do esp (0073)
grade: profile_id cascade, dia_semana 0–6, hora_inicio<fim, unique
(profile,dia,hora_inicio). excecoes: profile_id, data, hi<hf, tipo ∈
('bloqueio','extra'). Policies: select self/coord; insert/update = self com
has_papel('mentor_especialista') OU coord (0073→0087); delete self/coord.
Jovem nunca lê tabela crua (slots via RPC).

### ia_eventos — auditoria IA (0083)
profile_id→profiles (NOT NULL, vem de my_profile_id), canal ∈ ('chat','mcp'),
tool, args jsonb, ok bool, erro, duracao_ms. Select = self OU coord; insert só
via `registrar_ia_evento`; sem update/delete/grant de escrita.

### chamados — fila de atendimento unificada (0084)
numero text unique `CHA-NNNNNN` (sequence `chamados_numero_seq`);
autor_id XOR-autor_mentorado_id (pelo menos um); dupla_id; categoria ∈
('agenda','metodologia','plataforma','urgencia','outro'); descricao_outro
(obrigatório se outro); assunto 2–200; mensagem ≤5000; status ∈
('aberto','em_atendimento','resolvido'); atribuido_a; origem ∈
('manual','registro','avaliacao_jovem'); registro_id/avaliacao_id unique
parciais (dual-run); resolvido_em/por; resolucao_resumo ≤1000.
Policies: select = `chamado_visivel_equipe` (coord tudo; supervisor tudo MENOS
plataforma) OU autor (profile/mentorado) — **dupla_id sozinho não dá acesso**;
zero policies de escrita — só RPCs. Triggers: touch_updated_at.

### chamado_atualizacoes / chamado_comentarios / chamado_anexos (0084)
atualizacoes: chamado_id cascade, autor_id null=sistema, tipo ∈
('publica','sistema'), texto ≤4000 — select = quem vê o chamado.
comentarios: interno equipe — select = coord OU supervisor que vê o chamado.
anexos: metadados + bucket `chamado-anexos` privado; interno bool (equipe-only);
select = visibilidade do chamado ∧ (¬interno ∨ eh_equipe); insert metadado
direto escopado; storage confere row.

### profile_papeis — papéis por programa (0085)
profile_id cascade; papel app_role; escopo_turma text ≤80 (null=global; validada
contra cronogramas/duplas por trigger); primario bool; unique
`nulls not distinct` (profile_id,papel,escopo_turma); unique parcial 1 primário.
**Fonte de verdade dos papéis; profiles.role é projeção do primário**
(triggers: `profile_papeis_escopo_check`, `profile_papeis_norm_primario`,
`profile_papeis_projeta_role` em profile_papeis; `profiles_role_para_papeis`
em profiles — role escrito direto vira primário global; role=null remove tudo).
Escopo = eixo de filtro adicional, nunca amplia. Policies: select = self OU 4
papéis staff; for all coord.

### devolutivas — feed datado da trilha esp (0086)
dupla_id cascade, autor_id→profiles, texto 10–4000. Select = coord / autor /
mentorado via jovem_duplas (0089); write só via `postar_devolutiva` RPC.
(devolutiva_pdm final segue na coluna da dupla.)

### terceiros_contatos / terceiros_respostas / terceiros_consolidacao (0103)
contatos: dupla_id cascade, nome 2–120, vinculo ∈ ('amigo','familiar','colega',
'outro'), whatsapp 8–25, token unique (24B b64url default), expira_em 30d,
status ∈ ('pendente','respondido','expirado'), created_by default
my_profile_id(). Policies: select coord/mentor/supervisor da dupla; insert
coord/mentor da dupla DPP ativa|pausada; update só pendente/expirado por
coord/mentor (0105 +dupla viva); delete só pendente coord/mentor.
Trigger `guard_terceiros_cap`: máx 9 por dupla, 3 por vínculo (insert+update of
vinculo; 0103→0105).
respostas: contato_id unique, pontos_fortes + a_melhorar (1–4000), imutável;
select coord/mentor/supervisor (jovem nunca).
consolidacao: dupla_id PK, consolidado ≤8000, publicado_em, escrito_por;
select = escopo dupla OU mentorado quando publicado_em≠null (via jovem_duplas).

---

## 2. Catálogo de RPCs (todas `security definer`, salvo indicação)

### Identidade/auth
| RPC | assinatura | o que faz / guards |
|---|---|---|
| my_profile_id | ()→uuid, sql stable sd | profile do JWT, só se ativo (0004) |
| my_role | ()→app_role, sql stable sd | role primário, só se ativo (0003) |
| my_mentorado_id | ()→uuid, sql stable sd | mentorados.id via profile_id (0066) |
| my_papeis | ()→setof app_role | papéis do usuário ordenados por precedência (0085) |
| has_papel | (app_role,text?)→bool / (uuid,app_role,text?)→bool | papel global ou do escopo, ativo (0085) |
| email_disponivel | (text)→bool | e-mail livre em profiles+auth.users excl. self (0060) |
| registrar_login_handoff | (nonce,access,refresh)→void | publica tokens do magic link; limpa expirados (0049→0053) |
| pegar_login_handoff | (nonce)→jsonb | resgata uso-único (delete); devolve {failed:true} se tombstone (0050) |
| falhar_login_handoff | (nonce)→void | marca link queimado (0050) |
| par_de_mim | (uuid)→bool, sd | "profile é o outro lado de uma dupla minha" (0072) |
| jovem_relacionado | (uuid)→bool, sd | "profile é jovem de dupla minha" mentor/supervisor (0076) |

### Assinaturas
| RPC | assinatura | notas |
|---|---|---|
| assinar_termo | (dados jsonb,texto,ip,ua)→uuid | self-service; valida `dados_civis_ok`; hash sha256 no banco; promove pendente ou insere; sync-back dados_civis (0053/0059) |
| assinatura_por_token | (uuid)→jsonb | público; civis só enquanto pendente vigente; identidade híbrida: autenticado ≠ alvo → 'outra_pessoa'; autorizacao → 'signatario_externo' (0070) |
| assinar_com_token | (uuid,dados,texto,ip,ua)→uuid | público; idempotente; update atômico status='pendente'; snapshot por slug; sync-back (0053/0059/0070) |
| assinatura_completa_por_token | (uuid)→jsonb | via assinada, só status='assinado', allowlist de colunas (0053) |
| revogar_assinatura | (uuid)→void | coord-only, null-safe (0053) |
| regenerar_token_assinatura | (uuid)→uuid | coord, só pendente, +30d (0053) |
| meus_dados_civis | ()→jsonb | próprios dados civis p/ prefill (0046) |
| meus_dados_pessoais | ()→jsonb | próprios campos sensíveis (0048) |
| dados_civis_ok | (jsonb,bool)→bool | helper interno sem grant (0053) |

### Formulários
| RPC | assinatura | notas |
|---|---|---|
| formularios_limpa_respostas | (campos,respostas)→jsonb | sanitiza/valida contra definição; authenticated only (0036→0080) |
| formulario_por_token | (text)→jsonb | público; status + definição + sistema; gate de identidade híbrida (0080) |
| submeter_resposta_formulario | (text,respostas)→uuid | público; idempotente via usado_em; carimba checklist avaliacao_360_enviada; notifica coord (0080) |
| emitir_link_instrumento | (dupla_id,sistema)→jsonb | sistemas ∈ visao/roda_vida/pdm/metas; emissor = coord OU mentor DPP da dupla viva (0090/0096/0097); reuso de link vivo; token 24B b64url |
| instrumentos_da_dupla | (dupla_id)→jsonb | respostas dos 4 instrumentos da dupla; coord/mentor/supervisor/mentorado da dupla (0080→0093→0096; entregas com contexto/usado_em/expira_em/token) |
| jovem_jornada | ()→jsonb | jornada auto-escopada do mentorado: dupla DPP recente + cronograma + instrumentos + entregas 360 (0096→0099) |
| painel_instrumentos_jornada | ()→jsonb | coord/supervisor: entregas por sistema por dupla DPP viva, sem respostas/tokens (0096) |
| jornada_autoemit | (dupla_id)→void | auto-emissão por marco do cronograma; chamada por triggers encontros/duplas (0099) |

### Especialista (fluxo v2)
| RPC | assinatura | notas |
|---|---|---|
| pedir_especialista_jovem | (esp?,demanda?,motivo?,slot?)→uuid | jovem-only; teto 3 trilhas/3 pedidos; slot exige agenda livre real; sem DPP → 'aguardando_coord' (0074→0087→0095→0101) |
| aceitar_solicitacao | (id, slot?)→uuid | esp-only (has_papel); FOR UPDATE; aceita pedido/contra-proposta; efetiva via sol_efetivar (0074→0087→0097) |
| aceitar_proposta | (id)→uuid | autor aceita contra-proposta do especialista (0074→0097) |
| contra_propor_solicitacao | (id,slot,mensagem?)→void | bilateral; slot sai da grade real; máx 4 msgs (0074→0087) |
| recusar_solicitacao | (id,justificativa)→void | só esp dirigido/engajado (0074→0087) |
| reconhecer_solicitacao | (id,turma?)→void | coord: libera 'aguardando_coord'→'aberta'; turma opcional desde 0101 |
| cancelar_solicitacao | (id)→void | autor ou coord, estados abertos (0074→0097) |
| sol_efetivar | (sol,esp,slot)→uuid | interno: advisory locks, re-checa slot, conflito do jovem em TODAS as duplas, teto 3 trilhas, capacidade esp, budget 5 sessões/par (global desde 0101), cria/reusa dupla, insert encontro n+1 (0074→0097→0101) |
| sol_notificar / sol_coords | internos sem grant | helpers de notificação do fluxo (0074) |
| sugerir_especialista_mentor | (mentorado,demanda,objetivo?,esp?)→uuid | mentor DPP sugere trilha; nasce 'sugerida' p/ o jovem confirmar (0086) |
| confirmar_sugestao_especialista | (id,demanda?,objetivo?,esp?)→void | jovem confirma a sugestão (0086) |
| dispensar_sugestao_especialista | (id)→void | jovem recusa a sugestão (0086) |
| especialista_slots_livres | (esp,desde?,ate?)→table(inicio) | slots 1h a cada 30min: grade+extras−bloqueios−encontros vivos; aberto a authenticated (0073) |
| especialista_slot_livre | (esp,inicio)→bool | valida slot exato contra a grade (0073) |
| postar_devolutiva | (p_dupla_id uuid, p_texto text)→uuid | só o especialista da dupla (mentor_id=self), trilha esp ativa/pausada; texto ≥10; notifica jovem (0086) |

### Encerramento / remanejo
| RPC | assinatura | notas |
|---|---|---|
| salvar_autoavaliacao | (dupla,texto,disponivel)→void | mentor da dupla, upsert em encerramentos, trava após decidido_por (0037→0102) |
| encerrar_trilha_especialista | (dupla,tipo,motivo,devolutiva)→void | esp da dupla ou coord; exige devolutiva 10–4000; **emite form avaliacao_especialista §13 via emitir_avaliacao_esp + notificação** (0104→0105) |
| rematch_dupla | (dupla_id,lado,novo_id,motivo?,registrar_nota?=true)→uuid | coord-only; encerra antiga + cria herdeira (turma/cronograma/supervisor/demanda; PDM não viaja mais — 0098); lado mentor exige papel compatível c/ trilha (escopo turma p/ dpp, global p/ esp — 0091/0101); lado mentorado exige vaga livre na trilha; nota opcional em pessoa_notas; **trilha esp também emite avaliação §13 pro especialista que sai** (0105) |
| emitir_avaliacao_esp | (dupla,mentor)→void | interno sem grant; dedup (form,dest,dupla); minta link + notif avaliacao_pendente (0105) |
| avaliacao_esp_da_dupla | (dupla)→jsonb | status do link §13 da trilha; visível a esp da dupla/coord; token só pro mentor (0104→0105) |
| dupla_encerramento_auto | trigger | →realizado: "faltam 2" → notif dupla_reta_final; último encontro do cronograma → status 'concluida' + encerramentos pendente + avisos (0102) |

### Agenda do jovem / encontros
| RPC | assinatura | notas |
|---|---|---|
| agendar_encontro_mentorado | (dupla,numero,data_hora,link?,motivo?)→jsonb | jovem DPP ativa; futuro; upsert por (dupla,numero); motivo se muda data; não toca realizado/nao_aconteceu (0072) |
| marcar_nao_aconteceu_mentorado | (encontro)→jsonb | jovem; encontro passado agendado → nao_aconteceu (0072) |
| desmarcar_encontro | (encontro)→jsonb | qualquer lado da dupla ou coord; delete só agendado futuro (0072) |
| conflito_encontro | (dupla,data_hora)→jsonb | encontros do mesmo jovem em outras duplas <1h (0072) |
| marcar_combinado | (id,feito)→void | jovem flipa encaminhamento responsavel='mentorado' pendente↔feito (0070) |
| set_contato_compartilhado | (bool)→void | jovem, opt-in de whatsapp no diretório (0076) |
| set_disponibilidade_mentorado | (jsonb)→void | jovem grava grade própria; normaliza/valida (0078→0100) |

### Avaliação de encontro (jovem)
| RPC | assinatura | notas |
|---|---|---|
| avaliacao_por_token | (text)→jsonb | público; contexto do encontro; identidade híbrida (0071) |
| submeter_avaliacao | (encontro,token?,estrelas,sentimento?,avancei?,temas?,comentario?,pedir_apoio?,visivel_mentor?)→jsonb | token OU sessão do jovem; encontro realizado; 1 avaliação/encontro; pedir_apoio → notif apoio_jovem coord+sup + destinatários p/ e-mail (0071→0084 integra chamado) |
| avaliacao_media_dpp | (dupla)→jsonb | média quantizada 0.5, liberada em lotes de 3; só mentor DPP da dupla (0071) |
| definir_visibilidade_avaliacao | (id,bool)→jsonb | toggle do jovem mostrar nota ao mentor DPP (0071) |
| registrar_email_apoio_avaliacao | (avaliacao,assunto,dest,env,falhas)→jsonb | log em emails_enviados p/ action Resend (0071) |

### Chamados (WP1)
| RPC | assinatura | notas |
|---|---|---|
| abrir_chamado | (categoria,descricao_outro,assunto,mensagem,dupla_id)→jsonb | qualquer autenticado ou jovem via ficha (0084→0090) |
| assumir_chamado | (id)→jsonb | equipe; primeiro a assumir leva (0084) |
| atribuir_chamado | (id,para)→jsonb | coord atribui a membro da equipe (0084) |
| devolver_chamado_fila | (id)→jsonb | devolve à fila (0084) |
| resolver_chamado | (id,resumo)→jsonb | resumo obrigatório; limpa flag de origem via `chamado_flag_sync` (0084) |
| reabrir_chamado | (id)→jsonb | equipe reabre (0084) |
| pedir_reabertura_chamado | (id)→jsonb | autor pede reabertura (0084) |
| publicar_atualizacao_chamado | (id,texto)→jsonb | mensagem pública da equipe (0084) |
| comentar_chamado | (id,texto,mencionar uuid[])→jsonb | comentário interno equipe + menções (0084) |
| acrescentar_info_chamado | (id,texto)→jsonb | autor acrescenta info (0084) |
| resolver_chamado_por_origem | (p_registro_id uuid=null, p_avaliacao_id uuid=null, p_resumo text=null)→void | coord-only; resolve chamado pela origem e limpa a flag na mesma tx via `chamado_flag_sync` (0084) |
| registrar_email_chamado | (chamado,assunto,dest,env,falhas)→jsonb | log de e-mail redundante (0084) |
| chamado_evento / _notifica_equipe / _notifica_autor | internos | helpers definer de trilha/notificação (0084) |
| eh_equipe | ()→bool | my_role/has_papel ∈ coord+supervisor (0084→0091) |
| chamado_visivel_equipe | (chamados)→bool | coord tudo; supervisor exceto 'plataforma' (0084→0091) |

### Terceiros / lembretes / misc
| RPC | assinatura | notas |
|---|---|---|
| terceiro_por_token | (text)→jsonb | público anon; estado do convite + expiração lazy (0103→0105) |
| submeter_resposta_terceiro | (token,pontos_fortes,a_melhorar)→jsonb | público; 1 resposta/convite; consome token (0103→0105) |
| reemitir_convite_terceiro | (contato_id)→jsonb | coord/mentor da dupla viva; renova token+prazo (0103→0105) |
| salvar_consolidado_terceiros | (dupla,consolidado,publicar?)→jsonb | mentor da dupla viva; síntese curada publicada (0103→0105) |
| enviar_lembrete | (dupla,destino?,titulo?,corpo?,href?)→jsonb | coord/supervisor/mentor-DPP escopado; cap 1 lembrete/dupla/48h; loga interacao 'in_app' + sino 'lembrete' (0094) |
| importar_registros | (itens jsonb)→jsonb | coord/service/postgres; upsert encontro born-realizado + registro creditando mentor; bypass `import_registros`+`no_notify`; relatório por item (0082) |
| definir_pdm_url | (dupla,url)→void | **DROPADA em 0098** junto com duplas.pdm_url |
| registrar_ia_evento | (canal,tool,args,ok,erro?,duracao?)→uuid | único write em ia_eventos; carimba my_profile_id (0083) |

### Triggers/funções internas (sem grant direto)
guard_autoria, guard_profiles_self_columns, guard_mentor_profile,
guard_registro_apoio, guard_avaliacao_encontro, guard_encontro_status,
guard_registro_encontro, guard_encontro_identidade, guard_notificacao_update,
guard_formulario_sistema, guard_signup_allowlist, guard_terceiros_cap,
stamp_* (solicitacao/encerramento/supervisao/presenca), handle_new_user,
sync_profile_email, check_mentor_capacidade, sync_formacao_ok,
assinatura_reflete_termo_ok, solicitacao_integridade, avaliacao_ao_realizar,
encontro_notifica_agenda, registro_apoio_chamado_sync,
avaliacao_apoio_chamado_sync, profile_papeis_{escopo_check,norm_primario,
projeta_role}, profiles_role_para_papeis, jornada_autoemit_{encontro,dupla},
jornada_expirar_links_encerrada, dupla_encerramento_auto, touch_updated_at,
nome_proprio, civis_btrim, areas_perfil_ok, interesses_ok, disponibilidade_ok,
normalizar_disponibilidade, trg_normalizar_disponibilidade,
encerramento_checklist_ok.

---

## 3. Catálogo de views (todas definer/owner + WHERE de papel)

| view | expõe | escopo |
|---|---|---|
| profiles_contato | id,email,whatsapp,documento_path(só coord) | coord tudo; self; supervisor→mentores das duplas supervisionadas ativas/pausadas (0026) |
| profiles_pessoal | id,nome,data_nascimento,genero,pref_genero_par,motivacao,dados_civis,cor_raca,form_bruto | coord-only (0034→0054) |
| mentorados_pessoal | idem + responsavel + contato_compartilhado | coord-only (0034→0076) |
| mentorados_curriculo | id,nome,curriculo_path,curriculo_url | coord OU supervisor→mentorados supervisionados (0081) |
| solicitacoes_mural | solicitação + mentorado_nome + especialista_nome + devolutiva_pdm + trilha_encerrada_em + status_efetivo (lazy expiry) | mesmo escopo do sol_select (0030→0087) |
| jovem_perfil | ficha completa do próprio mentorado (menos notas/documento_path/form_bruto) | my_role()='mentorado' ∧ id=my_mentorado_id() (0067→0076) |
| jovem_duplas | duplas do jovem + nomes/avatares dos adultos (sem devolutiva_pdm, sem pdm_url desde 0098, sem solicitacao_id/remanejada_de) | mentorado dono (0067→0098) |
| jovem_contatos | mentor(esp)/supervisor das duplas dele + coordenação: nome,social,avatar,whatsapp,email,role | mentorado (0067→0097; papel='especialista' na trilha esp) |
| jovem_assinaturas | assinaturas do mentorado + token/token_expira_em + slug/titulo | mentorado dono (0067→0070) |
| jovem_encaminhamentos | encaminhamentos responsavel='mentorado' das duplas dele | mentorado (0070) |
| jovem_especialistas | catálogo: id,nome,nome_social,avatar_path,areas,bio | mentorado; esp ativos com papel (GLOBAL desde 0101, sem escopo de turma) (0075→0101) |
| jovem_trilha_esp | numero,titulo,foco dos 5 passos | mentorado (0088) |
| mentorados_turma | colegas da turma (nome,social,avatar,cidade,uf,interesses,whatsapp se opt-in) | mentorado, só com profile_id e mesma turma (0076) |
| especialista_avaliacoes | estrelas por sessão da própria trilha esp (sem conteúdo identificável) | mentor_especialista dono (0071→0090) |
| chamados_fila | fila inteira p/ equipe, campos mascarados (null) em categoria='plataforma' p/ supervisor | eh_equipe() (0084) |

---

## 4. Enums

| enum | valores | origem |
|---|---|---|
| app_role | coordenacao, supervisor, mentor_dpp, mentor_especialista, **mentorado** (0066) | 0001/0066 |
| dupla_status | ativa, pausada, encerrada, **concluida** (0037) | 0001/0037 |
| encontro_status | agendado, realizado, remarcado, nao_aconteceu, cancelado | 0001 |
| encaminhamento_status | pendente, feito, atrasado | 0001 |

Domínios por CHECK (não enum): solicitacoes.status (8 valores, 0086);
solicitacoes.origem ('staff','jovem','mentor', 0086); comunicados.audiencia
(+equipe, 0019); chamados.categoria/status/origem (0084); mentorados.situacao
(0077); formularios.sistema (8 valores, 0104); ciclo_eventos.tipo (5 valores,
0062)/status; terceiros.vinculo/status (0103); notificacoes.tipo (30 valores,
0102); emails_enviados.tipo (0084); interacoes.canal (+in_app, 0094).

---

## 5. Buckets de storage

| bucket | público? | policies (verdade final) |
|---|---|---|
| `avatares` | **SIM** | select: pasta própria OU coord (0053); insert/update: pasta=profile_id ∧ ext png/jpg/webp ∧ mimetype imagem (0024→0053); delete: pasta própria; coord for all (0016→0053) |
| `materiais` | não | select: audiência do material espelha papel (0010→0065); insert: coord ∧ row materiais.path=name; update/delete: coord (0010) |
| `documentos` | não | select: coord ∧ (name=documento_path de profile/mentorado OU path de documentos_pessoa OU curriculo_path) — via views; + supervisor baixa só currículo de supervisionado (0081); + `sistema/%` legível a authenticated (0033); insert: coord ∧ mesma regra; update/delete: coord (0012→0081) |
| `registro-anexos` | não | select: escopo do registro (coord/mentor/supervisor) ∧ row path=name; insert: mentor da dupla ∧ row existe; delete: coord/mentor (0009→0020) |
| `chamado-anexos` | não | insert: quem vê o chamado ∧ (¬interno ∨ equipe); select: visibilidade do chamado ∧ interno→equipe; delete: **coord-only** (0084:1085) |

---

## 6. Verificações (SIM/NÃO/PARCIAL + evidência)

| Pergunta | Resp | Evidência |
|---|---|---|
| `duplas.dupla_dpp_id` existe? | **NÃO** — a coluna `dupla_dpp_id` mora em `solicitacoes_especialista` (0027:51; nullable desde 0074:40). `duplas` tem `solicitacao_id` apontando pra solicitação de origem (0027:11) | 0027, 0074 |
| Tabela `pdm`/`pdm_itens`/`metas`/`pdm_metas`? | **NÃO** — PDM é `formularios.sistema='pdm'` (seed 0080, id `5eed0001-…-06`), respostas em `formulario_respostas.respostas` jsonb. `duplas.pdm_url` existiu (0044) e foi **dropada em 0098** junto com `definir_pdm_url` | 0080, 0098 |
| `atividade_links`? | **NÃO** — atividades é `registros.atividades text[]` (0002) | 0002 |
| `turmas`/`programas`/`turma_inscricoes`/`profile_roles`? | **PARCIAL** — não há tabela `turmas`/`programas`/`turma_inscricoes`: turma é TEXT (`duplas.turma` 0061, `cronogramas.turma` 0061, `profile_papeis.escopo_turma` 0085). `cronogramas` é a entidade de calendário por turma (0061). Papéis multi-turma existem como **`profile_papeis`** (não `profile_roles`) — papel + escopo_turma + primario (0085) | 0061, 0085 |
| `resumo_links`/`relatorio_links`/`resumo_acessos`? | **NÃO** — não existe nada de resumo/relatório público por slug. Encerramento tem `resumo_jornada` (coluna, 0037) | — |
| `dupla_saude_snapshots`? | **NÃO** — semáforo é computado no app (`saudadeDaDupla`), nenhum snapshot persistido | — |
| `ia_eventos`? | **SIM** — tabela audit de tool-calls IA (canal chat/mcp, args, ok, latência); insert só via `registrar_ia_evento` sd (0083) | 0083 |
| `avaliacao_encontro` / avaliação do jovem por encontro? | **SIM** — `avaliacoes_encontro` (★1–5 + sentimento/avancei/temas/comentario/pedir_apoio/visibilidade) + `avaliacao_links` bearer por encontro realizado (0071); mentor DPP vê só média quantizada em lotes de 3 (`avaliacao_media_dpp`) ou avaliação com `avaliacao_visivel_mentor` | 0071, 0090/0098 |
| `rematch_dupla` existe? assinatura? | **SIM** — `rematch_dupla(p_dupla_id uuid, p_lado text, p_novo_id uuid, p_motivo text default null, p_registrar_nota boolean default true) returns uuid`, sd, coord-only, `p_lado ∈ ('mentor','mentorado')`; encerra antiga + cria herdeira com `remanejada_de`; versão final 0105 (emite §13 se trilha esp) | 0064→0105 |
| `encerrar_trilha_especialista` emite avaliação §13 + devolutiva? | **SIM** — assinatura `(p_dupla,p_tipo,p_motivo,p_devolutiva)` exige devolutiva_pdm 10–4000 (0037); desde 0104/0105 chama `emitir_avaliacao_esp` que minta `formulario_links` pro form `sistema='avaliacao_especialista'` (id `5eed0001-…-08`) + notificação `avaliacao_pendente` href `/f/<token>`, dedup por (form,dest,dupla). `avaliacao_esp_da_dupla(p_dupla)` lê o estado do link | 0104, 0105 |
| Suporte a auxiliar/supervisor por turma (vs por dupla)? | **PARCIAL** — supervisão é **por dupla** (`duplas.supervisor_id`, 0001). `profile_papeis.escopo_turma` existe como eixo de filtro secundário (0085: "só filtra, nunca amplia") mas nenhuma policy usa escopo pra CONCEDER supervisão por turma — `rematch_dupla` valida papel dpp escopado na turma (0091) e `has_papel` aceita escopo; atribuição auxiliar-por-turma não existe como conceito | 0001, 0085, 0091 |
| `formulario_campos` suporta quais `tipo`? | **NÃO existe tabela `formulario_campos`** — campos é jsonb em `formularios.campos` (0036). Tipos validados pela fronteira `formularios_limpa_respostas`: `texto, texto_longo, data, select, sim_nao, escala_1_5, escala_1_10, checkbox, multi_select` + `secao` (estrutural, 0080). **NÃO há** `arquivo`, `grid_disponibilidade`, `condicional` — tipos desconhecidos são descartados silenciosamente | 0036:167-253, 0080 |
| Histórico de remarcações append-only? | **NÃO** — remarcação é UPDATE de `encontros.data_hora` + sobrescrita de `motivo_reagendamento` (0011); sem tabela de histórico de agenda. Append-only existe só em `solicitacao_propostas` (contra-propostas esp, 0074) e logs (interacoes, emails_enviados, chamado_atualizacoes, ia_eventos) | 0011, 0074 |
| Fila de espera (tabela/conceito)? | **PARCIAL** — não há "fila de espera" de mentorados/vagas. Filas operacionais existem: `chamados` (fila de atendimento + view `chamados_fila`, 0084) e `solicitacoes_especialista.status='aguardando_coord'` (triagem, 0074) | 0084, 0074 |
| pg_cron/pg_net habilitados? jobs? | **NÃO** — nenhuma migration cria pg_cron/pg_net nem agenda jobs; comentário 0074:25 confirma "pg_cron não existe em prod". Extensões: só `pgcrypto` (0001:1, 0053:132). Expirações são **lazy** (leitura marca 'expirado': assinaturas, avaliacao_links, terceiros, status_efetivo do mural) | 0074, 0001, 0053 |
| `mentorados` vs `profiles` — identidade do jovem HOJE? | **AMBOS** — `mentorados` é a identidade de participação (duplas/forms/anexos penduram nela). Login real existe quando `mentorados.profile_id → profiles` (unique, nullable, 0066) e `profiles.role='mentorado'` (enum 0066). Resolução: `my_mentorado_id()` via profile_id. Sem conta: links tokenizados (`formulario_links.dest_mentorado_id`, `avaliacao_links`, `assinaturas.token`, `terceiros_contatos.token`) com **identidade híbrida**: autenticado ≠ destinatário é recusado (0070); `respondido_por_profile_id` audita quem respondeu logado | 0066–0070 |

---

## 7. Migrations órfãs / gaps / campos mortos

- **0039 não existe** — sequência pula 0038→0040 (provável renumeração; sem arquivo).
- **`duplas.pdm_url` (0044) + `definir_pdm_url` — mortos**: coluna e RPC dropadas em 0098 (PDM virou instrumento nativo `sistema='pdm'`).
- **`encontro_status 'remarcado'` e 'cancelado'`**: reservados no enum mas o modelo usa UPDATE/DELETE + `motivo_reagendamento` (0072:299 "cancelado/remarcado seguem reservados"); `'remarcado'` ainda é contado como "vivo" em slots/budget (0073:182, 0074:543).
- **`encaminhamento_status 'atrasado'`**: valor fantasma — nunca gravado; vencido deriva de prazo na UI (0070:12).
- **`assinaturas.token` expõe-se ao jovem via `jovem_assinaturas`** (0070) — decisão deliberada (jovem encaminha a autorização ao responsável).
- **`documento_path` legado coexiste com assinaturas**: termo em papel ainda marca `termo_ok` (0033→0052).
- **`pessoa_notas` select/delete = só autor** (0017): coord não lê nem apaga notas alheias — "caderneta privada" por decisão.
- **`formularios.campos` sem tabela-filha**: edição de campos em form comum é jsonb livre via coord; respostas antigas dependem de `versao`.
- **`supervisoes` sem update**: correção = delete+re-registro (0041).
- **`guard_terceiros_cap` (0103/0105)**: trigger sem schema-qualified em `search_path=''` — verificar ambiente se algo falhar.
- **`handle_new_user` reescrito em 0085**: no 1º login além de vincular `user_id` (por lower(email)) também **espelha o papel** em `profile_papeis` (insere primário global quando role ≠ null).
- **`emails_enviados.tipo` não é granular**: tipo 'chamado' único cobre urgência e origem jovem (0084:1054) — a RPC devolve os destinatários, mas o log não distingue.
- **Nenhum backup de encontros deletados**: `desmarcar_encontro` faz DELETE físico de agendados futuros (0072) — rastro só via notificação encontro_desfeito.
- **`profiles.role` write direto ainda permitido** (reinterpetação como primário global, 0085) — legado por design até migração dos consumidores pra `my_papeis()`/`has_papel()`.
