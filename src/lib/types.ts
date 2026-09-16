export type AppRole = "coordenacao" | "supervisor" | "mentor_dpp" | "mentor_especialista";
export type DuplaStatus = "ativa" | "pausada" | "encerrada";
export type EncontroStatus = "agendado" | "realizado" | "remarcado" | "nao_aconteceu" | "cancelado";
export type EncaminhamentoStatus = "pendente" | "feito" | "atrasado";

export type Profile = {
  id: string;
  user_id: string | null;
  nome: string;
  email: string;
  whatsapp: string | null;
  role: AppRole | null;
  ativo: boolean;
};

export type Mentorado = {
  id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  ong_origem: string | null;
  notas: string | null;
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
  created_at: string;
};

export type Encontro = {
  id: string;
  dupla_id: string;
  numero: number;
  data_hora: string | null;
  duracao_min: number;
  status: EncontroStatus;
  origem: "plataforma" | "externo";
  link: string | null;
  registro?: Registro | null;
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
};

export type Material = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: "guia" | "template" | "conteudo" | "link";
  url: string | null;
  audiencia: "todos" | "dpp" | "especialista" | "coordenacao";
  encontro_num: number | null;
  ordem: number;
};
