// Normalização agressiva de valores de entrada (REALIZA-118) — camada pura,
// sem I/O, compartilhada pelo form público (/f/<token>), o builder/preview
// e o import CSV. Regra decidida: normalizar o máximo possível e rejeitar
// só o impossível — entrada estrita joga fora gente real que errou
// digitação no Google Forms ("maria@@gmail", "(11)9.9999-8888").
//
// Toda função devolve { valor, mudou, aviso } — o chamador decide o destino:
//   · valor  — string pronta pra gravar; null = impossível de resgatar
//              (aí sim o validador decide: obrigatório falha, opcional
//              vira ausência + flag de revisão);
//   · mudou  — o conteúdo foi reescrito (além do trim); alimenta o diff
//              "de → para" da prévia do import;
//   · aviso  — setado quando o resgate foi uma aposta (vários valores na
//              célula, ano de 2 dígitos, zero de DDD à esquerda): o dado
//              passa, mas pede revisão humana.
//
// A validação real continua onde sempre esteve (RPC formularios_limpa_
// respostas, CHECKs, fichaLinha): aqui só se limpa o que a planilha e o
// teclado sujam — normalizar não é validar.

import type {
  AppRole,
  CorRaca,
  Escolaridade,
  Genero,
  PrefGeneroPar,
} from "../types";

export type NormResult<T = string> = {
  valor: T | null;
  /** o normalizador reescreveu o conteúdo — o "de → para" da prévia */
  mudou: boolean;
  /** resgate ambíguo — passou, mas um humano devia conferir */
  aviso?: string;
};

/** Mesma régua do fuzzy de enums/headers: sem acento + minúscula + trim. */
export function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Texto livre — trim + colapso de espaço duplicado. Vazio vira null. */
export function normalizaTexto(s: string): NormResult {
  const v = s.trim().replace(/\s+/g, " ");
  return { valor: v || null, mudou: v !== s.trim() };
}

// ---------- e-mail ----------

/** Mesma régua do emailValido do import: um "@", domínio multi-label,
 *  TLD ≥2, sem ".." nem espaços. Exportada pra UI checar o resultado. */
export const EMAIL_VALIDO_RE = /^[^\s@.][^\s@]*@([^\s@.]+\.)+[^\s@.]{2,}$/;

export function emailValido(s: string): boolean {
  return EMAIL_VALIDO_RE.test(s) && !s.includes("..");
}

/** E-mail de planilha/form: trim + minúscula e os colapsos óbvios —
 *  espaços (e-mail nunca tem), `@@`→`@`, `..`→`.`, `<a@b>`, `mailto:`,
 *  pontuação de cola nas pontas. Apostas flagradas em `aviso`: célula com
 *  mais de um e-mail (fica o 1º) e vírgula no lugar do ponto do domínio
 *  ("gmail,com" — clássico de teclado BR). Não inventa domínio nem local:
 *  sem "@" ou ainda inválido depois dos colapsos → null. */
export function normalizaEmail(s: string): NormResult {
  const cru = s.trim();
  if (!cru) return { valor: null, mudou: false };

  let aviso: string | undefined;
  let v = cru
    .toLowerCase()
    .replace(/^mailto:/i, "")
    // <a@b.com>, (a@b.com), "a@b.com", — envoltórios de cópia/cola e a
    // cola de lista nas pontas (a vírgula do meio é tratada mais abaixo:
    // ou separa dois e-mails ou vira o ponto do domínio)
    .replace(/^[<("',;:]+|[>)"',;:]+$/g, "");

  // mais de um e-mail na célula ("a@x.com; b@y.com", "a@x e b@y"): separa
  // ANTES de colar os espaços, e só quando cada pedaço tem "@" — senão
  // "maria@gmail,com" (vírgula que é ponto) partiria no meio
  const partes = v.split(/[;,]|\s+(?:e|ou)\s+/i).filter((p) => p.trim());
  if (partes.length > 1 && partes.every((p) => p.includes("@"))) {
    v = partes[0];
    aviso = "tinha mais de um e-mail — ficou o primeiro";
  }

  v = v
    // espaço nunca é parte de e-mail — some inteiro, até dentro do local
    .replace(/\s+/g, "")
    // cola de final de linha/CSV nas bordas
    .replace(/^[.,;:]+|[.,;:]+$/g, "");

  if ((v.match(/@/g) ?? []).length === 1 && v.includes(",")) {
    // um "@" só + vírgula = vírgula no lugar do ponto do domínio
    v = v.replace(/,/g, ".");
    aviso = "vírgula no lugar de ponto — conferir";
  }

  v = v
    // "@@", "..", "@." e ".@" — duplicatas de digitação
    .replace(/@{2,}/g, "@")
    .replace(/\.{2,}/g, ".")
    .replace(/@\.+/, "@")
    .replace(/\.+@/, "@");

  if (!emailValido(v)) {
    return { valor: null, mudou: v !== cru, ...(aviso ? { aviso } : {}) };
  }
  return { valor: v, mudou: v !== cru, ...(aviso ? { aviso } : {}) };
}

// ---------- telefone / WhatsApp ----------

/** Separador entre dois números na mesma célula: "/", "\", ";" e a
 *  conjunção "ou"/"e" com dígito dos dois lados — "11 98888-7777 ou
 *  11 97777-6666" parte em duas metades; o "e" dentro de "55 e 11" não. */
const SEP_TELEFONE = /\s*(?:[/\\;]|\bou\b|\be\b)\s*/i;

/** WhatsApp → só dígitos `55DDDNUMERO` (ou já-DDI quando vem com "+").
 *  Planilha corrompe número em notação científica ("1.1984788783E10") —
 *  expande antes de extrair os dígitos, senão o "E10" vira dígito extra.
 *  Resgata o zero de DDD à esquerda ("0 11 98888-7777") — mas 0800/0900
 *  segue fora (serviço, não WhatsApp). Vários números na célula ficam só
 *  o primeiro, com aviso. */
export function normalizaTelefone(s: string): NormResult {
  const cru = s.trim();
  if (!cru) return { valor: null, mudou: false };

  let src = cru;
  // notação científica de planilha → inteiro
  if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(src)) src = Number(src).toFixed(0);
  // rótulos colados de cópia/cola: "whatsapp:", "tel:", "cel:"
  src = src.replace(/^\s*(?:whats(?:app)?|tel(?:efone)?|cel(?:ular)?|fone)\s*[:：]\s*/i, "");

  // vários números na mesma célula — só parte quando DOIS pedaços têm
  // cara de telefone (8+ dígitos); com um só, o separador era glifo de
  // formatação ("11/98888-7777" não pode virar "9 8888-7777")
  let aviso: string | undefined;
  const usadas = src
    .split(SEP_TELEFONE)
    .filter((p) => p.replace(/\D/g, "").length >= 8);
  if (usadas.length > 1) {
    src = usadas[0];
    aviso = "tinha mais de um número — ficou o primeiro";
  }

  let d = src.replace(/\D/g, "");
  const tinhaPlus = src.includes("+");

  // zero à esquerda de DDD ("0 11 98888-7777" / "0011..."): só resgata
  // quando sobra DDD(11–99) + 8–9 dígitos — 0800/0900 fica fora de propósito
  if (!aviso && /^0+/.test(d) && !tinhaPlus) {
    const semZero = d.replace(/^0+/, "");
    if (/^[1-9]\d{9,10}$/.test(semZero) && !/^8[0]{2}/.test(semZero) && !/^9[0]{2}/.test(semZero)) {
      d = semZero;
      aviso = "zero à esquerda desconsiderado — conferir o número";
    }
  }

  if (d.length < 10 || d.length > 15 || d.startsWith("0")) {
    return { valor: null, mudou: false, ...(aviso ? { aviso } : {}) };
  }
  // "+" no input declara DDI — nunca prefixar 55 nesse caso
  const valor = tinhaPlus ? d : d.length <= 11 ? `55${d}` : d;
  return { valor, mudou: valor !== cru, ...(aviso ? { aviso } : {}) };
}

// ---------- URL / LinkedIn ----------

/** "não tenho", "n/a", "—", "sem": resposta legítima de vazio — sai null
 *  sem flag (não é sujeira, é declaração). */
const URL_VAZIO = /^(?:-|—|–|\.|x+|n\/?a\.?|n[aã]o(?:\s+\w+){0,3}|sem\s+\w+|nenhum[ao]?|nada)\.?$/iu;

/** URL (LinkedIn, site): aceita domínio sem scheme (prefixa https://).
 *  O que claramente não é link — nome próprio, frase, e-mail — volta null
 *  com aviso (o caller grava vazio + flag "revisar"; nunca rejeita). Nega-
 *  ções ("não tenho") voltam null SEM aviso — são resposta, não sujeira. */
export function normalizaUrl(s: string): NormResult {
  const cru = s.trim();
  if (!cru) return { valor: null, mudou: false };
  if (URL_VAZIO.test(semAcento(cru))) return { valor: null, mudou: true };

  const naoLink = { valor: null, mudou: true, aviso: "não parece um link — revisar" } as const;

  // espaço/branco dentro do valor não tem resgate honesto
  if (/\s/.test(cru)) return naoLink;
  // "marcos@gmail.com" num campo de link é e-mail, não URL
  if (emailValido(cru.toLowerCase()) || /^[^\s@]+@[^\s@]+$/.test(cru)) {
    return { valor: null, mudou: true, aviso: "parece um e-mail, não um link — revisar" };
  }

  let v = cru
    .replace(/^[<(]+|[>)]+$/g, "")
    .replace(/[.,;:!?]+$/, ""); // pontuação de cola de texto corrido
  if (!/^https?:\/\//i.test(v)) {
    // esquema estranho ("ftp://", "linkedin://") troca por https; sem
    // esquema só prefixa. "//" sobrando na borda some junto.
    v = /^[a-z][a-z0-9+.-]*:\/\//i.test(v)
      ? v.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "https://")
      : `https://${v.replace(/^\/+/, "")}`;
  }
  try {
    const u = new URL(v);
    // domínio precisa de ponto — "https://marcos" não é link navegável
    if (!u.hostname.includes(".") || u.hostname.endsWith(".")) return naoLink;
    if (u.protocol !== "https:" && u.protocol !== "http:") return naoLink;
    const valor = v.slice(0, 300);
    return {
      valor,
      mudou: valor !== cru,
      // domínio de 1 rótulo com ponto ("marcos.silva") é aposta — pode ser
      // um domínio de verdade ou um nome colado; pede conferência
      ...(u.hostname.split(".").length === 2 &&
        !/\d/.test(u.hostname) &&
        !/^(www|linkedin|github|instagram|twitter|facebook|x|linktr|bit)\./i.test(u.hostname)
        ? { aviso: "domínio incomum — conferir o link" }
        : {}),
    };
  } catch {
    return naoLink;
  }
}

// ---------- data ----------

/** "dd/mm/aaaa", "dd-mm-aaaa", "dd.mm.aaaa", "aaaa-mm-dd", "aaaa/mm/dd",
 *  serial de planilha ("30762" — dias desde 1899-12-30) e os mesmos com
 *  horário colado no fim ("15/03/2024 10:30") → ISO "aaaa-mm-dd". Ano de
 *  2 dígitos resolve por janela (≤ ano atual → 20xx, senão 19xx) com aviso.
 *  Dia/mês impossível (31/02) → null — Date normaliza em vez de falhar,
 *  então a data construída é re-conferida. */
export function normalizaData(s: string, hoje = new Date()): NormResult {
  const cru = s.trim();
  if (!cru) return { valor: null, mudou: false };

  const serialM = /^(\d{5})(\.\d+)?$/.exec(cru);
  const isoM = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(cru);
  const isoBarraM = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(cru);
  const brM = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(cru);

  let iso: string | null = null;
  let aviso: string | undefined;
  if (serialM) {
    iso = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(serialM[1])) * 86400000)
      .toISOString().slice(0, 10);
  } else if (isoM || isoBarraM) {
    const m = (isoM ?? isoBarraM)!;
    iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  } else if (brM) {
    let ano = brM[3];
    if (ano.length === 2) {
      const yy = Number(ano);
      const seculo = Math.floor(hoje.getFullYear() / 100) * 100;
      // janela do ano corrente: "26"→2026, "85"→1985 (nascimento)
      ano = String(seculo - 100 + (yy <= hoje.getFullYear() % 100 ? 100 : 0) + yy);
      aviso = "ano com 2 dígitos — conferir";
    }
    iso = `${ano}-${brM[2].padStart(2, "0")}-${brM[1].padStart(2, "0")}`;
  }
  if (!iso) return { valor: null, mudou: false };

  const d = new Date(`${iso}T12:00:00`);
  const reIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (isNaN(d.getTime()) || reIso !== iso) return { valor: null, mudou: false };
  return { valor: iso, mudou: iso !== cru, ...(aviso ? { aviso } : {}) };
}

/** Despacha pelo `formato` declarado do campo (schema.ts) — a UI pública
 *  resolve o hint uma vez e chama aqui; sem hint o campo é texto livre. */
export function normalizaPorFormato(
  formato: "email" | "telefone" | "url",
  s: string
): NormResult {
  if (formato === "email") return normalizaEmail(s);
  if (formato === "telefone") return normalizaTelefone(s);
  return normalizaUrl(s);
}

// ---------- enums (fuzzy → vocabulário fechado) ----------

/** Régua comum dos mapas de enum: `casos` é avaliado na ordem — o primeiro
 *  padrão que casa vence (a ordem carrega as exceções, ex.: "prefiro não
 *  dizer" e "não binário" antes dos binários). Vazio/não reconhecido →
 *  null; quem decide se a linha morre é o validador, não o mapa. */
function normEnum<T extends string>(
  s: string,
  casos: readonly (readonly [RegExp, T])[]
): NormResult<T> {
  const cru = s.trim();
  const n = semAcento(s);
  if (!n) return { valor: null, mudou: false };
  for (const [re, valor] of casos) {
    if (re.test(n)) return { valor, mudou: valor !== cru };
  }
  return { valor: null, mudou: false };
}

/** "Não tenho preferência", "tanto faz" → indiferente; "mulher" → feminino. */
export function normalizaPrefGenero(s: string): NormResult<PrefGeneroPar> {
  return normEnum<PrefGeneroPar>(s, [
    [/indiferente|tanto faz|qualquer|sem pref|nao tenho pref/, "indiferente"],
    [/fem|mulher/, "feminino"],
    [/masc|homem/, "masculino"],
  ]);
}

/** "cisgênero feminino", "mulher" → feminino; "nb" → nao_binario;
 *  "prefiro não dizer" → prefiro_nao_dizer (ordem importa). */
export function normalizaGenero(s: string): NormResult<Genero> {
  return normEnum<Genero>(s, [
    [/prefiro/, "prefiro_nao_dizer"],
    [/nao.?bin|nb\b/, "nao_binario"],
    [/fem|mulher/, "feminino"],
    [/masc|homem/, "masculino"],
    [/outro/, "outro"],
  ]);
}

/** Autodeclaração de cor/raça → vocabulário do CHECK cor_raca_check. */
export function normalizaCorRaca(s: string): NormResult<CorRaca> {
  return normEnum<CorRaca>(s, [
    [/prefiro/, "prefiro_nao_dizer"],
    [/branc/, "branca"],
    [/negr|pret/, "negra"],
    [/pard/, "parda"],
    [/amarel/, "amarela"],
    [/indig/, "indigena"],
    [/outro/, "outro"],
  ]);
}

export function normalizaEscolaridade(s: string): NormResult<Escolaridade> {
  return normEnum<Escolaridade>(s, [
    [/fund/, "fundamental"],
    [/medio|em\b/, "medio"],
    [/tec/, "tecnico"],
    [/pos|mestrado|doutorado|mba|especializ/, "pos"],
    [/incompleto|cursando|inacabado/, "superior_incompleto"],
    [/superior|graduac|faculdade|bacharel|licenciat/, "superior"],
  ]);
}

/** Papel da equipe — "auxiliar executivo(a)" é o nome na UI; "supervisor"
 *  segue aceito pra planilhas antigas. */
export function normalizaPapel(s: string): NormResult<AppRole> {
  return normEnum<AppRole>(s, [
    [/coord/, "coordenacao"],
    [/supervis|auxiliar/, "supervisor"],
    [/especial/, "mentor_especialista"],
    [/mentor|dpp/, "mentor_dpp"],
  ]);
}
