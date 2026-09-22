// Fixtures de domínio pra suíte de puras. As datas do ciclo são terças fixas
// (2025-10-07 → 2026-01-20) e `hoje`/`agora` sempre entram por parâmetro —
// nada depende do relógio. `dt()` ancora no meio-dia de SP pra nenhum
// cálculo de dia deslizar no fuso.

import type {
  CicloEvento,
  Dupla,
  Encaminhamento,
  Encontro,
  EspecialistaEvento,
  Mentorado,
  Profile,
  Registro,
} from "@/lib/types";

/** "2025-10-14" -> Date ao meio-dia de America/Sao_Paulo. */
export const dt = (iso: string) => new Date(`${iso}T12:00:00-03:00`);

/** Date a partir de "YYYY-MM-DD HH:mm" no horário de SP. */
export const dth = (isoDia: string, hhmm = "19:00") =>
  new Date(`${isoDia}T${hhmm}:00-03:00`);

export function mkProfile(over: Partial<Profile> = {}): Profile {
  return {
    id: "p-" + Math.abs(JSON.stringify(over).length).toString(36),
    user_id: null,
    nome: "Mentora Teste",
    email: "mentora@teste.dev",
    whatsapp: null,
    role: "mentor_dpp",
    ativo: true,
    bio: null,
    linkedin: null,
    areas: null,
    voluntariado: null,
    onboarded_em: null,
    ...over,
  };
}

export function mkMentorado(over: Partial<Mentorado> = {}): Mentorado {
  return {
    id: "m-1",
    nome: "Jovem Teste",
    email: null,
    whatsapp: null,
    ong_origem: null,
    notas: null,
    ...over,
  };
}

export function mkEvento(
  numero: number,
  data: string,
  over: Partial<CicloEvento> = {}
): CicloEvento {
  return {
    id: `ev-${numero}`,
    tipo: "encontro",
    numero,
    data,
    data_fim: null,
    titulo: `Encontro ${numero}`,
    fase: numero <= 8 ? "Fase 1" : "Fase 2",
    instrumentos: [],
    ...over,
  };
}

/** As 16 terças do ciclo de referência + uma formação e um recesso no meio
 *  (tipos não-encontro — provam o filtro por `tipo` nas derivações). */
export const CICLO_16: CicloEvento[] = [
  mkEvento(1, "2025-10-07"),
  mkEvento(2, "2025-10-14"),
  mkEvento(3, "2025-10-21"),
  {
    id: "ev-form",
    tipo: "formacao",
    numero: null,
    data: "2025-10-22",
    data_fim: null,
    titulo: "Formação",
    fase: null,
    instrumentos: [],
  },
  mkEvento(4, "2025-10-28"),
  mkEvento(5, "2025-11-04"),
  mkEvento(6, "2025-11-11"),
  mkEvento(7, "2025-11-18"),
  mkEvento(8, "2025-11-25"),
  mkEvento(9, "2025-12-02"),
  mkEvento(10, "2025-12-09"),
  mkEvento(11, "2025-12-16"),
  mkEvento(12, "2025-12-23"),
  {
    id: "ev-recesso",
    tipo: "recesso",
    numero: null,
    data: "2025-12-25",
    data_fim: "2026-01-04",
    titulo: "Recesso",
    fase: null,
    instrumentos: [],
  },
  mkEvento(13, "2025-12-30"),
  mkEvento(14, "2026-01-06"),
  mkEvento(15, "2026-01-13"),
  mkEvento(16, "2026-01-20"),
];

/** Os 5 passos da trilha de especialista — sem data fixa. */
export const ESP_5: EspecialistaEvento[] = [
  { numero: 2, titulo: "Diagnóstico", foco: "entender a demanda" },
  { numero: 1, titulo: "Apresentação", foco: null },
  { numero: 4, titulo: "Encaminhamentos", foco: "plano de ação" },
  { numero: 3, titulo: "Trabalho", foco: null },
  { numero: 5, titulo: "Fechamento", foco: "devolutiva ao PDM" },
];

export function mkRegistro(over: Partial<Registro> = {}): Registro {
  return {
    id: "r-1",
    encontro_id: "e-1",
    tema: null,
    ferramenta: null,
    reflexoes: null,
    observacoes: null,
    precisa_apoio: false,
    atividades: [],
    avaliacao: "boa",
    dificuldade: "nenhuma",
    dificuldade_detalhe: null,
    proximo_passo: null,
    proximo_passo_detalhe: null,
    created_by: null,
    created_at: "2025-10-08T10:00:00-03:00",
    ...over,
  };
}

export function mkEncontro(numero: number, over: Partial<Encontro> = {}): Encontro {
  return {
    id: `e-${numero}`,
    dupla_id: "d-1",
    numero,
    data_hora: null,
    realizado_em: null,
    duracao_min: 60,
    status: "agendado",
    origem: "plataforma",
    link: null,
    motivo_reagendamento: null,
    registro: null,
    ...over,
  };
}

/** Atalho: encontro realizado numa data, com registro opcional. */
export function encRealizado(
  numero: number,
  dia: string,
  registro: Registro | null = mkRegistro()
): Encontro {
  return mkEncontro(numero, {
    status: "realizado",
    data_hora: dth(dia).toISOString(),
    realizado_em: dth(dia).toISOString(),
    registro,
  });
}

/** Atalho: encontro agendado pra uma data (passada ou futura). */
export function encAgendado(numero: number, dia: string, hhmm = "19:00"): Encontro {
  return mkEncontro(numero, {
    status: "agendado",
    data_hora: dth(dia, hhmm).toISOString(),
  });
}

export function mkEncaminhamento(over: Partial<Encaminhamento> = {}): Encaminhamento {
  return {
    id: "t-1",
    dupla_id: "d-1",
    registro_id: null,
    descricao: "Combinado de teste",
    responsavel: "mentor",
    prazo: null,
    status: "pendente",
    ...over,
  };
}

export function mkDupla(over: Partial<Dupla> = {}): Dupla {
  return {
    id: "d-1",
    ciclo: "2025.2",
    status: "ativa",
    iniciada_em: null,
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: mkProfile(),
    mentorado: mkMentorado(),
    supervisor: null,
    encontros: [],
    encaminhamentos: [],
    ...over,
  };
}
