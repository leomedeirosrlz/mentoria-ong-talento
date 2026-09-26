export type AppRole = "coordenacao" | "supervisor" | "mentor_dpp" | "mentor_especialista";
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
};

/** mentor_profiles — ficha do mentor que alimenta o board de matching
 *  (tipo canônico; queries.ts ainda tem um local com o subconjunto do board). */
export type MentorProfile = {
  profile_id: string;
  tipo: "dpp" | "especialista";
  areas: string[];
  capacidade: number;
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

export type CicloEvento = {
  id: string;
  /** Ciclo do evento (coluna real; o dataset demo não preenche). */
  ciclo?: string;
  tipo: "encontro" | "formacao" | "recesso" | "marco";
  numero: number | null;
  data: string;
  data_fim: string | null;
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
  ciclo: string;
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
  // ---------- fechamento da trilha especialista (0037) — só trilha =
  // 'especialista' carrega esses campos (CHECK duplas_encerramento_esp) ----------
  /** Carimbo do fechamento da trilha — null enquanto a trilha não fechou. */
  encerrada_em?: string | null;
  /** Por que a trilha fechou (obrigatório junto com encerrada_em). */
  motivo_encerramento?: string | null;
  /** O que a trilha devolve pro PDM — chega ao mentor DPP via solicitacoes_mural. */
  devolutiva_pdm?: string | null;
  mentor: Profile;
  mentorado: Mentorado;
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
   *  formulario_respondido (0042, inserido pela RPC de submit) — espelha o
   *  CHECK notificacoes_tipo_check. */
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
    | "formulario_respondido";
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

export type SolicitacaoEspecialistaStatus = "aberta" | "aceita" | "cancelada";

/** Demanda de especialista registrada pelo mentor DPP (ou coord) — vira dupla
 *  quando um especialista aceita (`dupla_id` aponta pra ela). */
export type SolicitacaoEspecialista = {
  id: string;
  mentorado_id: string;
  dupla_dpp_id: string;
  demanda: string;
  especialista_desejado_id: string | null;
  especialista_id: string | null;
  dupla_id: string | null;
  status: SolicitacaoEspecialistaStatus;
  created_by: string | null;
  created_at: string;
  respondida_em: string | null;
  // embeds quando selecionados:
  mentorado?: { nome: string } | null;
  solicitante?: { nome: string } | null;
  especialista?: { nome: string } | null;
  // ---------- colunas do mural (0037) — vêm da dupla de especialista
  // via join na view; null enquanto a trilha não fechou ----------
  /** O que a trilha devolveu pro PDM do jovem — o mentor DPP lê aqui. */
  devolutiva_pdm?: string | null;
  /** Quando a trilha de especialista fechou (dupla.encerrada_em). */
  trilha_encerrada_em?: string | null;
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
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
};

/** Dados civis capturados no ato da assinatura — imutável, vive no snapshot
 *  (não em profiles, que é legível por qualquer autenticado). */
export type DadosCivis = {
  nome_civil: string;
  rg: string;
  cpf: string;
  data_nascimento: string | null;
  endereco: Endereco;
};

/** Responsável legal no cadastro do mentorado (0046) — mesmo shape que o
 *  snapshot da autorização guarda. */
export type ResponsavelCivis = DadosCivis & { parentesco: string };

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
