export type AppRole =
  | "coordenacao"
  | "supervisor"
  | "mentor_dpp"
  | "mentor_especialista"
  | "mentorado";
/** 'concluida' (0037) = jornada percorrida até o fim; 'encerrada' = fechamento
 *  antecipado. Ambas liberam a vaga e congelam a trilha como a encerrada. */
export type DuplaStatus = "ativa" | "pausada" | "concluida" | "encerrada";
export type Trilha = "dpp" | "especialista";
export type EncontroStatus = "agendado" | "realizado" | "remarcado" | "nao_aconteceu" | "cancelado";
export type EncaminhamentoStatus = "pendente" | "feito" | "atrasado";
export type AvaliacaoJovem = "excelente" | "boa" | "regular" | "baixa";
export type Dificuldade =
  | "nenhuma"
  | "aprendizagem"
  | "participacao"
  | "comportamental"
  | "organizacao"
  | "outro";
export type ProximoPasso =
  | "continuar"
  | "reforcar"
  | "novo_feedback"
  | "acompanhar_de_perto"
  | "conversa_individual"
  | "outro";

// ---------- matching/cadastro (0034) ----------

export type Genero =
  | "feminino"
  | "masculino"
  | "nao_binario"
  | "outro"
  | "prefiro_nao_dizer";
export type PrefGeneroPar = "feminino" | "masculino" | "indiferente";
export type Escolaridade =
  | "fundamental"
  | "medio"
  | "tecnico"
  | "superior_incompleto"
  | "superior"
  | "pos";
/** Autodeclaração de cor/raça (0054) — vocabulário do CHECK cor_raca_check.
 *  Sensível: coord-only via *_pessoal, fora do grant de authenticated. */
export type CorRaca =
  | "branca"
  | "negra"
  | "parda"
  | "amarela"
  | "indigena"
  | "outro"
  | "prefiro_nao_dizer";
export type DiaSemana = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";
export type Periodo = "manha" | "tarde" | "noite";

/** Grade semanal do mentor — mentor_profiles.disponibilidade (jsonb com
 *  CHECK no banco: só essas chaves e vocabulário fechado). */
export type Disponibilidade = { dias: DiaSemana[]; periodos: Periodo[] };

export type Profile = {
  id: string;
  user_id: string | null;
  nome: string;
  email: string;
  whatsapp: string | null;
  role: AppRole | null;
  ativo: boolean;
  /** Carimbo de criação do cadastro — vem em PROFILE_COLS_PUBLICAS; opcional
   *  porque fontes sem a coluna existem (personas demo, selects parciais). */
  created_at?: string;
  /** Foto no bucket público `avatares` (<profile_id>/<arquivo>.<ext>) — fallback de exibição: Gravatar do e-mail → iniciais. */
  avatar_path?: string | null;
  /** Documento oficial no bucket `documentos` (termo de responsabilidade) — só a coordenação vê e gerencia. */
  documento_path?: string | null;
  /** Apresentação profissional (0030) — legível por qualquer autenticado,
   *  editável pelo próprio dono e pela coordenação. */
  bio: string | null;
  linkedin: string | null;
  areas: string[] | null;
  voluntariado: string | null;
  /** Marca do onboarding por papel (0031) — null = ainda não viu o wizard;
   *  o gate no layout do app lê este campo. */
  onboarded_em: string | null;
  // ---------- matching/cadastro (0034) ----------
  // opcionais como avatar_path/documento_path: selects parciais ainda não
  // trazem essas colunas (a 0026 restringe SELECT por grant de coluna)
  /** Nome social — quando presente é o nome de uso; `nome` segue o civil. */
  nome_social?: string | null;
  /** "YYYY-MM-DD". Sensível: fora do grant de authenticated — coordenação lê
   *  pela view profiles_pessoal. */
  data_nascimento?: string | null;
  /** Sensível (profiles_pessoal). */
  genero?: Genero | null;
  cidade?: string | null;
  /** Sigla maiúscula ("SP") — CHECK no banco. */
  uf?: string | null;
  interesses?: string[];
  /** Sensível (profiles_pessoal). */
  motivacao?: string | null;
  /** Preferência de gênero do par. Sensível (profiles_pessoal). */
  pref_genero_par?: PrefGeneroPar | null;
  cargo?: string | null;
  empresa?: string | null;
  /** Como a pessoa chegou ao programa (texto livre — sem enum). */
  origem?: string | null;
  /** Carimbo do consentimento LGPD no cadastro. */
  consent_lgpd_em?: string | null;
  /** Dados civis pra documentos (0046): RG/CPF/endereço extraídos uma vez —
   *  planilha ou cadastro — e o termo preenche sozinho. Sensível: fora do
   *  grant de SELECT — coordenação lê/edita por profiles_pessoal, o próprio
   *  signatário lê via RPC meus_dados_civis. */
  dados_civis?: DadosCivis | null;
  /** Autodeclaração de cor/raça do intake (0054). Sensível (profiles_pessoal). */
  cor_raca?: CorRaca | null;
  /** Payload integral da resposta do form de inscrição (0054) — arquivo
   *  morto do intake; nem o dono edita (guard_profiles_self_columns).
   *  Sensível (profiles_pessoal). */
  form_bruto?: Record<string, unknown> | null;
};

export type Mentorado = {
  id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  ong_origem: string | null;
  notas: string | null;
  /** Foto no bucket público `avatares` — sem ela, Avatar cai nas iniciais amarelas. */
  avatar_path?: string | null;
  /** Documento oficial no bucket `documentos` (autorização do responsável) — só a coordenação vê e gerencia. */
  documento_path?: string | null;
  // ---------- matching/cadastro (0034) — mesma regra de opcionalidade do
  // Profile: selects parciais não trazem essas colunas ainda ----------
  nome_social?: string | null;
  /** "YYYY-MM-DD". Sensível: fora do grant de authenticated — coordenação lê
   *  pela view mentorados_pessoal. */
  data_nascimento?: string | null;
  /** Sensível (mentorados_pessoal). */
  genero?: Genero | null;
  cidade?: string | null;
  uf?: string | null;
  interesses?: string[];
  /** Sensível (mentorados_pessoal). */
  motivacao?: string | null;
  /** Sensível (mentorados_pessoal). */
  pref_genero_par?: PrefGeneroPar | null;
  objetivos?: string | null;
  escolaridade?: Escolaridade | null;
  origem?: string | null;
  /** Grade semanal {dias,periodos} (0038) — insumo do matching, mesma forma
   *  da de mentor_profiles. */
  disponibilidade?: Disponibilidade | null;
  /** Dados civis do(a) jovem pro termo de participação (0046). Sensível —
   *  coordenação via mentorados_pessoal; signatário via token RPC. */
  dados_civis?: DadosCivis | null;
  /** Responsável legal do(a) menor — quem assina a autorização (0046).
   *  Sensível, mesma regra de dados_civis. */
  responsavel?: ResponsavelCivis | null;
  /** Autodeclaração de cor/raça do intake (0054). Sensível (mentorados_pessoal). */
  cor_raca?: CorRaca | null;
  /** Payload integral da resposta do form de inscrição (0054).
   *  Sensível (mentorados_pessoal). */
  form_bruto?: Record<string, unknown> | null;
  /** Carimbo de criação do cadastro — vem em MENTORADO_COLS_PUBLICAS;
   *  opcional como o de Profile (selects parciais/personas demo podem
   *  não trazer). Base da "espera" da fila quando o intake não tem carimbo. */
  created_at?: string;
  /** Vínculo com o login do jovem (0066) — `profiles.id` da conta com
   *  role='mentorado'. null = participante sem acesso à plataforma. */
  profile_id?: string | null;
  /** Opt-in colega↔colega (0076): ligado, o WhatsApp do cadastro aparece
   *  aos colegas de turma com conta (view mentorados_turma). O dono do
   *  toggle é o próprio jovem (RPC set_contato_compartilhado). */
  contato_compartilhado?: boolean;
};

/** O mentorado dentro de uma dupla (embed do DUPLA_SELECT) — só o que o
 *  par e a ficha consomem. O select completo (notas/documento_path/
 *  ficha de matching) é coord-only e segue em getMentorados/getPessoaPerfil. */
export type MentoradoPar = Pick<
  Mentorado,
  | "id"
  | "nome"
  | "nome_social"
  | "avatar_path"
  | "whatsapp"
  | "email"
  | "ong_origem"
  | "cidade"
  | "uf"
  | "interesses"
>;

/** mentor_profiles — ficha do mentor que alimenta o board de matching
 *  (tipo canônico; queries.ts ainda tem um local com o subconjunto do board). */
export type MentorProfile = {
  profile_id: string;
  tipo: "dpp" | "especialista";
  areas: string[];
  /** Pool da trilha DPP (0073 — antes era a única capacidade). */
  capacidade: number;
  /** Pool da trilha especialista — separado do DPP (0073). */
  capacidade_especialista?: number;
  termo_ok: boolean;
  formacao_ok: boolean;
  // ---------- matching (0034) — opcionais: o select do board ainda não
  // traz essas colunas ----------
  experiencia_previa?: string | null;
  formacao_externa?: string | null;
  disponibilidade?: Disponibilidade | null;
};

/** Nota individual no mural do perfil (/pessoas/[id]) — de profile OU mentorado. */
export type PessoaNota = {
  id: string;
  profile_id: string | null;
  mentorado_id: string | null;
  texto: string;
  created_by: string | null;
  created_at: string;
  autor?: { id: string; nome: string; avatar_path?: string | null; email?: string | null } | null;
};

/** Cronograma — o calendário oficial de uma turma (0061). Antes era o texto
 *  `ciclo` solto: com duas turmas ao mesmo tempo, o semáforo misturava os
 *  calendários. A identidade de um encontro oficial é (cronograma_id, numero). */
export type Cronograma = {
  id: string;
  nome: string;
  /** Label da turma ("2026/2027" até a entidade turma chegar na F3). */
  turma: string;
  trilha: "dpp";
  inicio_em: string | null;
  fim_em: string | null;
  encontros_esperados: number | null;
  status: "rascunho" | "ativo" | "encerrado";
  created_by: string | null;
  created_at: string;
};

/** Evento do cronograma oficial (0062) — não é mais "só data": o PDF tem 4
 *  seções (preparação, mentoria ativa, encerramento, observações) e a ordem
 *  canônica é `ordem`, não a data. `data` nullable: etapa de preparação
 *  entregue pela ONG parceira é "Concluída", sem dia (CHECK no banco só
 *  permite data null pra etapa_preparacao concluída). */
export type CicloEvento = {
  id: string;
  /** FK pro cronograma dono do evento (0061) — substitui o texto `ciclo`. */
  cronograma_id: string;
  tipo:
    | "etapa_preparacao"
    | "encontro"
    | "recesso"
    | "evento_encerramento"
    | "formacao";
  numero: number | null;
  /** "YYYY-MM-DD" ou null — só etapa_preparacao concluída fica sem data. */
  data: string | null;
  data_fim: string | null;
  /** Semântica viva só em etapa_preparacao; demais tipos ficam 'pendente'. */
  status: "pendente" | "concluida";
  /** Nota operacional do PDF ("Reposição na mesma semana", "Encontro duplo"). */
  observacao: string | null;
  /** Chave de ordenação única do cronograma — sequência do PDF, não da data. */
  ordem: number;
  titulo: string;
  fase: string | null;
  instrumentos: string[];
};

/** Chamada da coordenação num evento do ciclo (0040) — hoje só os encontros
 *  de formação usam. `presente=false` é ausência explícita, não falta de row;
 *  cobertura total nas 'formacao' do ciclo acende mentor_profiles.formacao_ok
 *  via trigger (só marca — exceção manual da coordenação nunca é desfeita). */
export type Presenca = {
  id: string;
  ciclo_evento_id: string;
  profile_id: string;
  presente: boolean;
  marcado_por: string | null;
  marcado_em: string | null;
};

export type Encaminhamento = {
  id: string;
  dupla_id: string;
  registro_id: string | null;
  descricao: string;
  responsavel: "mentor" | "mentorado";
  prazo: string | null;
  status: EncaminhamentoStatus;
  created_at: string;
};

export type Registro = {
  id: string;
  encontro_id: string;
  tema: string | null;
  ferramenta: string | null;
  reflexoes: string | null;
  observacoes: string | null;
  precisa_apoio: boolean;
  atividades: string[];
  avaliacao: AvaliacaoJovem | null;
  dificuldade: Dificuldade | null;
  dificuldade_detalhe: string | null;
  proximo_passo: ProximoPasso | null;
  proximo_passo_detalhe: string | null;
  created_by: string | null;
  created_at: string;
  /** Autor do registro — só vem no embed `autor:profiles!registros_created_by_fkey(nome)` da dupla. */
  autor?: { nome: string } | null;
};

// ---------- avaliação do encontro FEITA PELO JOVEM (0071 / D4) ----------
// Não confundir: `registros.avaliacao` (4-pt, do mentor), `avaliacao_360`
// (forms engine) e esta (estrelas 1-5, do jovem) são três escalas que não
// se misturam — AvaliacaoJovem já era o nome da escala do mentor.

/** "Você sente que avançou?" — o CHECK do banco fecha o vocabulário. */
export type AvanceiAvaliacao = "sim" | "um_pouco" | "nao";

/** Linha de `avaliacoes_encontro` — a nota do jovem por encontro realizado.
 *  O que cada papel recebe é a RLS (0071): coord/sup lêem tudo da dupla,
 *  o jovem as próprias, o mentor DPP só as que ele autorizou ver. */
export type AvaliacaoEncontro = {
  id: string;
  dupla_id: string;
  encontro_id: string;
  estrelas: number;
  /** Chave do SENTIMENTO_AVALIACAO (ou texto legado) — opcional no form. */
  sentimento: string | null;
  avancei: AvanceiAvaliacao | null;
  /** Chaves do TEMA_AVALIACAO — o que a dupla conversou. */
  temas: string[] | null;
  comentario: string | null;
  /** Canal de segurança: coord+sup são notificados e só a coord resolve. */
  pedir_apoio: boolean;
  /** O jovem liberou o mentor DPP ler esta avaliação específica. */
  avaliacao_visivel_mentor: boolean;
  /** null = resposta anônima por token (jovem sem login). */
  respondido_por_profile_id: string | null;
  created_at: string;
};

/** Link tokenizado do encontro — o canal do jovem sem login (WhatsApp via
 *  coord). A RLS expõe a tabela só pra coordenação. */
export type AvaliacaoLink = {
  id: string;
  token: string;
  encontro_id: string;
  dupla_id: string;
  status: "pendente" | "respondido" | "expirado";
  expira_em: string;
  respondido_em: string | null;
  /** Profile que respondeu por este link (null = jovem sem login — o
   *  token sozinho é a identidade). Trilha de auditoria da RPC. */
  respondido_por_profile_id: string | null;
  created_at: string;
};

/** Linha da view `especialista_avaliacoes` (0071): o especialista vê SÓ as
 *  estrelas das próprias sessões — nada de comentário/sentimento/temas
 *  (com 1 avaliador, conteúdo identifica → autocensura + retaliação). */
export type EspecialistaAvaliacao = {
  id: string;
  dupla_id: string;
  encontro_id: string;
  estrelas: number;
  numero: number;
  realizado_em: string | null;
  created_at: string;
};

/** Evidência anexada a um registro (foto do PDM, Roda da Vida) — arquivo no bucket `registro-anexos`. */
export type RegistroAnexo = {
  id: string;
  registro_id: string;
  path: string;
  nome: string;
  tamanho: number | null;
  mime: string | null;
  created_by: string | null;
  created_at: string;
  /** Autor do anexo — só vem no embed `autor:profiles!registro_anexos_created_by_fkey(nome)`. */
  autor?: { nome: string } | null;
};

export type Encontro = {
  id: string;
  dupla_id: string;
  numero: number;
  data_hora: string | null;
  /** Quando aconteceu de fato (registro retroativo); igual a data_hora quando coincidem. */
  realizado_em: string | null;
  duracao_min: number;
  status: EncontroStatus;
  origem: "plataforma" | "externo";
  link: string | null;
  /** Por que a dupla remarcou (label do preset ou texto livre) — só escrito quando a data muda. */
  motivo_reagendamento: string | null;
  registro?: Registro | null;
  /** Estrela do JOVEM sobre este encontro (0071) — embed to-one no select da
   *  dupla. O RLS decide quem a vê: coord/sup sempre, mentor DPP só quando o
   *  jovem autorizou, especialista nunca por aqui (a view dele é estrelas). */
  avaliacao_jovem?: AvaliacaoEncontro | null;
};

/** Anotação/plano de aula do mentor — chave (dupla_id, numero), não FK de
 *  encontros: existe antes do agendamento e segue o nº na remarcação. */
export type EncontroNota = {
  id: string;
  dupla_id: string;
  numero: number;
  texto: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Dupla = {
  id: string;
  /** Label da turma (ex-coluna `ciclo`, renomeada na 0061) — derivada do
   *  cronograma no cadastro; mantida na row pra leitura barata e legado. */
  turma: string;
  /** O calendário oficial contra o qual a dupla corre (0061). Null =
   *  especialista (trilha livre, sem calendário) ou histórica antiga. */
  cronograma_id: string | null;
  status: DuplaStatus;
  iniciada_em: string | null;
  /** "dpp" = trilha de 16 encontros; "especialista" = trilha de 5 (sem datas fixas). */
  trilha: Trilha;
  /** Demanda registrada pelo mentor DPP que originou a dupla de especialista. */
  demanda: string | null;
  /** Solicitação que originou a dupla de especialista (null nas DPP). */
  solicitacao_id: string | null;
  /** Link do PDM do mentorado (0044) — https obrigatório quando preenchido. */
  pdm_url?: string | null;
  /** Dupla encerrada que esta substituiu num remanejamento (0063) —
   *  null = dupla original, sem linhagem. */
  remanejada_de?: string | null;
  // ---------- fechamento da trilha especialista (0037) — só trilha =
  // 'especialista' carrega esses campos (CHECK duplas_encerramento_esp) ----------
  /** Carimbo do fechamento da trilha — null enquanto a trilha não fechou. */
  encerrada_em?: string | null;
  /** Por que a trilha fechou (obrigatório junto com encerrada_em). */
  motivo_encerramento?: string | null;
  /** O que a trilha devolve pro PDM — chega ao mentor DPP via solicitacoes_mural. */
  devolutiva_pdm?: string | null;
  mentor: Profile;
  mentorado: MentoradoPar;
  supervisor: Profile | null;
  encontros: Encontro[];
  encaminhamentos: Encaminhamento[];
  notas?: EncontroNota[];
};

/** Versão enxuta de Dupla — só os ids de vínculo, sem a árvore de encontros. */
export type DuplaResumo = {
  id: string;
  mentor_id: string;
  mentorado_id: string;
  supervisor_id: string | null;
};

export type Material = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: "guia" | "template" | "conteudo" | "link";
  url: string | null;
  /** Arquivo oficial no bucket `materiais` — quando presente, é o destino (a url não é usada). */
  path: string | null;
  audiencia: "todos" | "dpp" | "especialista" | "coordenacao";
  encontro_num: number | null;
  ordem: number;
};

export type ComunicadoAudiencia =
  | "todos"
  | "dpp"
  | "especialista"
  | "coordenacao"
  | "equipe";

export type ComunicadoPrioridade = "normal" | "importante" | "urgente";

export type Comunicado = {
  id: string;
  titulo: string;
  corpo: string;
  audiencia: ComunicadoAudiencia;
  /** 'normal' some na lista; 'importante'/'urgente' ganham rail, ícone e badge. */
  prioridade: ComunicadoPrioridade;
  created_by: string;
  created_at: string;
  autor?: { nome: string } | null;
};

export type Notificacao = {
  id: string;
  /** Os 4 originais (0018) + os 4 do fluxo de especialista (0028) +
   *  trilha_encerrada (0037) + supervisao_registrada (0041) +
   *  formulario_respondido (0042, inserido pela RPC de submit) +
   *  avaliacao_pendente/apoio_jovem (0071, trigger + RPC de avaliação) +
   *  os 3 de agenda bilateral (0072, trigger encontros_agenda_notify) —
   *  espelha o CHECK notificacoes_tipo_check. */
  tipo:
    | "comunicado"
    | "pedido_apoio"
    | "apoio_resolvido"
    | "dupla_formada"
    | "demanda_especialista"
    | "solicitacao_registrada"
    | "especialista_aceitou"
    | "solicitacao_cancelada"
    | "trilha_encerrada"
    | "supervisao_registrada"
    | "formulario_respondido"
    | "avaliacao_pendente"
    | "apoio_jovem"
    | "encontro_marcado"
    | "encontro_alterado"
    | "encontro_desfeito"
    | "solicitacao_triagem"
    | "solicitacao_proposta"
    | "solicitacao_recusada";
  titulo: string;
  corpo: string | null;
  href: string | null;
  lida_em: string | null;
  created_at: string;
};

// ---------- trilha de especialista (0027) ----------

/** Os 5 encontros do guia do especialista — sem data fixa, o especialista agenda. */
export type EspecialistaEvento = {
  numero: number;
  titulo: string;
  foco: string | null;
};

/** Máquina de estados da solicitação v2 (0074). "Em aberto" pra dedup e CTAs
 *  = as três primeiras — uma negociação em curso ainda ocupa o pedido. */
export type SolicitacaoEspecialistaStatus =
  | "aberta"
  | "aguardando_coord"
  | "contra_proposta"
  | "aceita"
  | "recusada"
  | "cancelada"
  | "expirada";

/** Demanda de especialista — pedido por sessão (0074): nasce do mentor
 *  DPP/coord (`origem` staff) ou do próprio jovem, e vira um encontro quando
 *  um especialista aceita um horário. `dupla_id` aponta pra dupla já formada
 *  quando o pedido é de sessão seguinte. */
export type SolicitacaoEspecialista = {
  id: string;
  mentorado_id: string;
  /** Dupla DPP de origem — null no pedido que o jovem abre sem dupla DPP
   *  (entra aguardando_coord; a triagem da coordenação define a turma). */
  dupla_dpp_id: string | null;
  /** O porquê da trilha (gate) — null nos pedidos do jovem (que trazem
   *  `motivo`) e nos pedidos de sessão seguinte de dupla já formada. */
  demanda: string | null;
  /** Motivo curto do pedido do jovem (0074) — convive com `demanda`. */
  motivo: string | null;
  /** Horário proposto na mesa — o do pedido do jovem ou o da última
   *  contra-proposta; o histórico completo mora em solicitacao_propostas. */
  slot_proposto: string | null;
  /** Quem abriu o pedido: staff (mentor DPP/coord) ou o próprio jovem. */
  origem: "staff" | "jovem";
  /** Turma da sessão — a da dupla DPP ou a definida na triagem. */
  turma: string | null;
  /** Por que o especialista recusou (0074) — obrigatória na recusa. */
  justificativa_recusa: string | null;
  especialista_desejado_id: string | null;
  especialista_id: string | null;
  dupla_id: string | null;
  status: SolicitacaoEspecialistaStatus;
  /** Status com a expiração lazy aplicada (view, 0074): pedido ou proposta
   *  pendente com o slot no passado lê 'expirada' sem writer rodando. */
  status_efetivo?: SolicitacaoEspecialistaStatus;
  created_by: string | null;
  created_at: string;
  respondida_em: string | null;
  // embeds quando selecionados:
  mentorado?: { nome: string } | null;
  solicitante?: { nome: string } | null;
  especialista?: { nome: string } | null;
  /** Nome de quem recebeu o pedido direcionado — embed de profiles via
   *  especialista_desejado_id (null = broadcast pra todo especialista). */
  desejado?: { nome: string } | null;
  /** Nome do especialista engajado — coluna plana da view (0074); fallback
   *  quando o embed de profiles não resolve. */
  especialista_nome?: string | null;
  // ---------- colunas do mural (0037) — vêm da dupla de especialista
  // via join na view; null enquanto a trilha não fechou ----------
  /** O que a trilha devolveu pro PDM do jovem — o mentor DPP lê aqui. */
  devolutiva_pdm?: string | null;
  /** Quando a trilha de especialista fechou (dupla.encerrada_em). */
  trilha_encerrada_em?: string | null;
};

/** Uma rodada da negociação de horário (0074) — append-only: as RPCs
 *  contra_propor/aceitar escrevem, as partes e a coordenação leem. */
export type SolicitacaoProposta = {
  id: string;
  solicitacao_id: string;
  autor_id: string;
  slot_proposto: string;
  mensagem: string | null;
  created_at: string;
  /** embed de profiles via autor_id — quem falou por último na negociação. */
  autor?: { nome: string } | null;
};

// ---------- agenda real do especialista (0073) ----------

/** Janela semanal recorrente da agenda do especialista — `dia_semana` é o
 *  dow do Postgres (0=domingo … 6=sábado) e as horas são `time` de
 *  Brasília ("HH:mm:ss" como o PostgREST devolve). */
export type GradeJanela = {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
};

/** Exceção datada da grade: `bloqueio` rasga a disponibilidade no dia
 *  (viagem, prova), `extra` abre uma janela fora dela (sábado avulso). */
export type ExcecaoEspecialista = {
  id: string;
  /** "YYYY-MM-DD" — dia de Brasília a que a exceção se aplica. */
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: "bloqueio" | "extra";
};

// ---------- supervisão (0041) ----------

/** Sessão de supervisão (supervisor ↔ mentor) — o ritual de acompanhamento
 *  do guia. dupla_id null = sessão geral, não atada a uma dupla. O mentor
 *  lê data e resumo das sessões sobre ele (decisão de transparência —
 *  ver 0041); a coordenação lê tudo e modera (só ela apaga). */
export type Supervisao = {
  id: string;
  supervisor_id: string;
  mentor_id: string;
  dupla_id: string | null;
  /** "YYYY-MM-DD" — dia em que a sessão aconteceu (não o do registro). */
  data: string;
  resumo: string;
  created_by: string | null;
  created_at: string;
  // embeds quando selecionados:
  supervisor?: { id: string; nome: string } | null;
  mentor?: { id: string; nome: string } | null;
  dupla?: { id: string; mentorado: { nome: string } | null } | null;
};

// ---------- fechamento do ciclo (0037) ----------

/** As 5 chaves do rito de fechamento (guia DPP) — vocabulário fechado,
 *  espelha o CHECK encerramento_checklist_ok. */
export type EncerramentoChecklist = {
  feedback_final?: boolean;
  feedback_mutuo?: boolean;
  revisao_pdm?: boolean;
  avaliacao_360_enviada?: boolean;
  autoavaliacao?: boolean;
};

/** Fechamento de uma dupla DPP — a row pode nascer antes da decisão, só com
 *  a autoavaliação do mentor (tipo/decidido_por null = fechamento pendente). */
export type Encerramento = {
  id: string;
  dupla_id: string;
  /** 'concluida' = jornada completa · 'encerrada' = fechamento antecipado ·
   *  null = só a autoavaliação do mentor chegou, decisão pendente. */
  tipo: "concluida" | "encerrada" | null;
  checklist: EncerramentoChecklist;
  autoavaliacao_mentor: string | null;
  /** Disponibilidade do mentor pro próximo ciclo — registrada na autoavaliação. */
  disponivel_proximo_ciclo: boolean | null;
  /** Snapshot gerado dos dados da jornada no momento do fechamento. */
  resumo_jornada: string | null;
  decidido_por: string | null;
  created_at: string;
  /** embed `decidido:profiles!encerramentos_decidido_por_fkey(nome)`. */
  decidido?: { nome: string } | null;
};

// ---------- documentos & assinaturas (0033) ----------

export type SignatarioTipo = "profile" | "mentorado";

export type AssinaturaStatus = "pendente" | "assinado" | "revogado" | "expirado";

/** Metadados do documento — o corpo é renderizado em código por slug. */
export type DocumentoTemplate = {
  id: string;
  slug: string;
  titulo: string;
  versao: number;
  signatario: SignatarioTipo;
  ativo: boolean;
  created_at: string;
};

export type Endereco = {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
};

/** Dados civis capturados no ato da assinatura — imutável, vive no snapshot
 *  (não em profiles, que é legível por qualquer autenticado). No prefill da
 *  ficha os campos podem ser null — o que falta é exigido na assinatura. */
export type DadosCivis = {
  nome_civil: string | null;
  rg: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  endereco: Endereco;
};

/** Responsável legal no cadastro do mentorado (0046) — mesmo shape que o
 *  snapshot da autorização guarda. */
export type ResponsavelCivis = DadosCivis & { parentesco: string | null };

/** Snapshot da autorização: quem é o jovem + dados civis do responsável. */
export type DadosAutorizacao = {
  mentorado_nome: string;
  responsavel: ResponsavelCivis;
};

export type Assinatura = {
  id: string;
  template_id: string;
  profile_id: string | null;
  mentorado_id: string | null;
  status: AssinaturaStatus;
  dados_snapshot: DadosCivis | DadosAutorizacao | null;
  token: string;
  token_expira_em: string | null;
  assinatura_texto: string | null;
  assinado_em: string | null;
  ip: string | null;
  user_agent: string | null;
  hash_documento: string | null;
  created_by: string | null;
  created_at: string;
  // embed quando selecionado:
  template?: Pick<
    DocumentoTemplate,
    "slug" | "titulo" | "versao" | "signatario"
  > | null;
};

/** Via pública por token — a RPC assinatura_completa_por_token (0053)
 *  devolve só este recorte da row: o que o PDF de evidências renderiza.
 *  Token, ids internos e created_by não saem do banco. */
export type AssinaturaVia = Pick<
  Assinatura,
  | "id"
  | "status"
  | "dados_snapshot"
  | "assinatura_texto"
  | "assinado_em"
  | "ip"
  | "user_agent"
  | "hash_documento"
> & { template?: Assinatura["template"] };

/** Resumo leve de uma assinatura — status por documento/pessoa pra aba
 *  /pessoas (quem assinou vs. quem não) sem carregar snapshot nem token. */
export type AssinaturaResumo = {
  id: string;
  profile_id: string | null;
  mentorado_id: string | null;
  status: AssinaturaStatus;
  assinado_em: string | null;
  /** prazo do link pendente — sem ele "enviada" pode ser link morto */
  token_expira_em: string | null;
  slug: string;
};

/** Documento do intake (RG, comprovante, currículo...) — documentos_pessoa
 *  (0054): N por pessoa, arquivo no bucket privado `documentos`, coord-only
 *  ponta a ponta (RLS + policy de storage pelo path). */
export type DocumentoPessoa = {
  id: string;
  profile_id: string | null;
  mentorado_id: string | null;
  tipo:
    | "rg"
    | "cpf"
    | "comprovante_residencia"
    | "comprovante_bancario"
    | "curriculo"
    | "outro";
  path: string;
  /** Nome original do arquivo no upload. */
  nome: string | null;
  created_by: string | null;
  created_at: string;
};

// ---------- /jovem (REALIZA-107/108) ----------
// Rows das views definer do jovem (0067/0070) — as únicas leituras de
// domínio que o papel mentorado faz fora de tabelas abertas (encontros,
// materiais, comunicados, notificacoes). Espelho 1:1 das colunas geradas
// em database.types.ts: todas nullable porque a view não declara NOT NULL.

import type { Database } from "./database.types";

/** Ficha do próprio jovem (view `jovem_perfil`) — mentorados.* do registro
 *  dele: programa (objetivos/escolaridade/ong) e contato do cadastro. Pessoa
 *  canônica segue em profiles; dados sensíveis (dados_civis/responsavel)
 *  chegam por aqui porque a view é definer e self-scoped. */
export type JovemPerfil = Database["public"]["Views"]["jovem_perfil"]["Row"];

/** Dupla do jovem (view `jovem_duplas`) — sem devolutiva_pdm nem nada de
 *  staff; mentor/supervisor vêm denormalizados (nome/social/avatar). */
export type JovemDupla = Database["public"]["Views"]["jovem_duplas"]["Row"];

/** Adulto de contato do jovem (view `jovem_contatos`) — mentor/supervisor
 *  das próprias duplas + coordenação. `papel` é o rótulo de exibição. */
export type JovemContato = Database["public"]["Views"]["jovem_contatos"]["Row"];

/** Combinado do jovem (view `jovem_encaminhamentos`, 0070) — o
 *  encaminhamento onde ele é o responsável; escrita só via
 *  marcar_combinado (pendente↔feito). */
export type JovemEncaminhamento =
  Database["public"]["Views"]["jovem_encaminhamentos"]["Row"];

/** Documento do jovem pra assinar/encaminhar (view `jovem_assinaturas`,
 *  0070) — token só pra formar o link /assinar/[token]; evidências
 *  (ip/ua/hash/snapshot) ficam fora da view. */
export type JovemAssinatura =
  Database["public"]["Views"]["jovem_assinaturas"]["Row"];

/** Colega de turma do jovem (view `mentorados_turma`, 0076) — só colegas
 *  COM conta (profile_id) que dividem turma de dupla; `whatsapp` vem null
 *  salvo quando o colega ligou `contato_compartilhado`. */
export type ColegaTurma =
  Database["public"]["Views"]["mentorados_turma"]["Row"];

/** Linha da view `jovem_especialistas` (0075) — o catálogo que o jovem vê
 *  pra direcionar o pedido de especialista: nome/social/avatar/áreas.
 *  Contato direto NÃO entra (whatsapp/email ficam fora da view) — o canal
 *  abre quando a dupla nasce, pelo jovem_contatos de sempre. Tipo local:
 *  database.types.ts ainda não foi regenerado com a view. */
export type JovemEspecialista = {
  id: string;
  nome: string;
  nome_social: string | null;
  avatar_path: string | null;
  areas: string[] | null;
};

/** A pessoa que /jovem/pessoas/[id] resolve — sempre de uma fonte já
 *  autorizada (contato de dupla/coord, colega da turma ou catálogo de
 *  especialista); cada ramo carrega a projeção segura da view dele. */
export type JovemPessoa =
  | { tipo: "contato"; contato: JovemContato }
  | { tipo: "colega"; colega: ColegaTurma }
  | { tipo: "especialista"; especialista: JovemEspecialista };
