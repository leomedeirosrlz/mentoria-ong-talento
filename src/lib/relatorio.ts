import { formatDate } from "@/lib/ciclo";

/** Slug fixo do resumo público da T2 — fator de posse do link
 *  compartilhável. Rotacionar = trocar aqui e redeployar. */
export const RESUMO_SLUG_T2 = "t2-x7k4m9qf2w8j";

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
const COLUNAS_CONTATO = new Set([
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
  email: string | null;
  whatsapp: string | null;
  cidade: string | null;
  uf: string | null;
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

/** Pessoas sem dupla ativa que pertencem à turma mas não moram em `duplas`
 *  (fila de espera / mentor recém-importado). A turma não existe como campo
 *  fora de `duplas` — a fila é a allowlist explícita de quem foi importado
 *  pro pareamento T2. */
export const FILA_T2_MENTORES = ["a6df198b-b46f-45f7-a5a1-a2dbed3325b9"];
export const FILA_T2_MENTORADOS = [
  "710fcd28-7b68-4456-bbfe-f2915553fb7c",
  "f78d2469-a6e6-4cfb-85bd-2b90bc5c68c4",
];

export function montarLinhas(
  cfg: RelatorioConfig,
  duplas: DuplaFonte[],
  profs: Map<string, PessoaFonte>,
  mentorados: Map<string, PessoaFonte>,
  opts: { paraApp?: boolean } = {}
): LinhaRelatorio[] {
  const { paraApp = false } = opts;
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

  if (cfg.turma === "T2 · 2026/2027") {
    for (const pid of FILA_T2_MENTORES) {
      const p = profs.get(pid);
      if (p && !ativosMentor.has(pid)) {
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
    }
    for (const mid of FILA_T2_MENTORADOS) {
      const m = mentorados.get(mid);
      if (m && !ativosJovem.has(mid)) {
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
