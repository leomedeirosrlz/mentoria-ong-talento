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
    colunas: validas.length ? validas : cat.map((c) => c.id),
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
  nome: string | null;
  email: string | null;
  whatsapp: string | null;
  cidade: string | null;
  uf: string | null;
};

export type DuplaFonte = {
  turma: string;
  mentor_id: string;
  mentorado_id: string;
  supervisor_id: string | null;
  status: string;
  iniciada_em: string | null;
  demanda: string | null;
};

export type LinhaRelatorio = Record<string, string>;

const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  encerrada: "Encerrada",
  pausada: "Pausada",
  concluida: "Concluída",
  "sem dupla": "Sem dupla",
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
  mentorados: Map<string, PessoaFonte>
): LinhaRelatorio[] {
  const daTurma = duplas.filter((d) => !cfg.turma || d.turma === cfg.turma);

  if (cfg.granularidade === "duplas") {
    return daTurma
      .map((d) => {
        const mentor = profs.get(d.mentor_id);
        const mentorado = mentorados.get(d.mentorado_id);
        const sup = d.supervisor_id ? profs.get(d.supervisor_id) : null;
        return {
          mentor: mentor?.nome ?? "",
          mentorado: mentorado?.nome ?? "",
          contato_mentor: mentor ? contato(mentor) : "",
          contato_mentorado: mentorado ? contato(mentorado) : "",
          status_dupla: labelStatus(d.status),
          iniciada_em: formatDate(d.iniciada_em),
          demanda: d.demanda ?? "",
          auxiliar: sup?.nome ?? "",
        };
      })
      .sort((a, b) => a.mentor.localeCompare(b.mentor, "pt-BR"));
  }

  const linhas: LinhaRelatorio[] = [];
  const ativosMentor = new Set(daTurma.filter((d) => d.status === "ativa").map((d) => d.mentor_id));
  const ativosJovem = new Set(daTurma.filter((d) => d.status === "ativa").map((d) => d.mentorado_id));

  for (const d of daTurma) {
    const mentor = profs.get(d.mentor_id);
    const mentorado = mentorados.get(d.mentorado_id);
    const sup = d.supervisor_id ? profs.get(d.supervisor_id) : null;
    if (mentor) {
      linhas.push({
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
      });
    }
    if (mentorado) {
      linhas.push({
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
      });
    }
  }

  if (cfg.turma === "T2 · 2026/2027") {
    for (const pid of FILA_T2_MENTORES) {
      const p = profs.get(pid);
      if (p && !ativosMentor.has(pid)) {
        linhas.push({
          papel: "Mentor(a)", nome: p.nome ?? "", email: p.email ?? "",
          whatsapp: p.whatsapp ?? "", cidade_uf: cidadeUf(p), par: "",
          status_dupla: "Sem dupla", iniciada_em: "", demanda: "", auxiliar: "",
        });
      }
    }
    for (const mid of FILA_T2_MENTORADOS) {
      const m = mentorados.get(mid);
      if (m && !ativosJovem.has(mid)) {
        linhas.push({
          papel: "Mentorado(a)", nome: m.nome ?? "", email: m.email ?? "",
          whatsapp: m.whatsapp ?? "", cidade_uf: cidadeUf(m), par: "",
          status_dupla: "Sem dupla", iniciada_em: "", demanda: "", auxiliar: "",
        });
      }
    }
  }

  return linhas.sort(
    (a, b) =>
      a.papel.localeCompare(b.papel, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR")
  );
}
