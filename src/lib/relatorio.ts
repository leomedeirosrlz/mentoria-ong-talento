import {
  ATIVIDADES_ENCONTRO,
  AVALIACAO_LABEL,
  formatDate,
  papelLabel,
  TRILHA_LABEL,
} from "@/lib/ciclo";
import type { EncontroStatus, Trilha } from "@/lib/types";

// ---------- config ----------

export type GranularidadeRelatorio = "pessoas" | "duplas";

export type RelatorioConfig = {
  /** null = todas as turmas */
  turma: string | null;
  granularidade: GranularidadeRelatorio;
  /** ids de coluna na ordem do catálogo */
  colunas: string[];
};

export type ColunaRelatorio = { id: string; label: string };

/** Relatório por pessoa — uma linha por mentor/mentorado (igual à planilha
 *  operacional que a coordenação exportava à mão). */
export const COLUNAS_PESSOAS: ColunaRelatorio[] = [
  { id: "papel", label: "Papel" },
  { id: "nome", label: "Nome" },
  { id: "email", label: "E-mail" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "cidade_uf", label: "Cidade/UF" },
  { id: "par", label: "Par" },
  { id: "status_dupla", label: "Status da dupla" },
  { id: "iniciada_em", label: "Início da dupla" },
  { id: "demanda", label: "Demanda" },
  { id: "auxiliar", label: "Auxiliar executivo" },
];

/** Relatório por dupla — uma linha por par, contatos dos dois lados. */
export const COLUNAS_DUPLAS: ColunaRelatorio[] = [
  { id: "mentor", label: "Mentor(a)" },
  { id: "mentorado", label: "Mentorado(a)" },
  { id: "contato_mentor", label: "Contato do mentor" },
  { id: "contato_mentorado", label: "Contato do mentorado" },
  { id: "status_dupla", label: "Status" },
  { id: "iniciada_em", label: "Início" },
  { id: "demanda", label: "Demanda" },
  { id: "auxiliar", label: "Auxiliar executivo" },
];

export function catalogoDe(g: GranularidadeRelatorio): ColunaRelatorio[] {
  return g === "duplas" ? COLUNAS_DUPLAS : COLUNAS_PESSOAS;
}

/** Colunas com contato direto — opt-in no link público (/resumo/[slug] é
 *  compartilhável por obscuridade; o default não pode vazar telefone e
 *  e-mail de menores). */
export const COLUNAS_CONTATO = new Set([
  "email",
  "whatsapp",
  "contato_mentor",
  "contato_mentorado",
]);

export function configPadrao(): RelatorioConfig {
  return {
    turma: "T2 · 2026/2027",
    granularidade: "pessoas",
    colunas: COLUNAS_PESSOAS.map((c) => c.id),
  };
}

// ---------- params do link compartilhável ----------

export function parseConfig(sp: {
  turma?: string;
  gran?: string;
  col?: string;
}): RelatorioConfig {
  const granularidade: GranularidadeRelatorio =
    sp.gran === "duplas" ? "duplas" : "pessoas";
  const cat = catalogoDe(granularidade);
  const pedidas = (sp.col ?? "").split(",").filter(Boolean);
  const validas = pedidas.filter((c) => cat.some((k) => k.id === c));
  return {
    turma: sp.turma && sp.turma !== "todas" ? sp.turma : null,
    granularidade,
    // sem ?col= explícito a URL pública mostra a grade operacional SEM
    // contato — e-mail/WhatsApp (de mentorado menor incluso) só entram
    // quando quem montou o link os escolheu de propósito
    colunas: validas.length
      ? validas
      : cat.map((c) => c.id).filter((c) => !COLUNAS_CONTATO.has(c)),
  };
}

export function configParaSearch(cfg: RelatorioConfig): string {
  const p = new URLSearchParams();
  p.set("turma", cfg.turma ?? "todas");
  p.set("gran", cfg.granularidade);
  p.set("col", cfg.colunas.join(","));
  return p.toString();
}

// ---------- linhas ----------

export type PessoaFonte = {
  id: string;
  /** preenchido quando a pessoa já entrou — email de profile vinculado não
   *  é editável na grade (a 0060 reserva a escrita ao sync do auth) */
  user_id?: string | null;
  nome: string | null;
  email?: string | null;
  whatsapp?: string | null;
  cidade: string | null;
  uf: string | null;
  /** papel primário — só o recorte 'assinaturas' carrega (rótulo "tipo" da
   *  linha); grade/ciclo nem pedem ao banco */
  role?: string | null;
};

export type DuplaFonte = {
  id: string;
  turma: string;
  mentor_id: string;
  mentorado_id: string;
  supervisor_id: string | null;
  status: string;
  iniciada_em: string | null;
  demanda: string | null;
  /** só o recorte público 'ciclo' carrega (desambigua trilha/esp e o nº do
   *  encontro dentro do cronograma) — opcional pra não reescrever os
   *  fixtures do builder interno */
  trilha?: string | null;
  cronograma_id?: string | null;
};

// ---------- edição inline (só o app autenticado pede os metadados) ----------

export type TabelaCadastro = "profiles" | "mentorados";

/** Campos de cadastro que a grade corrige (typo/contato). Status, papel,
 *  demanda e início têm fluxo próprio com notificações — ficam read-only. */
export type CampoCadastro = "nome" | "email" | "whatsapp" | "cidade" | "uf";

/** Destino de escrita de uma célula editável. Células compostas (Cidade/UF,
 *  Contato do mentor) carregam uma lista — um alvo por campo. */
export type AlvoRelatorio = {
  tabela: TabelaCadastro;
  id: string;
  campo: CampoCadastro;
  /** valor cru do campo — conteúdo inicial do input de edição */
  valor: string;
};

type MetaLinha = Record<string, AlvoRelatorio[]> | Record<string, string>;

/** A linha mistura valores de célula (string, indexados pelo id do catálogo)
 *  e metadados `__*` — que nunca viram coluna porque o canvas só lê
 *  `colunas`. `__alvos` (destinos de escrita) e `__links` (hrefs internos,
 *  ex.: o par → ficha da dupla) só existem com `paraApp`; `__status` e
 *  `__papel` são tokens semânticos que alimentam chip/cor em qualquer
 *  contexto, inclusive o resumo público. */
export interface LinhaRelatorio {
  [col: string]: string | MetaLinha | undefined;
  __alvos?: Record<string, AlvoRelatorio[]>;
  __links?: Record<string, string>;
  __status?: string;
  __papel?: "mentor" | "mentorado";
}

/** Texto da célula — os metadados `__*` não são string, então toda leitura
 *  de valor (ordenação, TSV/CSV, render) passa por aqui. */
export function textoCelula(l: LinhaRelatorio, col: string): string {
  const v = l[col];
  return typeof v === "string" ? v : "";
}

/** Coluna → campos de cadastro que ela escreve na edição inline. As
 *  compostas (cidade_uf, contato_*) abrem um input por campo, na ordem em
 *  que aparecem na célula. */
const CAMPOS_COLUNA_PESSOA: Record<string, readonly CampoCadastro[]> = {
  nome: ["nome"],
  email: ["email"],
  whatsapp: ["whatsapp"],
  cidade_uf: ["cidade", "uf"],
};

const CAMPOS_COLUNA_MENTOR: Record<string, readonly CampoCadastro[]> = {
  mentor: ["nome"],
  contato_mentor: ["whatsapp", "email"],
};

const CAMPOS_COLUNA_MENTORADO: Record<string, readonly CampoCadastro[]> = {
  mentorado: ["nome"],
  contato_mentorado: ["whatsapp", "email"],
};

/** `__alvos` de uma pessoa pra um mapa coluna→campos. E-mail de profile com
 *  conta vinculada fica de fora — o servidor recusa (0060) e a grade nem
 *  oferece a edição. Coluna cujos campos caíram todos no filtro não emite
 *  chave (célula read-only). */
function alvosDe(
  tabela: TabelaCadastro,
  p: PessoaFonte,
  mapa: Record<string, readonly CampoCadastro[]>
): Record<string, AlvoRelatorio[]> {
  const out: Record<string, AlvoRelatorio[]> = {};
  for (const col of Object.keys(mapa)) {
    const lista = mapa[col]
      .filter(
        (campo) =>
          !(tabela === "profiles" && campo === "email" && p.user_id)
      )
      .map((campo) => ({
        tabela,
        id: p.id,
        campo,
        valor: p[campo] ?? "",
      }));
    if (lista.length) out[col] = lista;
  }
  return out;
}

const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  encerrada: "Encerrada",
  pausada: "Pausada",
  concluida: "Concluída",
};

export function labelStatus(s: string): string {
  return STATUS_LABEL[s] ?? s;
}

function cidadeUf(p: Pick<PessoaFonte, "cidade" | "uf">): string {
  if (!p.cidade && !p.uf) return "";
  return [p.cidade, p.uf].filter(Boolean).join(" · ");
}

function contato(p: Pick<PessoaFonte, "email" | "whatsapp">): string {
  return [p.whatsapp, p.email].filter(Boolean).join(" · ");
}

/** Pessoa da fila de espera de uma turma (turma_inscricoes, 0111): pertence
 *  à turma mas ainda não mora em `duplas` — mentor importado aguardando
 *  vaga, jovem inscrito sem matching. A união discriminada espelha o XOR do
 *  banco: mentor aponta `profiles`, mentorado aponta `mentorados`. */
export type InscricaoFila =
  | { papel_esperado: "mentor"; profile_id: string }
  | { papel_esperado: "mentorado"; mentorado_id: string };

/** Inscrição com a turma carregada — forma que a query devolve; o chamador
 *  filtra por turma antes de montar a grade. */
export type InscricaoFilaTurma = InscricaoFila & { turma: string };

export function montarLinhas(
  cfg: RelatorioConfig,
  duplas: DuplaFonte[],
  profs: Map<string, PessoaFonte>,
  mentorados: Map<string, PessoaFonte>,
  opts: { paraApp?: boolean; fila?: InscricaoFila[] } = {}
): LinhaRelatorio[] {
  const { paraApp = false, fila = [] } = opts;
  const daTurma = duplas.filter((d) => !cfg.turma || d.turma === cfg.turma);

  if (cfg.granularidade === "duplas") {
    return daTurma
      .map((d) => {
        const mentor = profs.get(d.mentor_id);
        const mentorado = mentorados.get(d.mentorado_id);
        const sup = d.supervisor_id ? profs.get(d.supervisor_id) : null;
        const linha: LinhaRelatorio = {
          mentor: mentor?.nome ?? "",
          mentorado: mentorado?.nome ?? "",
          contato_mentor: mentor ? contato(mentor) : "",
          contato_mentorado: mentorado ? contato(mentorado) : "",
          status_dupla: labelStatus(d.status),
          iniciada_em: formatDate(d.iniciada_em),
          demanda: d.demanda ?? "",
          auxiliar: sup?.nome ?? "",
          __status: d.status,
        };
        if (paraApp) {
          linha.__alvos = {
            ...(mentor
              ? alvosDe("profiles", mentor, CAMPOS_COLUNA_MENTOR)
              : {}),
            ...(mentorado
              ? alvosDe("mentorados", mentorado, CAMPOS_COLUNA_MENTORADO)
              : {}),
          };
        }
        return linha;
      })
      .sort((a, b) => textoCelula(a, "mentor").localeCompare(textoCelula(b, "mentor"), "pt-BR"));
  }

  const linhas: LinhaRelatorio[] = [];
  const ativosMentor = new Set(daTurma.filter((d) => d.status === "ativa").map((d) => d.mentor_id));
  const ativosJovem = new Set(daTurma.filter((d) => d.status === "ativa").map((d) => d.mentorado_id));

  for (const d of daTurma) {
    const mentor = profs.get(d.mentor_id);
    const mentorado = mentorados.get(d.mentorado_id);
    const sup = d.supervisor_id ? profs.get(d.supervisor_id) : null;
    if (mentor) {
      const linha: LinhaRelatorio = {
        papel: "Mentor(a)",
        nome: mentor.nome ?? "",
        email: mentor.email ?? "",
        whatsapp: mentor.whatsapp ?? "",
        cidade_uf: cidadeUf(mentor),
        par: mentorado?.nome ?? "",
        status_dupla: labelStatus(d.status),
        iniciada_em: formatDate(d.iniciada_em),
        demanda: d.demanda ?? "",
        auxiliar: sup?.nome ?? "",
        __status: d.status,
        __papel: "mentor",
      };
      if (paraApp) {
        linha.__alvos = alvosDe("profiles", mentor, CAMPOS_COLUNA_PESSOA);
        linha.__links = { par: `/duplas/${d.id}` };
      }
      linhas.push(linha);
    }
    if (mentorado) {
      const linha: LinhaRelatorio = {
        papel: "Mentorado(a)",
        nome: mentorado.nome ?? "",
        email: mentorado.email ?? "",
        whatsapp: mentorado.whatsapp ?? "",
        cidade_uf: cidadeUf(mentorado),
        par: mentor?.nome ?? "",
        status_dupla: labelStatus(d.status),
        iniciada_em: formatDate(d.iniciada_em),
        demanda: d.demanda ?? "",
        auxiliar: sup?.nome ?? "",
        __status: d.status,
        __papel: "mentorado",
      };
      if (paraApp) {
        linha.__alvos = alvosDe("mentorados", mentorado, CAMPOS_COLUNA_PESSOA);
        linha.__links = { par: `/duplas/${d.id}` };
      }
      linhas.push(linha);
    }
  }

  // fila de espera: inscrito `aguardando` sem dupla ativa vira linha
  // "Sem dupla" — regra idêntica pra qualquer turma (a lista já chega
  // escopada do chamador; quem tem dupla ativa sai pelos sets `ativos*`)
  for (const i of fila) {
    if (i.papel_esperado === "mentor") {
      const p = profs.get(i.profile_id);
      if (p && !ativosMentor.has(i.profile_id)) {
        const linha: LinhaRelatorio = {
          papel: "Mentor(a)", nome: p.nome ?? "", email: p.email ?? "",
          whatsapp: p.whatsapp ?? "", cidade_uf: cidadeUf(p), par: "",
          status_dupla: "Sem dupla", iniciada_em: "", demanda: "", auxiliar: "",
          __status: "sem_dupla",
          __papel: "mentor",
        };
        if (paraApp) {
          linha.__alvos = alvosDe("profiles", p, CAMPOS_COLUNA_PESSOA);
        }
        linhas.push(linha);
      }
    } else {
      const m = mentorados.get(i.mentorado_id);
      if (m && !ativosJovem.has(i.mentorado_id)) {
        const linha: LinhaRelatorio = {
          papel: "Mentorado(a)", nome: m.nome ?? "", email: m.email ?? "",
          whatsapp: m.whatsapp ?? "", cidade_uf: cidadeUf(m), par: "",
          status_dupla: "Sem dupla", iniciada_em: "", demanda: "", auxiliar: "",
          __status: "sem_dupla",
          __papel: "mentorado",
        };
        if (paraApp) {
          linha.__alvos = alvosDe("mentorados", m, CAMPOS_COLUNA_PESSOA);
        }
        linhas.push(linha);
      }
    }
  }

  return linhas.sort(
    (a, b) =>
      textoCelula(a, "papel").localeCompare(textoCelula(b, "papel"), "pt-BR") ||
      textoCelula(a, "nome").localeCompare(textoCelula(b, "nome"), "pt-BR")
  );
}

// =====================================================================
// link público com senha (REALIZA-170)
//
// O /resumo/<slug> deixa de montar recorte por query: a RPC abrir_relatorio
// devolve `config` salvo + `dados` já allowlisted em SQL (o que não é
// selecionado por nome nem atravessa a fronteira). Os tipos e montadores
// abaixo só dão forma de linha ao que já veio filtrado — NUNCA peça
// resposta de instrumento, dado civil ou evidência: eles não existem no
// contrato da RPC (LGPD art. 11 — dados operacionais apenas).
// =====================================================================

export type RelatorioLinkTipo = "grade" | "ciclo" | "assinaturas";

export const TIPO_RELATORIO_LABEL: Record<RelatorioLinkTipo, string> = {
  grade: "Grade operacional",
  ciclo: "Ciclo (encontro a encontro)",
  assinaturas: "Documentos e assinaturas",
};

export type RelatorioLinkConfig = {
  tipo: RelatorioLinkTipo;
  /** turma do recorte (grade/ciclo) — null = todas */
  turma?: string | null;
  /** só grade — uma linha por pessoa ou por dupla */
  granularidade?: GranularidadeRelatorio;
  /** ids de coluna no catálogo do tipo — ausente/vazio = default do tipo */
  colunas?: string[];
  /** opt-in de contato (só grade; false = email/whatsapp nem saem do banco) */
  expor_contato?: boolean;
  /** só ciclo — recorta os encontros a um cronograma */
  cronograma_id?: string | null;
  /** só assinaturas — slug do documento_templates */
  documento?: string | null;
  /** só assinaturas */
  status_assinatura?: "pendente" | "assinado" | "revogado" | "expirado" | null;
};

/** Ciclo — uma linha por encontro (a prestação de contas pública). Espelha
 *  o CSV interno menos o flag interno `precisa_apoio`, que é instrumento da
 *  coordenação, não dado de parceiro. */
export const COLUNAS_CICLO: ColunaRelatorio[] = [
  { id: "mentor", label: "Mentor(a)" },
  { id: "mentorado", label: "Mentorado(a)" },
  { id: "auxiliar", label: "Auxiliar executivo" },
  { id: "trilha", label: "Trilha" },
  { id: "turma", label: "Turma" },
  { id: "cronograma", label: "Cronograma" },
  { id: "encontro_num", label: "Encontro" },
  { id: "data_agendada", label: "Agendado" },
  { id: "realizado_em", label: "Realizado" },
  { id: "status_encontro", label: "Status" },
  { id: "motivo_reagendamento", label: "Motivo de remarcação" },
  { id: "registro_em", label: "Registro" },
  { id: "registro_avaliacao", label: "Avaliação" },
  { id: "registro_atividades", label: "Atividades" },
];

/** Assinaturas — documento + status + datas, sem evidência (snapshot civil,
 *  IP, UA, hash e token não saem da RPC). Espelha o CSV interno menos as
 *  colunas de prova. */
export const COLUNAS_ASSINATURAS: ColunaRelatorio[] = [
  { id: "nome", label: "Nome" },
  { id: "tipo", label: "Papel" },
  { id: "documento", label: "Documento" },
  { id: "versao", label: "Versão" },
  { id: "status_assinatura", label: "Status" },
  { id: "emitido_em", label: "Emitido" },
  { id: "emitido_por", label: "Emitido por" },
  { id: "expira_em", label: "Link expira" },
  { id: "assinado_em", label: "Assinado" },
];

export function catalogoDeTipo(
  tipo: RelatorioLinkTipo,
  g: GranularidadeRelatorio = "pessoas"
): ColunaRelatorio[] {
  if (tipo === "ciclo") return COLUNAS_CICLO;
  if (tipo === "assinaturas") return COLUNAS_ASSINATURAS;
  return catalogoDe(g);
}

/** Sanitiza o config que vai pro banco / que voltou da RPC. A barreira é o
 *  `tipo` (escolhe o allowlist de dados) + forma dos filtros; coluna fora
 *  do catálogo é rejeitada (não "ignorada" — config sujo não entra). */
export function configLinkOk(c: unknown): c is RelatorioLinkConfig {
  if (!c || typeof c !== "object" || Array.isArray(c)) return false;
  const cfg = c as Record<string, unknown>;
  const tipo = cfg.tipo;
  if (tipo !== "grade" && tipo !== "ciclo" && tipo !== "assinaturas")
    return false;
  if (cfg.turma != null && typeof cfg.turma !== "string") return false;
  if (cfg.expor_contato != null && typeof cfg.expor_contato !== "boolean")
    return false;
  if (
    cfg.granularidade != null &&
    cfg.granularidade !== "pessoas" &&
    cfg.granularidade !== "duplas"
  )
    return false;
  if (cfg.colunas != null) {
    if (!Array.isArray(cfg.colunas) || cfg.colunas.length > 30) return false;
    if (
      cfg.colunas.some((x) => typeof x !== "string" || x.length > 40)
    )
      return false;
    const cat = new Set(
      catalogoDeTipo(
        tipo,
        cfg.granularidade === "duplas" ? "duplas" : "pessoas"
      ).map((x) => x.id)
    );
    if (!cfg.colunas.every((x) => cat.has(x as string))) return false;
    // contato exige o opt-in explícito — coluna pedida sem a flag seria
    // célula vazia ambígua (a RPC nem envia o dado), então é config inválida
    if (
      tipo === "grade" &&
      !cfg.expor_contato &&
      cfg.colunas.some((x) => COLUNAS_CONTATO.has(x as string))
    )
      return false;
  }
  if (tipo !== "grade" && cfg.expor_contato) return false; // contato é da grade
  if (tipo === "assinaturas") {
    if (cfg.documento != null && typeof cfg.documento !== "string")
      return false;
    if (
      cfg.status_assinatura != null &&
      !["pendente", "assinado", "revogado", "expirado"].includes(
        cfg.status_assinatura as string
      )
    )
      return false;
  }
  if (tipo === "ciclo" && cfg.cronograma_id != null) {
    if (
      typeof cfg.cronograma_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        cfg.cronograma_id
      )
    )
      return false;
  }
  return true;
}

/** Colunas efetivamente visíveis do link: o explícito do config, ou o
 *  default do tipo — grade sai SEM contato (mesmo default do parseConfig
 *  antigo); ciclo/assinaturas mostram o catálogo inteiro (nada de contato
 *  neles por construção). A poda de contato em grade sem opt-in é dupla:
 *  configLinkOk já barra, e aqui filtra de novo por defesa. */
export function colunasDeLink(cfg: RelatorioLinkConfig): ColunaRelatorio[] {
  const cat = catalogoDeTipo(cfg.tipo, cfg.granularidade ?? "pessoas");
  const semContato = (c: ColunaRelatorio) =>
    cfg.tipo !== "grade" || !COLUNAS_CONTATO.has(c.id) || !!cfg.expor_contato;
  const ids = cfg.colunas?.length
    ? cfg.colunas
    : cat.filter(semContato).map((c) => c.id);
  return cat.filter((c) => ids.includes(c.id) && semContato(c));
}

// ---------- dados da RPC (shapes do jsonb `dados` do abrir_relatorio) ----------

export type RelatorioDadosGrade = {
  duplas: DuplaFonte[];
  profiles: PessoaFonte[];
  mentorados: PessoaFonte[];
  inscricoes: InscricaoFila[];
};

export type EncontroFonte = {
  id: string;
  dupla_id: string;
  numero: number;
  data_hora: string | null;
  realizado_em: string | null;
  status: string;
  motivo_reagendamento: string | null;
  duracao_min: number | null;
};

/** Registro já podado na RPC: sem tema/reflexões/observações/detalhes/
 *  precisa_apoio — só o par (avaliação, atividades do catálogo) + data. */
export type RegistroFonte = {
  encontro_id: string;
  created_at: string;
  avaliacao: string | null;
  atividades: string[] | null;
};

export type RelatorioDadosCiclo = {
  duplas: DuplaFonte[];
  encontros: EncontroFonte[];
  registros: RegistroFonte[];
  profiles: PessoaFonte[];
  mentorados: PessoaFonte[];
  cronogramas: { id: string; nome: string }[];
};

/** Assinatura já podada na RPC: sem dados_snapshot/assinatura_texto/
 *  ip/user_agent/hash_documento/token. */
export type AssinaturaFonte = {
  id: string;
  profile_id: string | null;
  mentorado_id: string | null;
  status: string;
  assinado_em: string | null;
  created_at: string;
  token_expira_em: string | null;
  created_by: string | null;
  template: {
    slug: string;
    titulo: string;
    versao: number;
    signatario: string;
  } | null;
};

export type RelatorioDadosAssinaturas = {
  assinaturas: AssinaturaFonte[];
  profiles: PessoaFonte[];
  mentorados: PessoaFonte[];
};

// ---------- labels das linhas públicas ----------

/** Mesmo léxico do CSV interno e da agenda (minúsculas) — copiado porque lá
 *  é local também; o enum tem remarcado/cancelado legados mas nenhum writer
 *  os grava mais (ver types.ts EncontroStatus). */
const STATUS_ENCONTRO_TXT: Record<string, string> = {
  agendado: "agendado",
  remarcado: "remarcado",
  realizado: "realizado",
  nao_aconteceu: "não aconteceu",
  cancelado: "cancelado",
};

export const STATUS_ASSINATURA_LABEL: Record<string, string> = {
  pendente: "Pendente",
  assinado: "Assinado",
  revogado: "Revogado",
  expirado: "Expirado",
};

// dd/mm/aaaa[, hh:mm] no fuso do programa — numérico ordena melhor na grade
// pública e casa com o CSV que a coordenação já exporta
const TZ = "America/Sao_Paulo";
const fmtDia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : fmtDia.format(d);
}

function dataHoraCurta(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${fmtDia.format(d)} ${fmtHora.format(d)}`;
}

const CATALOGO_ATIVIDADES = new Set<string>(ATIVIDADES_ENCONTRO);

/** Linhas do recorte 'ciclo' — uma por encontro, como o CSV interno menos
 *  a coluna interna precisa_apoio. `atividades` é filtrada de novo aqui
 *  (belt & suspenders: a RPC já corta na fronteira do banco). */
export function montarLinhasCiclo(dados: RelatorioDadosCiclo): LinhaRelatorio[] {
  const profs = new Map(dados.profiles.map((p) => [p.id, p]));
  const ments = new Map(dados.mentorados.map((m) => [m.id, m]));
  const cronos = new Map(dados.cronogramas.map((c) => [c.id, c.nome]));
  const regs = new Map(dados.registros.map((r) => [r.encontro_id, r]));
  const encPorDupla = new Map<string, EncontroFonte[]>();
  for (const e of dados.encontros) {
    const arr = encPorDupla.get(e.dupla_id) ?? [];
    arr.push(e);
    encPorDupla.set(e.dupla_id, arr);
  }
  const linhas: LinhaRelatorio[] = [];
  for (const d of dados.duplas) {
    const encs = (encPorDupla.get(d.id) ?? []).sort(
      (a, b) => a.numero - b.numero
    );
    for (const e of encs) {
      const r = regs.get(e.id);
      linhas.push({
        mentor: profs.get(d.mentor_id)?.nome ?? "",
        mentorado: ments.get(d.mentorado_id)?.nome ?? "",
        auxiliar: d.supervisor_id
          ? (profs.get(d.supervisor_id)?.nome ?? "")
          : "",
        trilha: d.trilha ? (TRILHA_LABEL[d.trilha as Trilha] ?? d.trilha) : "",
        turma: d.turma,
        cronograma: d.cronograma_id ? (cronos.get(d.cronograma_id) ?? "") : "",
        encontro_num: String(e.numero),
        data_agendada: dataHoraCurta(e.data_hora),
        realizado_em: dataCurta(e.realizado_em),
        status_encontro:
          STATUS_ENCONTRO_TXT[e.status as EncontroStatus] ?? e.status,
        motivo_reagendamento: e.motivo_reagendamento ?? "",
        registro_em: r ? dataHoraCurta(r.created_at) : "",
        registro_avaliacao: r?.avaliacao
          ? (AVALIACAO_LABEL[r.avaliacao] ?? "")
          : "",
        registro_atividades: (r?.atividades ?? [])
          .filter((a) => CATALOGO_ATIVIDADES.has(a))
          .join(" | "),
        __status: d.status,
      });
    }
  }
  return linhas.sort(
    (a, b) =>
      textoCelula(a, "mentor").localeCompare(textoCelula(b, "mentor"), "pt-BR") ||
      Number(textoCelula(a, "encontro_num")) -
        Number(textoCelula(b, "encontro_num"))
  );
}

/** Linhas do recorte 'assinaturas' — nome + documento + status + datas.
 *  `emitido_por` resolve created_by nos profiles; null = a própria pessoa
 *  emitiu (fluxo self-sign da 0033). */
export function montarLinhasAssinaturas(
  dados: RelatorioDadosAssinaturas
): LinhaRelatorio[] {
  const profs = new Map(dados.profiles.map((p) => [p.id, p]));
  const ments = new Map(dados.mentorados.map((m) => [m.id, m]));
  const linhas = dados.assinaturas.map((a): LinhaRelatorio => {
    const pessoa = a.profile_id
      ? profs.get(a.profile_id)
      : a.mentorado_id
        ? ments.get(a.mentorado_id)
        : null;
    const tpl = a.template;
    return {
      nome: pessoa?.nome ?? "",
      tipo: a.profile_id
        ? papelLabel(profs.get(a.profile_id)?.role ?? null)
        : "Mentorado",
      documento: tpl?.titulo ?? "",
      versao: tpl ? `v${tpl.versao}` : "",
      status_assinatura:
        STATUS_ASSINATURA_LABEL[a.status] ?? a.status,
      emitido_em: dataHoraCurta(a.created_at),
      emitido_por: a.created_by
        ? (profs.get(a.created_by)?.nome ?? "")
        : "A própria pessoa",
      expira_em: dataCurta(a.token_expira_em),
      assinado_em: dataHoraCurta(a.assinado_em),
    };
  });
  return linhas.sort((a, b) =>
    textoCelula(a, "nome").localeCompare(textoCelula(b, "nome"), "pt-BR")
  );
}

// ---------- gestão dos links (coordenação) ----------

/** Linha do painel de links — forma do jsonb da RPC relatorio_links_stats
 *  (0110): metadados + contadores, sem senha_hash (o bcrypt não sai do
 *  banco nem pra coordenação). */
export type RelatorioLinkItem = {
  id: string;
  slug: string;
  titulo: string;
  turma: string | null;
  config: unknown;
  protegido: boolean;
  criado_por_nome: string | null;
  created_at: string;
  expira_em: string | null;
  revogado_em: string | null;
  acessos: number;
  ultimo_acesso: string | null;
  falhas_24h: number;
};

export type EstadoLink = "ativo" | "expirado" | "revogado";

/** Estado efetivo do link — a mesma precedência da RPC (revogado vence
 *  expirado: revogar um link vencido não o "ressuscita"). */
export function estadoLink(l: {
  revogado_em: string | null;
  expira_em: string | null;
}): EstadoLink {
  if (l.revogado_em) return "revogado";
  if (l.expira_em && new Date(l.expira_em).getTime() <= Date.now())
    return "expirado";
  return "ativo";
}

export const ESTADO_LINK_LABEL: Record<EstadoLink, string> = {
  ativo: "Ativo",
  expirado: "Expirado",
  revogado: "Revogado",
};

/** Descrição curta do recorte pra listagem — o que o link compartilha,
 *  numa linha ("Grade de pessoas · T2 · com contato"). */
export function resumoRecorteLink(cfg: RelatorioLinkConfig): string {
  const partes: string[] = [];
  if (cfg.tipo === "grade") {
    partes.push(
      cfg.granularidade === "duplas" ? "Grade de duplas" : "Grade de pessoas"
    );
    if (cfg.turma) partes.push(cfg.turma);
    partes.push(cfg.expor_contato ? "com contato" : "sem contato");
  } else if (cfg.tipo === "ciclo") {
    partes.push("Encontro a encontro");
    if (cfg.turma) partes.push(cfg.turma);
    if (cfg.cronograma_id) partes.push("1 cronograma");
  } else {
    partes.push("Assinaturas");
    if (cfg.documento) partes.push(cfg.documento);
    if (cfg.status_assinatura)
      partes.push(STATUS_ASSINATURA_LABEL[cfg.status_assinatura]);
  }
  return partes.join(" · ");
}
