export type AppRole = "coordenacao" | "supervisor" | "mentor_dpp" | "mentor_especialista";
export type DuplaStatus = "ativa" | "pausada" | "encerrada";
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

export type Profile = {
  id: string;
  user_id: string | null;
  nome: string;
  email: string;
  whatsapp: string | null;
  role: AppRole | null;
  ativo: boolean;
  /** Foto no bucket público `avatares` (<profile_id>/<arquivo>.<ext>) — fallback de exibição: Gravatar do e-mail → iniciais. */
  avatar_path?: string | null;
  /** Documento oficial no bucket `documentos` (termo de responsabilidade) — só a coordenação vê e gerencia. */
  documento_path?: string | null;
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
  tipo: "encontro" | "formacao" | "recesso" | "marco";
  numero: number | null;
  data: string;
  data_fim: string | null;
  titulo: string;
  fase: string | null;
  instrumentos: string[];
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

export type ComunicadoAudiencia = "todos" | "dpp" | "especialista" | "coordenacao";

export type Comunicado = {
  id: string;
  titulo: string;
  corpo: string;
  audiencia: ComunicadoAudiencia;
  created_by: string;
  created_at: string;
  autor?: { nome: string } | null;
};

export type Notificacao = {
  id: string;
  tipo: "comunicado" | "pedido_apoio" | "apoio_resolvido" | "dupla_formada";
  titulo: string;
  corpo: string | null;
  href: string | null;
  lida_em: string | null;
  created_at: string;
};
