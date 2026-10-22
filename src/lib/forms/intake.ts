// Intake de mentores (REALIZA-70) — helpers PUROS: nada de supabase nem
// next/*. A grade horária do formulário oficial (seg–sex × 09h–19h) vira
// o canônico {celulas} da 0100, e a resposta de intake vira o prefill da
// NovaPessoaDialog — os dois mapeamentos são testáveis sem banco.

import type { FormularioCampo, RespostaGrid, RespostaValor } from "./schema";
import type { Disponibilidade } from "@/lib/types";

// ---------- grade seg–sex × 09h–19h ----------

export const GRID_DIAS = ["seg", "ter", "qua", "qui", "sex"] as const;
export type GridDia = (typeof GRID_DIAS)[number];
/** faixas de 1h rotuladas pelo início — 09h … 19h cobre 09h–20h */
export const GRID_HORAS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] as const;
export const GRID_DIA_LABEL: Record<GridDia, string> = {
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
};
export const GRID_DIA_LABEL_LONGA: Record<GridDia, string> = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
};

/** projeção hora → período canônico (0100): manhã até 12h, tarde até 18h,
 *  noite a partir das 18h — mesma fronteira do rótulo da grade de perfil */
export function horaParaPeriodo(hora: number): "manha" | "tarde" | "noite" {
  if (hora < 12) return "manha";
  if (hora < 18) return "tarde";
  return "noite";
}

export type MarcaGrid = { dia: GridDia; hora: number };

/** Conjunto de marcações horárias → RespostaGrid: `horas` é o verbatim
 *  pra leitura humana; `celulas` é a projeção canônica dedupe (o que
 *  matching e o perfil consomem sem adaptador). */
export function gridParaResposta(marcas: MarcaGrid[]): RespostaGrid {
  const horas = [...marcas]
    .sort(
      (a, b) =>
        GRID_DIAS.indexOf(a.dia) - GRID_DIAS.indexOf(b.dia) || a.hora - b.hora
    )
    .map((m) => ({ dia: m.dia, hora: m.hora }));
  const vistos = new Set<string>();
  const celulas = marcas
    .map((m) => ({ dia: m.dia, periodo: horaParaPeriodo(m.hora) }))
    .filter((c) => {
      const k = `${c.dia}:${c.periodo}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  return { celulas, horas };
}

/** RespostaGrid → Disponibilidade canônica do perfil (o que
 *  NovaPessoaDialog espera no estado da grade 7×3). Fora do formato
 *  esperado devolve null — o dialog abre com a grade vazia, nunca quebra. */
export function respostaParaDisponibilidade(
  v: RespostaValor | undefined
): Disponibilidade | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const cel = (v as RespostaGrid).celulas;
  if (!Array.isArray(cel) || !cel.length) return null;
  return {
    celulas: cel
      .filter(
        (c): c is { dia: string; periodo: string } =>
          !!c && typeof c === "object" && !!c.dia && !!c.periodo
      )
      .map((c) => ({
        dia: c.dia as Disponibilidade["celulas"][number]["dia"],
        periodo: c.periodo as Disponibilidade["celulas"][number]["periodo"],
      })),
  };
}

/** Verbatim horário restaurado do jsonb — pra re-renderizar a grade
 *  (rascunho local) e exibir a leitura fina na ficha da resposta. */
export function respostaParaHoras(v: RespostaValor | undefined): MarcaGrid[] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  const horas = (v as RespostaGrid).horas;
  if (!Array.isArray(horas)) return [];
  return horas.filter(
    (h): h is MarcaGrid =>
      !!h &&
      typeof h === "object" &&
      (GRID_DIAS as readonly string[]).includes(h.dia) &&
      typeof h.hora === "number" &&
      GRID_HORAS.includes(h.hora as (typeof GRID_HORAS)[number])
  );
}

// ---------- promoção: resposta → prefill do cadastro ----------

/** Tudo que a NovaPessoaDialog consegue pré-preencher a partir da
 *  resposta de intake. Chaves = nomes dos inputs do form de cadastro. */
export type PrefillIntake = {
  nome: string;
  nome_social: string;
  email: string;
  whatsapp: string;
  data_nascimento: string;
  genero: string;
  cor_raca: string;
  cidade: string;
  uf: string;
  cargo: string;
  empresa: string;
  origem: string;
  motivacao: string;
  pref_genero_par: string;
  disponibilidade: Disponibilidade | null;
  experiencia_previa: string;
  formacao_externa: string;
};

const str = (v: RespostaValor | undefined): string =>
  typeof v === "string" ? v.trim() : "";

/** cor/raça do form ("Negra", "Parda", "Outro: quilombola"…) → enum do
 *  perfil (pref_*, cor_raca): matching aceita os 6 do enum + "outro". */
const COR_RACA_PARA_ENUM: Record<string, string> = {
  negra: "negra",
  branca: "branca",
  amarela: "amarela",
  parda: "parda",
  indigena: "indigena",
  indígena: "indigena",
};

/** genero do form (rótulos do Google) → enum genero do perfil (0034:
 *  feminino/masculino/nao_binario/outro/prefiro_nao_dizer — transgênero
 *  cai em "outro" sem perder o verbatim, que segue na resposta). */
const GENERO_PARA_ENUM: Record<string, string> = {
  "cisgênero feminino": "feminino",
  "cisgênero masculino": "masculino",
  transgênero: "outro",
  "não binário": "nao_binario",
  "prefiro não informar": "prefiro_nao_dizer",
};

/** "Preferência de gênero do mentorado" → pref_genero_par do perfil
 *  (0034: feminino/masculino/indiferente). */
const PREF_PARA_ENUM: Record<string, string> = {
  "mentorado homem": "masculino",
  "mentorada mulher": "feminino",
  "sem preferência": "indiferente",
};

const baixa = (s: string) =>
  s
    .toLocaleLowerCase("pt-BR")
    .normalize("NFC")
    .trim();

/** Mapeia a resposta saneada do intake pros campos do cadastro. Campos
 *  que não existem no perfil (hobbies, valores…) ficam só na resposta —
 *  a trilha integral vive em formulario_respostas, o cadastro carrega o
 *  que o modelo conhece. `cor_raca` "Outro: x" → enum 'outro' (o texto
 *  livre segue na resposta). */
export function prefillDoIntake(
  respostas: Record<string, RespostaValor>
): PrefillIntake {
  const cidade = str(respostas.cidade);
  // "Estado/município" do form ("São Paulo/SP", "Campinas - SP") → UF +
  // cidade pra ficha; sem padrão reconhecido vai tudo pra cidade
  let uf = "";
  let cidadeLimpa = cidade;
  const mUf = /[\/\-–,]\s*([A-Za-z]{2})\s*$/.exec(cidade);
  if (mUf) {
    uf = mUf[1].toUpperCase();
    cidadeLimpa = cidade.slice(0, mUf.index).trim();
  }
  const cor = baixa(str(respostas.cor_raca));
  const expPrevia = str(respostas.experiencia_previa);
  const expDescricao = str(respostas.experiencia_descricao);
  return {
    nome: str(respostas.nome_civil),
    nome_social: str(respostas.nome_social),
    email: str(respostas.email),
    whatsapp: str(respostas.telefone),
    data_nascimento: str(respostas.nascimento),
    genero: GENERO_PARA_ENUM[baixa(str(respostas.genero))] ?? "",
    cor_raca: cor.startsWith("outro:")
      ? "outro"
      : (COR_RACA_PARA_ENUM[cor] ?? ""),
    cidade: cidadeLimpa,
    uf,
    cargo: str(respostas.cargo),
    empresa: str(respostas.empresa),
    origem: "Inscrição pública (Matching de Mentores)",
    motivacao: str(respostas.objetivos),
    pref_genero_par:
      PREF_PARA_ENUM[baixa(str(respostas.pref_genero_mentorado))] ?? "",
    disponibilidade: respostaParaDisponibilidade(respostas.disponibilidade),
    experiencia_previa:
      expPrevia === "sim"
        ? expDescricao || "Experiência prévia declarada no formulário de inscrição."
        : "",
    formacao_externa:
      str(respostas.formacao_erlich) === "sim"
        ? "Formação Erlich Mentoring"
        : "",
  };
}

/** Campos 'arquivo' da definição (curriculo/foto/doc/comprovante) — o
 *  finisher da promoção itera por eles copiando storage → storage. */
export function camposArquivo(campos: FormularioCampo[]): FormularioCampo[] {
  return campos.filter((c) => c.tipo === "arquivo");
}
