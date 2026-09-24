"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ESCOLARIDADES,
  GENEROS,
  MOTIVOS_REAGENDAMENTO,
  PREF_GENEROS,
  UFS,
  cicloVigente,
  ciclosOpcoes,
  inicioDefaultDupla,
  maxEncontros,
  parseDisponibilidade,
} from "@/lib/ciclo";
import { cpfValido, erroAmigavel } from "@/lib/utils";
import type { DadosCivis, Disponibilidade, Endereco, Escolaridade, Genero, Notificacao, PrefGeneroPar, ResponsavelCivis, Trilha } from "@/lib/types";
import {
  civisImportado,
  emailValido,
  mapEscolaridade,
  mapGenero,
  mapPrefGenero,
  mapRole,
  normData,
  normEmail,
  normLista,
  normNome,
  normUf,
  normWhatsapp,
  type LinhaImportada,
} from "@/lib/importar";
import { notificar } from "./notificar";
import { demoAtivo, demoRole, limparDemo, marcarOnboardingDemo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { getDemoData } from "./demo/data";

async function me() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, nome, consent_lgpd_em")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, me: data };
}

const FOTO_TIPOS = ["image/png", "image/jpeg", "image/webp"];
const FOTO_MAX = 2 * 1024 * 1024;

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Foto opcional vinda do FormData — sobe pro bucket `avatares` na pasta do
 *  dono (`<id>/<uuid>.<ext>`) e devolve o path. Falha de upload não derruba
 *  o cadastro: vira `aviso` pro caller anexar ao toast. */
async function subirFoto(
  supabase: Supa,
  pasta: string,
  formData: FormData
): Promise<{ path?: string; aviso?: string }> {
  const foto = formData.get("foto");
  if (!(foto instanceof File) || foto.size === 0) return {};
  if (!FOTO_TIPOS.includes(foto.type)) {
    return { aviso: "A foto não entrou — use PNG, JPG ou WebP." };
  }
  if (foto.size > FOTO_MAX) {
    return { aviso: "A foto não entrou — use uma imagem de até 2 MB." };
  }
  const ext = foto.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${pasta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatares")
    .upload(path, foto, { contentType: foto.type });
  if (error) return { aviso: "Cadastro salvo, mas a foto não subiu — tente na edição." };
  return { path };
}

// ---------- pessoas & duplas (coordenação) ----------

const ROLES = ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"] as const;

const MAX_AREAS = 10;
const AREA_MAX_CHARS = 40;

type CamposApresentacao = {
  bio: string | null;
  linkedin: string | null;
  areas: string[] | null;
  voluntariado: string | null;
};

/** Lista de áreas já parseada → trim, sem vazias, dedupe case-insensitive,
 *  teto e cap por tag — espelha o CHECK profiles_areas_ok (0030). */
function areasValidas(itens: string[]): string[] | { error: string } {
  const vistos = new Set<string>();
  const areas: string[] = [];
  for (const item of itens) {
    const tag = item.trim();
    if (!tag) continue;
    const k = tag.toLocaleLowerCase("pt-BR");
    if (vistos.has(k)) continue;
    vistos.add(k);
    areas.push(tag);
  }
  if (areas.length > MAX_AREAS) {
    return { error: `Use no máximo ${MAX_AREAS} áreas.` };
  }
  if (areas.some((a) => a.length > AREA_MAX_CHARS)) {
    return { error: `Cada área pode ter até ${AREA_MAX_CHARS} caracteres.` };
  }
  return areas;
}

/** Normaliza os campos de apresentação do perfil (bio/linkedin/areas/
 *  voluntariado, 0030) — self-edit em /perfil e ficha da coordenação passam
 *  pela mesma validação. `areasKey` permite outro nome de campo quando o
 *  form já tem um `areas` (o do mentor_profile no dialog da coordenação).
 *  `parcial` (onboarding): só valida e devolve as chaves presentes no
 *  FormData — o patch do update não toca no que o passo não mandou. */
function camposApresentacao(
  formData: FormData,
  opts: { areasKey?: string; parcial?: boolean } = {}
): Partial<CamposApresentacao> | { error: string } {
  const { areasKey = "areas", parcial = false } = opts;
  const out: Partial<CamposApresentacao> = {};

  if (!parcial || formData.has("bio")) {
    const bio = String(formData.get("bio") ?? "").trim() || null;
    if (bio && bio.length > 1000) {
      return { error: "A biografia passa de 1.000 caracteres." };
    }
    out.bio = bio;
  }

  if (!parcial || formData.has("linkedin")) {
    const linkedin = String(formData.get("linkedin") ?? "").trim() || null;
    // case-sensitive de propósito — o CHECK profiles_linkedin_http (0030) é `~`
    if (linkedin && !/^https?:\/\//.test(linkedin)) {
      return { error: "Confira o link do LinkedIn — precisa começar com http:// ou https://." };
    }
    out.linkedin = linkedin;
  }

  if (!parcial || formData.has(areasKey)) {
    // CSV (inputs de texto) ou JSON (`["a","b"]` — TagInput do onboarding):
    // começa com "[" é JSON; qualquer falha de parse é formato inválido,
    // não cai pra CSV (guardaria "['x" como tag literal)
    const raw = String(formData.get(areasKey) ?? "");
    let itens: string[];
    if (raw.trimStart().startsWith("[")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { error: "As áreas chegaram num formato inválido." };
      }
      if (!Array.isArray(parsed)) {
        return { error: "As áreas chegaram num formato inválido." };
      }
      itens = parsed.map(String);
    } else {
      itens = raw.split(",");
    }
    const areas = areasValidas(itens);
    if (!Array.isArray(areas)) return areas;
    out.areas = areas.length ? areas : null;
  }

  if (!parcial || formData.has("voluntariado")) {
    const voluntariado = String(formData.get("voluntariado") ?? "").trim() || null;
    if (voluntariado && voluntariado.length > 300) {
      return { error: "A experiência com voluntariado passa de 300 caracteres." };
    }
    out.voluntariado = voluntariado;
  }

  return out;
}

// ---------- ficha pessoal & matching (0034) ----------
// validação espelha os CHECKs da migration — erro claro em pt-BR em vez de
// 23514 do banco. `parcial` (onboarding): só as chaves presentes no FormData
// voltam no patch — o passo do wizard não toca no que não mandou.

const MAX_INTERESSES = 20;
const INTERESSE_MAX_CHARS = 60;

/** Interesses do TagInput (JSON) ou campo texto (CSV/`;`) — trim, dedupe
 *  case-insensitive, teto e cap por tag = CHECK interesses_ok (0034). */
function interessesValidos(raw: string): string[] | { error: string } {
  let itens: string[];
  if (raw.trimStart().startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: "Os interesses chegaram num formato inválido." };
    }
    if (!Array.isArray(parsed)) {
      return { error: "Os interesses chegaram num formato inválido." };
    }
    itens = parsed.map(String);
  } else {
    itens = normLista(raw);
  }
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const item of itens) {
    const tag = item.trim();
    if (!tag) continue;
    const k = tag.toLocaleLowerCase("pt-BR");
    if (vistos.has(k)) continue;
    vistos.add(k);
    lista.push(tag);
  }
  if (lista.length > MAX_INTERESSES) {
    return { error: `Use no máximo ${MAX_INTERESSES} interesses.` };
  }
  if (lista.some((t) => t.length > INTERESSE_MAX_CHARS)) {
    return { error: `Cada interesse pode ter até ${INTERESSE_MAX_CHARS} caracteres.` };
  }
  return lista;
}

type CamposFicha = Partial<{
  nome_social: string | null;
  data_nascimento: string | null;
  genero: Genero | null;
  cidade: string | null;
  uf: string | null;
  interesses: string[];
  motivacao: string | null;
  pref_genero_par: PrefGeneroPar | null;
  origem: string | null;
  cargo: string | null;
  empresa: string | null;
  objetivos: string | null;
  escolaridade: Escolaridade | null;
  disponibilidade: Disponibilidade | null;
  dados_civis: DadosCivis | null;
  responsavel: ResponsavelCivis | null;
}>;

/** Dados civis (0046) → jsonb na ficha. `prefix` isola o bloco do
 *  responsável ("resp_"); `deFicha` junta nome/nascimento/cidade/UF dos
 *  campos que a ficha já tem (modo compacto do DadosCivisFields). Tudo
 *  vazio → null (não grava esqueleto); CPF/CEP preenchidos mas inválidos
 *  viram erro — dado errado entraria no termo sem ninguém perceber. */
function parseCivis(
  formData: FormData,
  opts: { prefix?: string; deFicha?: boolean } = {}
): DadosCivis | { error: string } | null {
  const { prefix = "", deFicha = false } = opts;
  const c = (k: string) => String(formData.get(`${prefix}${k}`) ?? "").trim();
  const endereco: Endereco = {
    logradouro: c("logradouro"),
    numero: c("numero"),
    complemento: c("complemento") || null,
    bairro: c("bairro"),
    cidade: deFicha ? String(formData.get("cidade") ?? "").trim() : c("cidade"),
    uf: (deFicha ? String(formData.get("uf") ?? "") : c("uf")).trim().toUpperCase(),
    cep: c("cep").replace(/\D/g, ""),
  };
  const dados: DadosCivis = {
    nome_civil: deFicha
      ? String(formData.get("nome") ?? "").trim()
      : c("nome_civil"),
    rg: c("rg"),
    cpf: c("cpf").replace(/\D/g, ""),
    data_nascimento:
      (deFicha
        ? String(formData.get("data_nascimento") ?? "")
        : c("data_nascimento")
      ).trim() || null,
    endereco,
  };
  const temAlgo =
    dados.rg ||
    dados.cpf ||
    endereco.logradouro ||
    endereco.cep ||
    endereco.bairro ||
    endereco.numero ||
    (!deFicha && (dados.nome_civil || endereco.cidade || dados.data_nascimento));
  if (!temAlgo) return null;
  if (dados.cpf && !cpfValido(dados.cpf))
    return { error: `CPF inválido${prefix ? " (responsável)" : ""} — confira os dígitos.` };
  if (endereco.cep && endereco.cep.length !== 8)
    return { error: `CEP inválido${prefix ? " (responsável)" : ""}.` };
  return dados;
}

/** Ficha pessoal/matching comum a profiles e mentorados (0034). `de` liga os
 *  campos exclusivos de cada tabela (cargo/empresa só em profiles; objetivos/
 *  escolaridade só em mentorados). Vazio vira null; enums fora do vocabulário
 *  e datas impossíveis viram erro antes do CHECK. */
function camposFicha(
  formData: FormData,
  opts: { parcial?: boolean; de: "pessoa" | "mentorado" }
): CamposFicha | { error: string } {
  const { parcial = false, de } = opts;
  const tem = (k: string) => !parcial || formData.has(k);
  const out: CamposFicha = {};

  // texto livre com teto do CHECK — vazio vira null
  const textos: [keyof CamposFicha & string, number, string][] = [
    ["nome_social", 150, "Nome social"],
    ["cidade", 100, "Cidade"],
    ["origem", 300, "Como conheceu o programa"],
    ["motivacao", 2000, "Motivação"],
    ...(de === "pessoa"
      ? [["cargo", 120, "Cargo"], ["empresa", 150, "Empresa"]] as [keyof CamposFicha & string, number, string][]
      : [["objetivos", 2000, "Objetivos com a mentoria"]] as [keyof CamposFicha & string, number, string][]),
  ];
  for (const [key, max, rotulo] of textos) {
    if (!tem(key)) continue;
    const v = String(formData.get(key) ?? "").trim() || null;
    if (v && v.length > max) {
      return { error: `O campo "${rotulo}" aceita até ${max} caracteres.` };
    }
    (out as Record<string, unknown>)[key] = v;
  }

  if (tem("data_nascimento")) {
    const raw = String(formData.get("data_nascimento") ?? "").trim();
    if (!raw) {
      out.data_nascimento = null;
    } else {
      const iso = normData(raw);
      if (!iso || iso > new Date().toISOString().slice(0, 10)) {
        return { error: "Confira a data de nascimento." };
      }
      out.data_nascimento = iso;
    }
  }

  // Selects opcionais mandam "__nenhum" quando "Não informado" está marcado
  // (mesmo contrato do supervisor nos dialogs de dupla) — vira null aqui
  const enumOu = (key: string): string => {
    const v = String(formData.get(key) ?? "").trim();
    return v === "__nenhum" ? "" : v;
  };

  if (tem("genero")) {
    const v = enumOu("genero");
    if (!v) out.genero = null;
    else if (!(GENEROS as readonly string[]).includes(v)) {
      return { error: "Escolha uma opção de gênero válida." };
    } else out.genero = v as Genero;
  }

  if (tem("pref_genero_par")) {
    const v = enumOu("pref_genero_par");
    if (!v) out.pref_genero_par = null;
    else if (!(PREF_GENEROS as readonly string[]).includes(v)) {
      return { error: "Escolha uma preferência de gênero válida." };
    } else out.pref_genero_par = v as PrefGeneroPar;
  }

  if (tem("uf")) {
    const v = enumOu("uf").toUpperCase();
    if (!v) out.uf = null;
    else if (!(UFS as readonly string[]).includes(v)) {
      return { error: "Escolha um estado (UF) válido." };
    } else out.uf = v;
  }

  if (tem("interesses")) {
    const lista = interessesValidos(String(formData.get("interesses") ?? ""));
    if (!Array.isArray(lista)) return lista;
    out.interesses = lista;
  }

  if (de === "mentorado" && tem("escolaridade")) {
    const v = enumOu("escolaridade");
    if (!v) out.escolaridade = null;
    else if (!(ESCOLARIDADES as readonly string[]).includes(v)) {
      return { error: "Escolha uma escolaridade válida." };
    } else out.escolaridade = v as Escolaridade;
  }

  // grade do jovem (0038) — mesmo formato da de mentor_profiles; pra
  // `de === "pessoa"` a disponibilidade vive em camposMentor, não aqui
  if (de === "mentorado" && tem("disponibilidade")) {
    const disp = parseDisponibilidade(String(formData.get("disponibilidade") ?? ""));
    if (disp && "error" in disp) return { error: disp.error };
    out.disponibilidade = disp;
  }

  // dados civis (0046) — só quando o form renderiza o bloco; o wizard de
  // onboarding e a edição de perfil não carregam esses campos, então o
  // tem() protege gravações acidentais em updates parciais
  if (tem("civis_rg")) {
    const civis = parseCivis(formData, { prefix: "civis_", deFicha: true });
    if (civis && "error" in civis) return { error: civis.error };
    out.dados_civis = civis;
  }
  if (de === "mentorado" && tem("resp_nome_civil")) {
    const resp = parseCivis(formData, { prefix: "resp_" });
    if (resp && "error" in resp) return { error: resp.error };
    out.responsavel = resp
      ? { ...resp, parentesco: String(formData.get("resp_parentesco") ?? "").trim() }
      : null;
  }

  return out;
}

type CamposMentor = Partial<{
  experiencia_previa: string | null;
  formacao_externa: string | null;
  disponibilidade: Disponibilidade | null;
}>;

/** Ficha de mentor (mentor_profiles, 0034) — experiência prévia, formação
 *  externa e a grade semanal. A disponibilidade chega como JSON
 *  {"dias":[],"periodos":[]} do grid de chips; grade com as duas listas
 *  vazias grava null ("não informado"), nunca um esqueleto vazio. */
function camposMentor(
  formData: FormData,
  opts: { parcial?: boolean } = {}
): CamposMentor | { error: string } {
  const { parcial = false } = opts;
  const tem = (k: string) => !parcial || formData.has(k);
  const out: CamposMentor = {};

  for (const [key, rotulo] of [
    ["experiencia_previa", "Experiência prévia como mentor"],
    ["formacao_externa", "Formação e certificações"],
  ] as const) {
    if (!tem(key)) continue;
    const v = String(formData.get(key) ?? "").trim() || null;
    if (v && v.length > 2000) {
      return { error: `O campo "${rotulo}" aceita até 2.000 caracteres.` };
    }
    out[key] = v;
  }

  if (tem("disponibilidade")) {
    const disp = parseDisponibilidade(
      String(formData.get("disponibilidade") ?? "")
    );
    if (disp && "error" in disp) return { error: disp.error };
    out.disponibilidade = disp;
  }

  return out;
}

/** Carimbo LGPD: checkbox marcado grava now() quando ainda não havia —
 *  desmarcado nunca apaga o carimbo (revogação não é um clique num form). */
function consentPatch(
  formData: FormData,
  atual: string | null | undefined
): { consent_lgpd_em?: string } {
  return formData.get("consent_lgpd") === "on" && !atual
    ? { consent_lgpd_em: new Date().toISOString() }
    : {};
}

/** Mesma validação da ficha, mas sobre uma linha da planilha — valor bruto
 *  preenchido e irreconhecível devolve motivo pra pular a linha (em vez de
 *  gravar null ou estourar no CHECK do insert em lote). */
function fichaLinha(
  l: LinhaImportada,
  de: "pessoa" | "mentorado"
): Record<string, unknown> | { error: string } {
  const out: Record<string, unknown> = {};
  const texto = (campo: keyof LinhaImportada, col: string, max: number, rotulo: string) => {
    const v = normNome(String(l[campo] ?? ""));
    if (v.length > max) return `${rotulo} passa de ${max} caracteres`;
    out[col] = v || null;
    return null;
  };
  const specs: [keyof LinhaImportada, string, number, string][] = [
    ["nome_social", "nome_social", 150, "nome social"],
    ["cidade", "cidade", 100, "cidade"],
    ["origem", "origem", 300, "origem"],
    ["motivacao", "motivacao", 2000, "motivação"],
    ...(de === "pessoa"
      ? [["cargo", "cargo", 120, "cargo"], ["empresa", "empresa", 150, "empresa"]] as [keyof LinhaImportada, string, number, string][]
      : [["objetivos", "objetivos", 2000, "objetivos"]] as [keyof LinhaImportada, string, number, string][]),
  ];
  for (const [campo, col, max, rotulo] of specs) {
    const erro = texto(campo, col, max, rotulo);
    if (erro) return { error: erro };
  }

  const nasc = normData(String(l.data_nascimento ?? ""));
  if (String(l.data_nascimento ?? "").trim() && !nasc)
    return { error: "data de nascimento inválida (use dd/mm/aaaa)" };
  out.data_nascimento = nasc;

  const genero = mapGenero(String(l.genero ?? ""));
  if (String(l.genero ?? "").trim() && !genero) return { error: "gênero não reconhecido" };
  out.genero = genero;

  const uf = normUf(String(l.uf ?? ""));
  if (String(l.uf ?? "").trim() && (!uf || !(UFS as readonly string[]).includes(uf)))
    return { error: "UF inválida (use a sigla, ex.: SP)" };
  out.uf = uf;

  const interesses = normLista(String(l.interesses ?? ""));
  if (interesses.length > MAX_INTERESSES) return { error: `mais de ${MAX_INTERESSES} interesses` };
  if (interesses.some((t) => t.length > INTERESSE_MAX_CHARS))
    return { error: `interesse com mais de ${INTERESSE_MAX_CHARS} caracteres` };
  out.interesses = interesses;

  const pref = mapPrefGenero(String(l.pref_genero_par ?? ""));
  if (String(l.pref_genero_par ?? "").trim() && !pref)
    return { error: "preferência de gênero do par não reconhecida" };
  out.pref_genero_par = pref;

  if (de === "mentorado") {
    const esc = mapEscolaridade(String(l.escolaridade ?? ""));
    if (String(l.escolaridade ?? "").trim() && !esc)
      return { error: "escolaridade não reconhecida" };
    out.escolaridade = esc;

    const resp = civisImportado(l, "resp_");
    const parentesco = normNome(String(l.resp_parentesco ?? ""));
    if (resp) out.responsavel = { ...resp, parentesco };
  }

  // dados civis (0046) — as colunas de documento/endereço viram o jsonb que
  // preenche os termos; nome/nascimento/cidade/UF vêm da própria ficha
  const civis = civisImportado(l, "", {
    nome_civil: normNome(l.nome),
    data_nascimento: out.data_nascimento as string | null,
    cidade: (out.cidade as string | null) ?? "",
    uf: (out.uf as string | null) ?? "",
  });
  if (civis) out.dados_civis = civis;

  return out;
}

export async function createPessoa(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const role = String(formData.get("role") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const whatsappRaw = String(formData.get("whatsapp") ?? "");
  const whatsapp = normWhatsapp(whatsappRaw);
  if (!nome || !email) return { error: "Nome e e-mail são obrigatórios." };
  if (!emailValido(email)) return { error: "Confira o e-mail." };
  if (whatsappRaw.trim() && !whatsapp) return { error: "Confira o WhatsApp — use DDD e o número completo." };
  if (!(ROLES as readonly string[]).includes(role)) return { error: "Escolha um papel válido." };
  const ficha = camposFicha(formData, { de: "pessoa" });
  if ("error" in ficha) return { error: ficha.error };
  const mentorCampos = camposMentor(formData);
  if ("error" in mentorCampos) return { error: mentorCampos.error };

  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({
      nome,
      email,
      whatsapp: whatsapp || null,
      role,
      ...ficha,
      ...consentPatch(formData, null),
    })
    .select("id")
    .single();
  if (error) return { error: erroAmigavel(error) };

  // foto opcional — depois do insert, porque a pasta é o id novo da pessoa
  let aviso: string | undefined;
  const foto = await subirFoto(supabase, profile.id, formData);
  if (foto.path) {
    const { error: avErr } = await supabase
      .from("profiles").update({ avatar_path: foto.path }).eq("id", profile.id);
    if (avErr) aviso = "Cadastro salvo, mas a foto não subiu — tente na edição.";
  } else {
    aviso = foto.aviso;
  }

  if (role === "mentor_dpp" || role === "mentor_especialista") {
    const capacidade = Number(formData.get("capacidade") || 1);
    if (!Number.isInteger(capacidade) || capacidade < 1) {
      return { error: "Informe uma capacidade de pelo menos 1." };
    }
    // o profile já foi gravado — se isso falhar, o mentor fica sem perfil de
    // mentor e o erro precisa aparecer (não engolir como antes)
    const { error: mpErr } = await supabase.from("mentor_profiles").insert({
      profile_id: profile.id,
      tipo: role === "mentor_dpp" ? "dpp" : "especialista",
      capacidade,
      ...mentorCampos,
    });
    if (mpErr) return { error: erroAmigavel(mpErr) };
  }
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${profile.id}`);
  return { ok: true, aviso };
}

export async function createMentorado(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const nome = normNome(String(formData.get("nome") ?? ""));
  if (!nome) return { error: "Nome é obrigatório." };
  const email = normEmail(String(formData.get("email") ?? ""));
  if (email && !emailValido(email)) return { error: "Confira o e-mail." };
  // lixo digitado não pode zerar o campo silenciosamente
  const whatsappRaw = String(formData.get("whatsapp") ?? "");
  const whatsapp = normWhatsapp(whatsappRaw);
  if (whatsappRaw.trim() && !whatsapp) return { error: "Confira o WhatsApp — use DDD e o número completo." };
  const ficha = camposFicha(formData, { de: "mentorado" });
  if ("error" in ficha) return { error: ficha.error };
  const { data: mentorado, error } = await supabase.from("mentorados").insert({
    nome,
    email: email || null,
    whatsapp: whatsapp || null,
    ong_origem: String(formData.get("ong_origem") ?? "").trim() || null,
    notas: String(formData.get("notas") ?? "").trim() || null,
    ...ficha,
  }).select("id").single();
  if (error) return { error: erroAmigavel(error) };

  let aviso: string | undefined;
  const foto = await subirFoto(supabase, mentorado.id, formData);
  if (foto.path) {
    const { error: avErr } = await supabase
      .from("mentorados").update({ avatar_path: foto.path }).eq("id", mentorado.id);
    if (avErr) aviso = "Cadastro salvo, mas a foto não subiu — tente na edição.";
  } else {
    aviso = foto.aviso;
  }
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${mentorado.id}`);
  return { ok: true, aviso };
}

/** Ciclos conhecidos do programa + o calendário oficial (o caller reusa pra
 *  derivar o vigente e o 1º encontro do ciclo escolhido, sem segunda query). */
async function dadosCiclos(supabase: Supa) {
  const [{ data: evs }, { data: dps }] = await Promise.all([
    supabase.from("ciclo_eventos").select("ciclo, tipo, data"),
    supabase.from("duplas").select("ciclo"),
  ]);
  return {
    evs: (evs ?? []) as { ciclo: string | null; tipo: string; data: string }[],
    ciclos: ciclosOpcoes(evs ?? [], (dps ?? []).map((d) => d.ciclo)),
  };
}

export async function createDupla(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const mentor_id = String(formData.get("mentor_id") ?? "");
  const mentorado_id = String(formData.get("mentorado_id") ?? "");
  const supervisor_id = String(formData.get("supervisor_id") || "") || null;
  if (!mentor_id || !mentorado_id) return { error: "Escolha o mentor e o mentorado." };
  // ciclo vem do select do dialog; vazio cai no vigente do calendário. Um
  // valor fora da lista conhecida é recusado antes de qualquer escrita.
  const cicloRaw = String(formData.get("ciclo") ?? "").trim();
  const { evs: evsCiclo, ciclos: ciclosConhecidos } = await dadosCiclos(supabase);
  if (cicloRaw && !ciclosConhecidos.includes(cicloRaw)) {
    return { error: "Escolha um ciclo da lista." };
  }
  const ciclo = cicloRaw || cicloVigente(evsCiclo) || undefined;
  const { data: mentor } = await supabase
    .from("profiles").select("role").eq("id", mentor_id).single();
  if (mentor?.role !== "mentor_dpp" && mentor?.role !== "mentor_especialista") {
    return { error: "A pessoa escolhida como mentor não tem papel de mentor." };
  }
  // a trilha é derivada do papel do mentor — o client não escolhe (o campo
  // oculto/role no banco é a fonte de verdade; mentor_especialista nunca vira DPP)
  const trilha: Trilha = mentor.role === "mentor_especialista" ? "especialista" : "dpp";
  // dupla de especialista não tem supervisor — força null mesmo se o form mandar
  const supervisorFinal = trilha === "especialista" ? null : supervisor_id;
  if (supervisorFinal) {
    const { data: supervisor } = await supabase
      .from("profiles").select("role").eq("id", supervisorFinal).single();
    if (supervisor?.role !== "supervisor") {
      return { error: "A pessoa escolhida como supervisor não tem esse papel." };
    }
  }
  // um mentorado ocupa uma vaga POR trilha — a dupla de especialista convive
  // com a DPP em paralelo (índice único do 0027 é ciclo+mentorado+trilha)
  const { data: emDupla } = await supabase
    .from("duplas").select("id")
    .eq("mentorado_id", mentorado_id)
    .eq("trilha", trilha)
    .in("status", ["ativa", "pausada"])
    .limit(1);
  if (emDupla?.length) {
    return {
      error:
        trilha === "especialista"
          ? "Esse mentorado já está em uma dupla de especialista ativa."
          : "Esse mentorado já está em uma dupla ativa.",
    };
  }
  // mentor sem linha em mentor_profiles vale capacidade 1
  const [{ data: doMentor }, { data: mp }] = await Promise.all([
    supabase.from("duplas").select("id")
      .eq("mentor_id", mentor_id).in("status", ["ativa", "pausada"]),
    supabase.from("mentor_profiles").select("capacidade")
      .eq("profile_id", mentor_id).maybeSingle(),
  ]);
  if ((doMentor?.length ?? 0) >= (mp?.capacidade ?? 1)) {
    return { error: "Esse mentor já atingiu o número máximo de duplas." };
  }
  const iniciadaRaw = String(formData.get("iniciada_em") || "").trim();
  if (iniciadaRaw && !/^\d{4}-\d{2}-\d{2}$/.test(iniciadaRaw)) {
    return { error: "Confira a data de início." };
  }
  // sem data informada, a dupla DPP nasce uma semana antes do 1º encontro
  // oficial do ciclo — coord cadastra a dupla depois dela existir de fato, e
  // "hoje" apagaria os encontros já passados do semáforo. A especialista não
  // tem calendário a ancorar: sem data informada, cai direto em hoje.
  let iniciada_em = iniciadaRaw;
  if (!iniciada_em) {
    if (trilha === "especialista") {
      iniciada_em = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    } else {
      // 1º encontro DO ciclo escolhido — evsCiclo já tem o calendário inteiro
      const primeiroEv = evsCiclo
        .filter((e) => e.tipo === "encontro" && (!ciclo || e.ciclo === ciclo))
        .sort((a, b) => a.data.localeCompare(b.data))[0];
      iniciada_em = primeiroEv
        ? inicioDefaultDupla([{ tipo: "encontro", data: primeiroEv.data }])!
        : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    }
  }
  // a demanda é o contexto da trilha especialista (por que essa mentoria
  // existe) — DPP não tem o campo, fica null
  const demanda = trilha === "especialista"
    ? String(formData.get("demanda") ?? "").trim() || null
    : null;
  const { data: novaDupla, error } = await supabase.from("duplas").insert({
    mentor_id,
    mentorado_id,
    supervisor_id: supervisorFinal,
    iniciada_em,
    trilha,
    demanda,
    // sem ciclo válido resolvido a coluna aplica o default da migration
    ...(ciclo ? { ciclo } : {}),
  }).select("id").single();
  if (error) return { error: erroAmigavel(error) };
  // avisa o mentor — o pareamento é a notícia que muda a rotina dele
  const { data: md } = await supabase
    .from("mentorados").select("nome").eq("id", mentorado_id).single();
  const hrefDupla = novaDupla?.id ? `/duplas/${novaDupla.id}` : "/duplas";
  await notificar(supabase, [
    {
      profile_id: mentor_id,
      tipo: "dupla_formada",
      titulo: "Sua dupla foi formada",
      corpo: md?.nome ? `Você e ${md.nome} — combinem o 1º encontro.` : null,
      href: hrefDupla,
    },
    {
      profile_id: supervisorFinal,
      tipo: "dupla_formada",
      titulo: "Nova dupla sob sua supervisão",
      corpo: md?.nome ? `${md.nome} — acompanhe a ficha da dupla.` : null,
      href: hrefDupla,
    },
  ], eu.id);
  revalidatePath("/duplas");
  revalidatePath("/");
  return { ok: true };
}

export async function setPessoaRole(profileId: string, role: string | null) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (profileId === eu.id) {
    return { error: "Não é possível alterar o próprio cadastro." };
  }
  const novoRole = role && (ROLES as readonly string[]).includes(role) ? role : null;
  // trocar papel de quem está em dupla ativa/pausada deixa a dupla apontando
  // pra quem não é mais mentor/supervisor — e como as policies de escrita
  // amarram mentor_id (não o papel), a pessoa manteria escrita indevida
  const { data: vinculos } = await supabase
    .from("duplas")
    .select("id")
    .or(`mentor_id.eq.${profileId},supervisor_id.eq.${profileId}`)
    .in("status", ["ativa", "pausada"])
    .limit(1);
  if (vinculos?.length) {
    return {
      error:
        "A pessoa está em uma dupla ativa ou pausada — pause, encerre ou reatribua a dupla antes de mudar o papel.",
    };
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: novoRole })
    .eq("id", profileId)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  // RLS esconde a linha → 0 rows sem erro; não pode fingir que salvou
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }

  // mentor_profiles acompanha o papel: mentor tem linha (upsert preserva
  // capacidade/areas/validações existentes), qualquer outro papel remove a linha
  if (novoRole === "mentor_dpp" || novoRole === "mentor_especialista") {
    const { error: mpErr } = await supabase.from("mentor_profiles").upsert({
      profile_id: profileId,
      tipo: novoRole === "mentor_dpp" ? "dpp" : "especialista",
    });
    if (mpErr) return { error: erroAmigavel(mpErr) };
  } else {
    const { error: mpErr } = await supabase
      .from("mentor_profiles").delete().eq("profile_id", profileId);
    if (mpErr) return { error: erroAmigavel(mpErr) };
  }
  revalidatePath("/pessoas");
  return { ok: true };
}

// ---------- gestao ----------

export async function updatePessoa(profileId: string, formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const nome = normNome(String(formData.get("nome") ?? ""));
  const whatsappRaw = String(formData.get("whatsapp") ?? "");
  const whatsapp = normWhatsapp(whatsappRaw);
  const email = normEmail(String(formData.get("email") ?? ""));
  if (!nome) return { error: "Nome é obrigatório." };
  // lixo digitado não pode zerar o campo silenciosamente
  if (whatsappRaw.trim() && !whatsapp) return { error: "Confira o WhatsApp — use DDD e o número completo." };
  if (email && !emailValido(email)) return { error: "Confira o e-mail." };
  // valida antes de qualquer escrita — "abc" virava NaN e 0 gravava;
  // campo presente mas apagado não pode virar 1 silenciosamente
  const capacidadeRaw = String(formData.get("capacidade") ?? "").trim();
  if (formData.has("capacidade") && !capacidadeRaw) {
    return { error: "Informe a capacidade." };
  }
  const capacidade = Number(capacidadeRaw || 1);
  if (formData.has("capacidade") && (!Number.isInteger(capacidade) || capacidade < 1)) {
    return { error: "Informe uma capacidade de pelo menos 1." };
  }

  // e-mail = identidade do link de acesso; só muda enquanto a pessoa nunca entrou
  const { data: atual } = await supabase
    .from("profiles").select("user_id, role, consent_lgpd_em").eq("id", profileId).single();
  // campos de apresentação (0030) — a coordenação edita os mesmos que a
  // pessoa edita em /perfil; o form manda `areas_perfil` porque `areas` já é
  // o campo do mentor_profile
  const apresentacao = camposApresentacao(formData, { areasKey: "areas_perfil" });
  if ("error" in apresentacao) return { error: apresentacao.error };
  // ficha pessoal/matching (0034) — a escrita é table-level: coord edita de
  // qualquer um; os sensíveis que ela lê via view ela também grava aqui
  const ficha = camposFicha(formData, { de: "pessoa" });
  if ("error" in ficha) return { error: ficha.error };
  const mentorCampos = camposMentor(formData);
  if ("error" in mentorCampos) return { error: mentorCampos.error };
  const patch: Record<string, unknown> = {
    nome,
    whatsapp: whatsapp || null,
    ...apresentacao,
    ...ficha,
    ...consentPatch(formData, atual?.consent_lgpd_em),
  };
  if (email && !atual?.user_id) patch.email = email;

  const { data, error } = await supabase
    .from("profiles").update(patch).eq("id", profileId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }

  // foto nova: sobe na pasta do dono, troca o path e remove o arquivo antigo
  let aviso: string | undefined;
  const foto = await subirFoto(supabase, profileId, formData);
  if (foto.path) {
    const { data: atualAv } = await supabase
      .from("profiles").select("avatar_path").eq("id", profileId).single();
    const { error: avErr } = await supabase
      .from("profiles").update({ avatar_path: foto.path }).eq("id", profileId);
    if (avErr) {
      aviso = "Dados salvos, mas a foto não subiu — tente de novo.";
    } else if (atualAv?.avatar_path) {
      await supabase.storage.from("avatares").remove([atualAv.avatar_path]);
    }
  } else {
    aviso = foto.aviso;
  }

  // só mexe no mentor_profile quando o form trouxe os campos — se o fetch do
  // dialog falhou, salvar sem eles não pode zerar capacidade/areas/checklists
  if ((atual?.role === "mentor_dpp" || atual?.role === "mentor_especialista") && formData.has("capacidade")) {
    const areas = String(formData.get("areas") ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const { error: mpErr } = await supabase.from("mentor_profiles").upsert({
      profile_id: profileId,
      tipo: atual.role === "mentor_dpp" ? "dpp" : "especialista",
      capacidade,
      areas,
      termo_ok: formData.get("termo_ok") === "on",
      formacao_ok: formData.get("formacao_ok") === "on",
      ...mentorCampos,
    });
    if (mpErr) return { error: erroAmigavel(mpErr) };
  }
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${profileId}`);
  return { ok: true, aviso };
}

export async function setPessoaAtivo(profileId: string, ativo: boolean, forcar = false) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (profileId === eu.id) {
    return { error: "Não é possível alterar o próprio cadastro." };
  }
  // desativar com duplas em andamento é decisão de impacto: o primeiro chamado
  // devolve a contagem pra UI confirmar; `forcar` conclui de fato
  if (!ativo && !forcar) {
    const { count } = await supabase
      .from("duplas")
      .select("id", { count: "exact", head: true })
      .or(`mentor_id.eq.${profileId},supervisor_id.eq.${profileId}`)
      .in("status", ["ativa", "pausada"]);
    if (count) return { pendente: count };
  }
  const { data, error } = await supabase
    .from("profiles").update({ ativo }).eq("id", profileId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/pessoas");
  revalidatePath("/");
  return { ok: true };
}

export async function deletePessoa(profileId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data: duplas } = await supabase
    .from("duplas").select("id")
    .or(`mentor_id.eq.${profileId},supervisor_id.eq.${profileId}`).limit(1);
  if (duplas?.length)
    return { error: "Essa pessoa tem dupla vinculada. Desative em vez de excluir." };
  const { data: p } = await supabase
    .from("profiles").select("user_id").eq("id", profileId).single();
  if (p?.user_id)
    return { error: "Essa pessoa já entrou na plataforma. Desative em vez de excluir." };
  // documento_path está fora do grant de coluna (0026) — vem da view, que só
  // devolve o campo pra coordenação (a exclusão em si já é coord-only pela RLS)
  const { data: contato } = await supabase
    .from("profiles_contato").select("documento_path").eq("id", profileId).maybeSingle();
  // limpa o documento do bucket pra não deixar objeto órfão (best-effort:
  // a row é a referência; falha aqui não deve impedir excluir o cadastro)
  if (contato?.documento_path) {
    await supabase.storage.from("documentos").remove([contato.documento_path]);
  }
  const { data, error } = await supabase
    .from("profiles").delete().eq("id", profileId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/pessoas");
  return { ok: true };
}

export async function updateMentorado(id: string, formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const nome = normNome(String(formData.get("nome") ?? ""));
  const email = normEmail(String(formData.get("email") ?? ""));
  if (!nome) return { error: "Nome é obrigatório." };
  if (email && !emailValido(email)) return { error: "Confira o e-mail." };
  // lixo digitado não pode zerar o campo silenciosamente
  const whatsappRaw = String(formData.get("whatsapp") ?? "");
  const whatsapp = normWhatsapp(whatsappRaw);
  if (whatsappRaw.trim() && !whatsapp) return { error: "Confira o WhatsApp — use DDD e o número completo." };
  const ficha = camposFicha(formData, { de: "mentorado" });
  if ("error" in ficha) return { error: ficha.error };
  const { data, error } = await supabase.from("mentorados").update({
    nome,
    email: email || null,
    whatsapp: whatsapp || null,
    ong_origem: String(formData.get("ong_origem") ?? "").trim() || null,
    notas: String(formData.get("notas") ?? "").trim() || null,
    ...ficha,
  }).eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }

  // foto nova na edição: sobe, troca o path e remove o arquivo antigo do bucket
  let aviso: string | undefined;
  const foto = await subirFoto(supabase, id, formData);
  if (foto.path) {
    const { data: atual } = await supabase
      .from("mentorados").select("avatar_path").eq("id", id).single();
    const { error: avErr } = await supabase
      .from("mentorados").update({ avatar_path: foto.path }).eq("id", id);
    if (avErr) {
      aviso = "Dados salvos, mas a foto não subiu — tente de novo.";
    } else if (atual?.avatar_path) {
      await supabase.storage.from("avatares").remove([atual.avatar_path]);
    }
  } else {
    aviso = foto.aviso;
  }
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${id}`);
  return { ok: true, aviso };
}

export async function deleteMentorado(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data: duplas } = await supabase
    .from("duplas").select("id").eq("mentorado_id", id).limit(1);
  if (duplas?.length)
    return { error: "Esse mentorado já está em uma dupla. Encerre a dupla antes de excluir." };
  const { data: m } = await supabase
    .from("mentorados").select("documento_path").eq("id", id).single();
  // mesmo cuidado do delete de pessoa: remove o objeto do bucket antes da row
  if (m?.documento_path) {
    await supabase.storage.from("documentos").remove([m.documento_path]);
  }
  const { data, error } = await supabase
    .from("mentorados").delete().eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/pessoas");
  return { ok: true };
}

export async function updateDupla(duplaId: string, formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const mentor_id = String(formData.get("mentor_id") ?? "");
  const mentorado_id = String(formData.get("mentorado_id") ?? "");
  const supervisor_id = String(formData.get("supervisor_id") || "") || null;
  const iniciada_em = String(formData.get("iniciada_em") || "").trim();
  const status = String(formData.get("status") || "ativa");
  if (!mentor_id || !mentorado_id) return { error: "Escolha o mentor e o mentorado." };
  // 'concluida' entra pelo rito de encerramento (0037), não por escolha no
  // dialog — mas a dupla concluída precisa conseguir editar os demais campos
  if (!["ativa", "pausada", "concluida", "encerrada"].includes(status)) return { error: "Escolha um status válido." };
  if (iniciada_em && !/^\d{4}-\d{2}-\d{2}$/.test(iniciada_em)) {
    return { error: "Confira a data de início." };
  }
  // ciclo só muda quando o campo veio no form (dialog sem o campo não mexe);
  // o valor precisa ser um dos ciclos conhecidos — mesmo critério da criação
  let cicloNovo: string | undefined;
  if (formData.has("ciclo")) {
    const cicloRaw = String(formData.get("ciclo") ?? "").trim();
    const { ciclos: conhecidos } = await dadosCiclos(supabase);
    if (!cicloRaw || !conhecidos.includes(cicloRaw)) {
      return { error: "Escolha um ciclo da lista." };
    }
    cicloNovo = cicloRaw;
  }
  // link do PDM (0044): campo presente no form → grava; vazio limpa. A coluna
  // tem CHECK https — valida aqui pra mensagem clara em vez do 23514
  let pdmNovo: string | null | undefined;
  if (formData.has("pdm_url")) {
    const pdm = String(formData.get("pdm_url") ?? "").trim();
    if (pdm && !/^https:\/\/\S+$/i.test(pdm)) {
      return { error: "O link do PDM precisa ser um endereço completo (https://…)." };
    }
    pdmNovo = pdm || null;
  }
  const { data: mentor } = await supabase
    .from("profiles").select("role").eq("id", mentor_id).single();
  if (mentor?.role !== "mentor_dpp" && mentor?.role !== "mentor_especialista") {
    return { error: "A pessoa escolhida como mentor não tem papel de mentor." };
  }
  // a trilha segue o papel do mentor — trocar de mentor DPP pra especialista
  // (ou o contrário) migra a dupla; com encontros já criados ela é imutável
  // (mover numerariação entre calendário e trilha livre exigiria reparo de dados)
  const trilhaNova: Trilha = mentor.role === "mentor_especialista" ? "especialista" : "dpp";
  // dupla ativa/pausada ocupa vaga do mentor e do mentorado; encerrada não ocupa,
  // então só valida quando o novo status volta a contar. A própria dupla sai da
  // conta (.neq) pra edição simples não brigar com ela mesma
  const { data: atualDupla } = await supabase
    .from("duplas").select("mentor_id, mentorado_id, supervisor_id, status, trilha").eq("id", duplaId).single();
  if (atualDupla && trilhaNova !== atualDupla.trilha) {
    const { count } = await supabase
      .from("encontros")
      .select("id", { count: "exact", head: true })
      .eq("dupla_id", duplaId);
    if ((count ?? 0) > 0) {
      return { error: "O tipo de mentoria não pode mudar — a dupla já tem encontros." };
    }
  }
  // dupla de especialista não tem supervisor — null forçado, nunca confia no form
  const supervisorFinal = trilhaNova === "especialista" ? null : supervisor_id;
  if (supervisorFinal) {
    const { data: supervisor } = await supabase
      .from("profiles").select("role").eq("id", supervisorFinal).single();
    if (supervisor?.role !== "supervisor") {
      return { error: "A pessoa escolhida como supervisor não tem esse papel." };
    }
  }
  // só ocupa vaga quem vai pra ativa/pausada — concluída e encerrada liberam,
  // então editar outros campos de uma dupla fechada não revalida capacidade
  if (atualDupla && (status === "ativa" || status === "pausada")) {
    // fechada (encerrada/concluída) voltando a ativa/pausada precisa revalidar
    // — a vaga pode ter sido ocupada por outra dupla enquanto estava fechada
    const voltando =
      atualDupla.status === "encerrada" || atualDupla.status === "concluida";
    if (voltando || mentorado_id !== atualDupla.mentorado_id || trilhaNova !== atualDupla.trilha) {
      const { data: emDupla } = await supabase
        .from("duplas").select("id")
        .eq("mentorado_id", mentorado_id)
        .eq("trilha", trilhaNova)
        .in("status", ["ativa", "pausada"])
        .neq("id", duplaId)
        .limit(1);
      if (emDupla?.length) {
        return { error: "Esse mentorado já está em uma dupla ativa ou pausada nesse tipo de mentoria." };
      }
    }
    if (voltando || mentor_id !== atualDupla.mentor_id) {
      const [{ data: doMentor }, { data: mp }] = await Promise.all([
        supabase.from("duplas").select("id")
          .eq("mentor_id", mentor_id)
          .in("status", ["ativa", "pausada"])
          .neq("id", duplaId),
        supabase.from("mentor_profiles").select("capacidade")
          .eq("profile_id", mentor_id).maybeSingle(),
      ]);
      if ((doMentor?.length ?? 0) >= (mp?.capacidade ?? 1)) {
        return { error: "Esse mentor já atingiu o número máximo de duplas." };
      }
    }
  }
  // iniciada_em em branco preserva a data atual — zerar mudaria a base do semáforo
  const patch: Record<string, unknown> = {
    mentor_id,
    mentorado_id,
    supervisor_id: supervisorFinal,
    status,
    trilha: trilhaNova,
    // demanda só existe na trilha especialista — volta null se a dupla migra
    // pra DPP (correção de mentor errado antes do 1º encontro)
    demanda:
      trilhaNova === "especialista"
        ? String(formData.get("demanda") ?? "").trim() || null
        : null,
    // dupla viva (ativa/pausada) não carrega carimbo de fechamento — reabrir
    // uma trilha especialista limpa o rastro do encerramento anterior
    ...(status === "ativa" || status === "pausada"
      ? { encerrada_em: null, motivo_encerramento: null, devolutiva_pdm: null }
      : {}),
  };
  if (iniciada_em) patch.iniciada_em = iniciada_em;
  if (cicloNovo) patch.ciclo = cicloNovo;
  if (pdmNovo !== undefined) patch.pdm_url = pdmNovo;
  const { data, error } = await supabase.from("duplas").update(patch).eq("id", duplaId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  // troca de mentor/supervisor notifica os DOIS lados — quem entra precisa
  // saber que assumiu, e quem sai não pode ver a dupla sumir sem explicação.
  // Pausa/encerramento também avisa — é o tipo de notícia pra que o sino existe.
  const trocouPessoas =
    atualDupla && (mentor_id !== atualDupla.mentor_id || supervisorFinal !== atualDupla.supervisor_id);
  const mudouStatus =
    atualDupla && status !== atualDupla.status &&
    (status === "pausada" || status === "encerrada" || status === "concluida");
  if (atualDupla && (trocouPessoas || mudouStatus)) {
    const { data: mdTroca } = await supabase
      .from("mentorados").select("nome").eq("id", mentorado_id).single();
    const nomeMd = mdTroca?.nome;
    await notificar(supabase, [
      mentor_id !== atualDupla.mentor_id ? {
        profile_id: mentor_id,
        tipo: "dupla_formada",
        titulo: "Você assumiu uma dupla",
        corpo: nomeMd ? `Você e ${nomeMd} — vejam onde a jornada está.` : null,
        href: `/duplas/${duplaId}`,
      } : null,
      supervisorFinal && supervisorFinal !== atualDupla.supervisor_id ? {
        profile_id: supervisorFinal,
        tipo: "dupla_formada",
        titulo: "Nova dupla sob sua supervisão",
        corpo: nomeMd ? `${nomeMd} — acompanhe a ficha da dupla.` : null,
        href: `/duplas/${duplaId}`,
      } : null,
      // quem sai não enxerga mais a ficha (RLS) — link cai na home, não no 404
      atualDupla.mentor_id && mentor_id !== atualDupla.mentor_id ? {
        profile_id: atualDupla.mentor_id,
        tipo: "dupla_formada",
        titulo: "Sua dupla mudou de mentor",
        corpo: nomeMd
          ? `A dupla com ${nomeMd} segue com outro mentor — a coordenação reorganizou as duplas.`
          : "A coordenação reorganizou as duplas.",
        href: "/",
      } : null,
      atualDupla.supervisor_id && supervisorFinal !== atualDupla.supervisor_id ? {
        profile_id: atualDupla.supervisor_id,
        tipo: "dupla_formada",
        titulo: "Dupla saiu da sua supervisão",
        corpo: nomeMd
          ? `A dupla com ${nomeMd} passou pra outro supervisor.`
          : "A coordenação reorganizou as duplas.",
        href: "/",
      } : null,
      mudouStatus ? {
        profile_id: mentor_id,
        tipo: "dupla_formada",
        titulo:
          status === "pausada"
            ? "Sua dupla foi pausada"
            : status === "concluida"
              ? "Sua dupla concluiu a jornada"
              : "Sua dupla foi encerrada",
        corpo: "A coordenação atualizou a sua dupla — fale com ela se tiver dúvidas.",
        href: `/duplas/${duplaId}`,
      } : null,
      mudouStatus && supervisorFinal ? {
        profile_id: supervisorFinal,
        tipo: "dupla_formada",
        titulo:
          status === "pausada"
            ? "Dupla supervisionada pausada"
            : status === "concluida"
              ? "Dupla supervisionada concluída"
              : "Dupla supervisionada encerrada",
        corpo: nomeMd ? `A dupla com ${nomeMd} — a coordenação fez a alteração.` : null,
        href: `/duplas/${duplaId}`,
      } : null,
    ].filter((r): r is NonNullable<typeof r> => r !== null), eu.id);
  }
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

export async function deleteDupla(duplaId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  // a cascata leva encontros→registros→registro_anexos (rows), mas os OBJETOS
  // do bucket não seguem o cascade — e a policy de delete do storage exige a
  // row do anexo existir, então a ordem é arquivo primeiro, row depois.
  // Falha na remoção aborta a exclusão: dupla apagada com objeto restante
  // viraria lixo invisível no bucket.
  const { data: encs, error: encErr } = await supabase
    .from("encontros").select("id").eq("dupla_id", duplaId);
  const encIds = (encs ?? []).map((e) => e.id);
  const { data: regs, error: regErr } = encIds.length
    ? await supabase.from("registros").select("id").in("encontro_id", encIds)
    : { data: [], error: null };
  const regIds = (regs ?? []).map((r) => r.id);
  const { data: anx, error: anxErr } = regIds.length
    ? await supabase.from("registro_anexos").select("path").in("registro_id", regIds)
    : { data: [], error: null };
  // falha na LEITURA também aborta — com paths incompletos a exclusão
  // deixaria objetos órfãos no bucket
  if (encErr || regErr || anxErr) {
    return {
      error: "Não foi possível localizar os anexos da dupla — nada foi excluído. Tente de novo.",
    };
  }
  const paths = (anx ?? []).map((a) => a.path).filter(Boolean);
  if (paths.length) {
    const { error: stErr } = await supabase
      .storage.from("registro-anexos").remove(paths);
    if (stErr) {
      return {
        error:
          "Não foi possível remover os anexos de evidência da dupla — nada foi excluído. Tente de novo.",
      };
    }
  }
  // cascata remove encontros, registros e encaminhamentos da dupla
  const { data, error } = await supabase
    .from("duplas").delete().eq("id", duplaId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/");
  revalidatePath("/duplas");
  return { ok: true };
}

/** Link do PDM (0044): mentor edita o da própria dupla — UPDATE em duplas é
 *  coord-only, então a escrita real é a RPC `definir_pdm_url` (definer,
 *  escopada). Os checks aqui só antecipam a mensagem amigável; o banco
 *  revalida papel, status e formato. */
export async function definirPdmUrl(duplaId: string, url: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const u = (url ?? "").trim();
  if (u && !/^https:\/\/\S+$/i.test(u)) {
    return { error: "O link do PDM precisa ser um endereço completo (https://…)." };
  }
  const { data: d } = await supabase
    .from("duplas").select("mentor_id, status").eq("id", duplaId).maybeSingle();
  if (!d) return { error: "Não foi possível identificar a dupla. Recarregue a página." };
  if (eu.role !== "coordenacao") {
    if (d.mentor_id !== eu.id) {
      return { error: "Só o mentor da dupla pode definir o link do PDM." };
    }
    if (d.status !== "ativa" && d.status !== "pausada") {
      return { error: "O link do PDM só pode ser editado com a dupla ativa ou pausada." };
    }
  }
  const { error } = await supabase.rpc("definir_pdm_url", {
    p_dupla: duplaId,
    p_url: u || null,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

export async function deleteMaterial(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("materiais").delete().eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/materiais");
  return { ok: true };
}

// ---------- importação ----------

// cap de importação — lote grande demais estoura o payload da action e
// transforma erro de planilha em falha silenciosa no meio do insert
const MAX_IMPORT = 500;

export async function importPessoas(rows: LinhaImportada[]) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao") return { error: "Só a coordenação importa cadastros." };
  if (rows.length > MAX_IMPORT) {
    return { error: `O arquivo tem ${rows.length} linhas — importe em lotes de até ${MAX_IMPORT}.` };
  }
  // email saiu do grant de coluna de profiles (0026) — a view profiles_contato
  // devolve todas as linhas pra coordenação, que é quem chega até aqui
  const { data: existentes } = await supabase.from("profiles_contato").select("email");
  const noBanco = new Set((existentes ?? []).map((p) => p.email.toLowerCase()));
  const vistos = new Set<string>();
  const validas: Record<string, unknown>[] = [];
  // email → ficha de mentor (experiência/formação) — a correlação com o id
  // inserido vem depois por profiles_contato (a ordem do RETURNING não é
  // contratual pra confiar o zip por índice)
  const fichaMentorPorEmail = new Map<string, Record<string, unknown>>();
  const puladas: string[] = [];

  for (const r of rows) {
    const nome = normNome(r.nome);
    const email = normEmail(r.email);
    const whatsapp = normWhatsapp(r.whatsapp);
    // papel em branco cai no default mentor_dpp; preenchido mas irreconhecível pula a linha
    const papelPreenchido = String(r.papel ?? "").trim() !== "";
    const role = papelPreenchido ? mapRole(r.papel) : ("mentor_dpp" as const);
    if (!nome || !emailValido(email)) { puladas.push(`${r.nome || r.email || "?"}: nome vazio ou e-mail inválido`); continue; }
    // whatsapp preenchido mas ilegível pula a linha — antes caía como null silenciosamente
    if (r.whatsapp.trim() && !whatsapp) { puladas.push(`${nome}: whatsapp inválido (use DDD + número)`); continue; }
    if (role === null) { puladas.push(`${nome}: papel não reconhecido`); continue; }
    const ficha = fichaLinha(r, "pessoa");
    if ("error" in ficha) { puladas.push(`${nome}: ${ficha.error}`); continue; }
    // experiência/formação só fazem sentido em linha de mentor — valida antes
    // de entrar na fila, senão a linha "pulada" seria inserida mesmo assim
    const exp = normNome(String(r.experiencia_previa ?? ""));
    const form = normNome(String(r.formacao_externa ?? ""));
    if (exp.length > 2000 || form.length > 2000) { puladas.push(`${nome}: experiência/formação passa de 2.000 caracteres`); continue; }
    if (noBanco.has(email) || vistos.has(email)) { puladas.push(`${email}: já existe`); continue; }
    vistos.add(email);
    validas.push({ nome, email, whatsapp, role, ...ficha });
    if (exp || form) {
      fichaMentorPorEmail.set(email, {
        experiencia_previa: exp || null,
        formacao_externa: form || null,
      });
    }
  }
  if (!validas.length) return { ok: true, criados: 0, puladas };

  const { data: inseridas, error } = await supabase
    .from("profiles").insert(validas).select("id, role");
  if (error) return { error: erroAmigavel(error) };

  // email → id dos mentores que trouxeram ficha de mentor (a view cobre as
  // linhas recém-inseridas pra coordenação)
  let idPorEmail = new Map<string, string>();
  if (fichaMentorPorEmail.size) {
    const { data: contatos } = await supabase
      .from("profiles_contato")
      .select("id, email")
      .in("email", [...fichaMentorPorEmail.keys()]);
    idPorEmail = new Map(
      (contatos ?? []).map((c) => [c.email.toLowerCase(), c.id])
    );
  }
  const mentores = (inseridas ?? [])
    .filter((p) => p.role === "mentor_dpp" || p.role === "mentor_especialista")
    .map((p) => ({
      profile_id: p.id,
      tipo: p.role === "mentor_dpp" ? "dpp" : "especialista",
      // procura a ficha pelo id — extra por email só chega em linha de mentor
      ...(fichaMentorPorEmail.size
        ? [...fichaMentorPorEmail.entries()].find(
            ([em]) => idPorEmail.get(em) === p.id
          )?.[1] ?? {}
        : {}),
    }));
  if (mentores.length) {
    const { error: mpErr } = await supabase.from("mentor_profiles").insert(mentores);
    if (mpErr) {
      puladas.push("Aviso: perfis de mentor não foram criados para alguns importados.");
    }
  }

  revalidatePath("/pessoas");
  return { ok: true, criados: inseridas?.length ?? 0, puladas };
}

export async function importMentorados(rows: LinhaImportada[]) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao") return { error: "Só a coordenação importa cadastros." };
  if (rows.length > MAX_IMPORT) {
    return { error: `O arquivo tem ${rows.length} linhas — importe em lotes de até ${MAX_IMPORT}.` };
  }
  const { data: existentes } = await supabase.from("mentorados").select("nome, whatsapp");
  const nomes = new Set((existentes ?? []).map((m) => normNome(m.nome).toLowerCase()));
  const was = new Set(
    (existentes ?? []).map((m) => normWhatsapp(m.whatsapp ?? "")).filter(Boolean)
  );
  const vistos = new Set<string>();
  const vistosWa = new Set<string>();
  const validas: Record<string, unknown>[] = [];
  const puladas: string[] = [];

  for (const r of rows) {
    const nome = normNome(r.nome);
    const whatsapp = normWhatsapp(r.whatsapp);
    const email = normEmail(r.email);
    if (!nome) { puladas.push("linha sem nome"); continue; }
    if (email && !emailValido(email)) { puladas.push(`${nome}: e-mail inválido`); continue; }
    // whatsapp preenchido mas ilegível pula a linha — antes caía como null silenciosamente
    if (r.whatsapp.trim() && !whatsapp) { puladas.push(`${nome}: whatsapp inválido (use DDD + número)`); continue; }
    const ficha = fichaLinha(r, "mentorado");
    if ("error" in ficha) { puladas.push(`${nome}: ${ficha.error}`); continue; }
    const chave = nome.toLowerCase();
    // vistosWa: mesmo whatsapp com nome diferente no arquivo também é duplicado
    if (nomes.has(chave) || (whatsapp && was.has(whatsapp)) ||
        vistos.has(chave) || (whatsapp && vistosWa.has(whatsapp))) {
      puladas.push(`${nome}: já existe`); continue;
    }
    vistos.add(chave);
    if (whatsapp) vistosWa.add(whatsapp);
    validas.push({
      nome,
      email: email || null,
      whatsapp,
      ong_origem: String(r.ong ?? "").trim() || null,
      notas: String(r.notas ?? "").trim() || null,
      ...ficha,
    });
  }
  if (!validas.length) return { ok: true, criados: 0, puladas };

  const { error } = await supabase.from("mentorados").insert(validas);
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/pessoas");
  return { ok: true, criados: validas.length, puladas };
}

// ---------- encontros (mentor da dupla) ----------

const ORIGENS = ["plataforma", "externo"] as const;

/** URL só http/https — javascript:/data: armazenável renderiza <a href> direto. */
function urlOk(s: string): boolean {
  try { return ["http:", "https:"].includes(new URL(s).protocol); } catch { return false; }
}

/** Aceita os dois formatos que o client manda: ISO com fuso ("...Z" / "+03:00")
 *  vira Date direto; `datetime-local` naïve ("YYYY-MM-DDTHH:mm", sem offset) é
 *  interpretado como horário de São Paulo (-03:00 fixo, sem horário de verão). */
function parseDataHora(s: string): Date | null {
  const d = new Date(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}-03:00`);
  return isNaN(d.getTime()) ? null : d;
}

export async function agendarEncontro(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  // a regra "a dupla agenda" mora na action, não só na UI — a RLS deixaria
  // a coord escrever (policy larga pra correções), então o contrato é aqui
  if (eu.role === "coordenacao") {
    return { error: "Quem agenda é a dupla — a coordenação acompanha o andamento." };
  }
  const dupla_id = String(formData.get("dupla_id") ?? "");
  const numero = Number(formData.get("numero"));
  const data_hora = String(formData.get("data_hora") ?? "");
  const link = String(formData.get("link") ?? "").trim() || null;
  const origem = String(formData.get("origem") || "plataforma");
  const motivo = String(formData.get("motivo") ?? "").trim();
  const motivoOutro = String(formData.get("motivo_outro") ?? "").trim();
  if (!dupla_id || !numero || !data_hora) return { error: "Data e horário são obrigatórios." };
  const { data: d } = await supabase.from("duplas").select("status, trilha").eq("id", dupla_id).single();
  if (d && d.status !== "ativa") return { error: "Essa dupla não está ativa." };
  const quando = parseDataHora(data_hora);
  if (!quando) return { error: "Confira a data." };

  // não derruba um encontro já realizado (re-agendar apagaria o "realizado")
  const { data: existente } = await supabase
    .from("encontros").select("id, status, data_hora").eq("dupla_id", dupla_id).eq("numero", numero).maybeSingle();
  if (existente?.status === "realizado") {
    return { error: "Esse encontro já foi realizado e não pode ser remarcado." };
  }

  // agendamento é sempre pra frente — encontro que já aconteceu entra pelo fluxo
  // retroativo (grava realizado_em); mover um agendado pro passado esconderia
  // atraso. A mensagem aponta o controle que EXISTE, por contexto.
  if (quando.getTime() <= Date.now()) {
    return {
      error: existente
        ? "Essa data já passou — se o encontro aconteceu, registre como foi ou marque 'não aconteceu' na ficha da dupla."
        : "Essa data já passou — use 'Registrar encontro já realizado' na ficha da dupla ou na agenda do dia.",
    };
  }
  if (link && !urlOk(link)) return { error: "Confira o link — precisa ser um endereço completo (https://…)." };
  if (!(ORIGENS as readonly string[]).includes(origem)) return { error: "Não foi possível identificar a origem. Recarregue a página." };

  // teto de nº por trilha — especialista tem 5 passos próprios, sem ciclo_eventos
  const maxNum = d?.trilha === "especialista"
    ? maxEncontros("especialista")
    : (
        await supabase
          .from("ciclo_eventos").select("numero")
          .eq("tipo", "encontro").order("numero", { ascending: false }).limit(1).maybeSingle()
      ).data?.numero ?? 16;
  if (!Number.isInteger(numero) || numero < 1 || numero > maxNum) {
    return { error: "Escolha um encontro da lista." };
  }

  // remarcação de verdade = a data mudou; salvar de novo com a mesma data
  // (só pra trocar o link, p.ex.) não exige motivo nem mexe no já registrado.
  // compara o instante, não a string — PostgREST devolve "+00:00", toISOString "Z"
  const ehReagendamento =
    existente != null &&
    existente.data_hora != null &&
    new Date(existente.data_hora).getTime() !== quando.getTime();
  let motivoReagendamento: string | null = null;
  if (ehReagendamento) {
    if (!motivo) return { error: "Conte o motivo do reagendamento." };
    if (motivo === "outro") {
      if (motivoOutro.length < 2 || motivoOutro.length > 140) {
        return { error: "Descreva o motivo do reagendamento (2 a 140 caracteres)." };
      }
      motivoReagendamento = motivoOutro;
    } else {
      const preset = MOTIVOS_REAGENDAMENTO.find((m) => m.value === motivo);
      if (!preset) return { error: "Escolha um motivo de reagendamento." };
      motivoReagendamento = preset.label;
    }
  }

  // update preserva created_by; insert é a primeira vez do encontro.
  // motivo_reagendamento só entra no payload quando houve remarcação — edição
  // que não muda a data não pode sobrescrever o motivo já auditado
  const payload = {
    data_hora: quando.toISOString(),
    link,
    origem,
    status: "agendado" as const,
    ...(motivoReagendamento ? { motivo_reagendamento: motivoReagendamento } : {}),
  };
  const { error } = existente
    ? await supabase.from("encontros").update(payload).eq("id", existente.id)
    : await supabase.from("encontros").insert({ ...payload, dupla_id, numero, created_by: eu.id });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/agenda");
  revalidatePath(`/duplas/${dupla_id}`);
  return { ok: true };
}

export async function marcarNaoAconteceu(encontroId: string, duplaId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  // só encontro já passado de dupla ativa — UI esconde o botão, a action garante
  const { data: enc } = await supabase
    .from("encontros").select("data_hora, duplas(status)").eq("id", encontroId).single();
  if (enc && new Date(enc.data_hora).getTime() > Date.now()) {
    return { error: "Esse encontro ainda não aconteceu." };
  }
  const dupla = Array.isArray(enc?.duplas) ? enc?.duplas[0] : enc?.duplas;
  if (dupla && dupla.status !== "ativa") return { error: "Essa dupla não está ativa." };
  const { data, error } = await supabase
    .from("encontros")
    .update({ status: "nao_aconteceu" })
    .eq("id", encontroId)
    .eq("status", "agendado")
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) return { error: "Esse encontro não está mais agendado." };
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/agenda");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

export async function desfazerNaoAconteceu(encontroId: string, duplaId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("encontros")
    .update({ status: "agendado" })
    .eq("id", encontroId)
    .eq("status", "nao_aconteceu")
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) return { error: 'Esse encontro não está marcado como "não aconteceu".' };
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/agenda");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

/**
 * Encontro que já aconteceu sem agendamento prévio (combinado fora da
 * plataforma). Nasce direto como realizado — sem ele, a dupla ficava "em
 * atraso" no semáforo mesmo tendo se encontrado.
 */
export async function registrarEncontroRetroativo(
  duplaId: string,
  numero: number,
  dataHora: string,
): Promise<{ error?: string; ok?: boolean; encontroId?: string }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role === "coordenacao") {
    return { error: "O registro é do mentor — a coordenação acompanha o andamento." };
  }
  if (!duplaId || !numero || !dataHora) return { error: "Encontro e data são obrigatórios." };

  const { data: d } = await supabase
    .from("duplas").select("status, iniciada_em, trilha").eq("id", duplaId).single();
  if (!d) return { error: "Dupla não encontrada." };
  // fechada (encerrada/concluída) não ganha encontro novo — a jornada acabou
  if (d.status === "encerrada" || d.status === "concluida") {
    return { error: "Essa dupla já está encerrada." };
  }

  const quando = parseDataHora(dataHora);
  if (!quando) return { error: "Confira a data." };
  if (quando.getTime() > Date.now()) {
    return { error: "A data precisa ser de quando o encontro já aconteceu." };
  }

  // teto de nº e piso de data por trilha — na especialista não existe
  // ciclo_eventos próprio: o teto é o da trilha e o piso é só o início da dupla
  const ehEspecialista = d.trilha === "especialista";
  const { data: evs } = ehEspecialista
    ? { data: null }
    : await supabase
        .from("ciclo_eventos").select("numero, data")
        .eq("tipo", "encontro").order("numero", { ascending: true });
  const maxNum = ehEspecialista ? maxEncontros("especialista") : evs?.at(-1)?.numero ?? 16;
  if (!Number.isInteger(numero) || numero < 1 || numero > maxNum) {
    return { error: "Escolha um encontro da lista." };
  }
  const piso = d.iniciada_em ?? evs?.[0]?.data ?? null;
  if (piso && quando < new Date(`${piso}T00:00:00-03:00`)) {
    return { error: "A data não pode ser antes do início da mentoria." };
  }

  // unique(dupla_id, numero) — check explícito pra mensagem clara antes do 23505
  const { data: existente } = await supabase
    .from("encontros").select("id").eq("dupla_id", duplaId).eq("numero", numero).maybeSingle();
  if (existente) return { error: "Já existe um encontro com esse número." };

  const { data: novo, error } = await supabase
    .from("encontros")
    .insert({
      dupla_id: duplaId,
      numero,
      data_hora: quando.toISOString(),
      realizado_em: quando.toISOString(),
      status: "realizado",
      origem: "externo",
      created_by: eu.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Já existe um encontro com esse número." };
    return { error: erroAmigavel(error) };
  }
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/agenda");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true, encontroId: novo.id };
}

// ---------- registro (follow-up) ----------

const AVALIACOES = ["excelente", "boa", "regular", "baixa"] as const;
const DIFICULDADES = ["nenhuma", "aprendizagem", "participacao", "comportamental", "organizacao", "outro"] as const;
const PROXIMOS_PASSOS = ["continuar", "reforcar", "novo_feedback", "acompanhar_de_perto", "conversa_individual", "outro"] as const;
// mesmas opções do select do registro-form — duracao_min mora em `encontros`
const DURACOES_MIN = [30, 45, 60, 90, 120] as const;

export async function salvarRegistro(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role === "coordenacao") {
    return { error: "O registro é do mentor — a coordenação acompanha o andamento." };
  }
  const encontro_id = String(formData.get("encontro_id") ?? "");
  const dupla_id = String(formData.get("dupla_id") ?? "");
  if (!encontro_id) return { error: "Não foi possível identificar o encontro. Recarregue a página." };

  // enums têm check constraint no banco — valida aqui pra erro claro em vez de 23514
  const avaliacao = String(formData.get("avaliacao") || "") || null;
  const dificuldade = String(formData.get("dificuldade") || "") || null;
  const proximoPasso = String(formData.get("proximo_passo") || "") || null;
  if ((avaliacao && !(AVALIACOES as readonly string[]).includes(avaliacao)) ||
      (dificuldade && !(DIFICULDADES as readonly string[]).includes(dificuldade)) ||
      (proximoPasso && !(PROXIMOS_PASSOS as readonly string[]).includes(proximoPasso))) {
    return { error: "Revise os campos — um dos valores não é válido." };
  }

  // duração real do encontro — o form manda sempre; grava junto com o
  // status "realizado" no encontro (o campo mora lá, não em registros)
  const duracaoRaw = String(formData.get("duracao_min") ?? "").trim();
  const duracaoMin = Number(duracaoRaw);
  if (duracaoRaw && !(DURACOES_MIN as readonly number[]).includes(duracaoMin)) {
    return { error: "Revise os campos — um dos valores não é válido." };
  }

  const { data: d } = await supabase.from("duplas").select("status").eq("id", dupla_id).single();
  if (d && d.status !== "ativa") return { error: "Essa dupla não está ativa." };

  // só registra encontro da própria dupla que já aconteceu (ou foi marcado realizado)
  const { data: encDb } = await supabase
    .from("encontros")
    .select("dupla_id, numero, status, data_hora, realizado_em")
    .eq("id", encontro_id)
    .single();
  if (!encDb || encDb.dupla_id !== dupla_id) return { error: "Não foi possível identificar o encontro. Recarregue a página." };
  const jaPassou = encDb.data_hora != null && new Date(encDb.data_hora) <= new Date();
  if (encDb.status !== "realizado" && !jaPassou) {
    return { error: "Esse encontro ainda não aconteceu." };
  }

  const atividades = formData.getAll("atividade").map(String);
  const atividadeOutro = String(formData.get("atividade_outro") ?? "").trim();
  if (atividadeOutro) atividades.push(atividadeOutro);

  // update preserva created_by de quem registrou primeiro; insert marca o autor
  const { data: regExistente } = await supabase
    .from("registros").select("id, precisa_apoio").eq("encontro_id", encontro_id).maybeSingle();
  // pedido de apoio novo nessa gravação dispara aviso pra coordenação —
  // edição que mantém o flag não repete a notificação
  const novoApoio =
    !regExistente?.precisa_apoio && formData.get("precisa_apoio") === "on";
  const payload = {
    tema: String(formData.get("tema") ?? "").trim() || null,
    ferramenta: String(formData.get("ferramenta") ?? "").trim() || null,
    reflexoes: String(formData.get("reflexoes") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    // pedido de apoio é "sticky": editar o registro não desmarca — só a
    // coordenação resolve (resolverApoio), então update faz OR com o que já está
    precisa_apoio:
      Boolean(regExistente?.precisa_apoio) || formData.get("precisa_apoio") === "on",
    atividades,
    avaliacao,
    dificuldade,
    dificuldade_detalhe: String(formData.get("dificuldade_detalhe") ?? "").trim() || null,
    proximo_passo: proximoPasso,
    proximo_passo_detalhe: String(formData.get("proximo_passo_detalhe") ?? "").trim() || null,
  };
  // o encontro vira "realizado" ANTES do registro — a policy
  // registros_mentor_insert (0053) exige o encontro realizado pra aceitar o
  // insert. Se o registro falhar depois, o semáforo mostra "registro
  // pendente" e a tentativa seguinte passa — falha melhor que a inversa.
  // realizado_em = quando aconteceu de fato; preserva data informada no
  // registro retroativo e cai em data_hora no fluxo normal agendado→realizado
  const { data: encOk, error: encErr } = await supabase
    .from("encontros")
    .update({
      status: "realizado",
      realizado_em: encDb.realizado_em ?? encDb.data_hora,
      ...(duracaoRaw ? { duracao_min: duracaoMin } : {}),
    })
    .eq("id", encontro_id).select("id");
  if (encErr) return { error: erroAmigavel(encErr) };
  if (!encOk?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }

  const { data: registro, error } = regExistente
    ? await supabase.from("registros").update(payload).eq("id", regExistente.id).select("id").single()
    : await supabase
        .from("registros").insert({ ...payload, encontro_id, created_by: eu.id }).select("id").single();
  if (error) return { error: erroAmigavel(error) };

  // encaminhamentos vêm como JSON por linha (descrição pode ter qualquer caractere)
  const enc = formData
    .getAll("encaminhamento")
    .map(String)
    .flatMap((line) => {
      try {
        const t = JSON.parse(line);
        const descricao = String(t.descricao ?? "").trim();
        if (!descricao) return [];
        return [{
          descricao,
          responsavel: t.responsavel === "mentor" ? "mentor" : "mentorado",
          prazo: t.prazo || null,
        }];
      } catch {
        return [];
      }
    });
  if (enc.length) {
    // re-submit (aba duplicada) não duplica o que já existe nesse registro
    const { data: existentes } = await supabase
      .from("encaminhamentos")
      .select("descricao, responsavel, prazo")
      .eq("registro_id", registro.id);
    const jaTem = new Set(
      (existentes ?? []).map((e) => `${e.descricao}|${e.responsavel}|${e.prazo ?? ""}`)
    );
    const rows = enc
      .filter((t) => !jaTem.has(`${t.descricao}|${t.responsavel}|${t.prazo ?? ""}`))
      .map((t) => ({ dupla_id, registro_id: registro.id, ...t }));
    if (rows.length) {
      const { error: encErr } = await supabase.from("encaminhamentos").insert(rows);
      if (encErr) return { error: erroAmigavel(encErr) };
    }
  }

  // combinados de encontros anteriores marcados como feitos neste registro —
  // best-effort: o registro já está salvo e falha aqui não o reverte; o form
  // avisa no toast (dupla_id no where impede concluir item de outra dupla)
  const concluirIds = [
    ...new Set(formData.getAll("concluir_encaminhamento").map(String).filter(Boolean)),
  ];
  let concluidos = 0;
  let aviso: string | undefined;
  if (concluirIds.length) {
    const { data: feitos, error: concErr } = await supabase
      .from("encaminhamentos")
      .update({ status: "feito" })
      .in("id", concluirIds)
      .eq("dupla_id", dupla_id)
      .select("id");
    if (concErr) {
      aviso = "Não foi possível marcar os combinados anteriores como feitos. Marque na lista de combinados.";
    } else {
      concluidos = feitos?.length ?? 0;
      if (concluidos < concluirIds.length) {
        aviso = `Só ${concluidos} de ${concluirIds.length} combinados foram marcados como feitos. Confira a lista de combinados.`;
      }
    }
  }

  if (novoApoio) {
    // coordenação toda + o supervisor dessa dupla (não todos os supervisores)
    const [{ data: equipe }, { data: dApoio }] = await Promise.all([
      supabase.from("profiles").select("id").eq("role", "coordenacao").eq("ativo", true),
      supabase
        .from("duplas")
        .select("supervisor_id, mentorado:mentorados!mentorado_id(nome)")
        .eq("id", dupla_id).single(),
    ]);
    const mdJoin = dApoio?.mentorado as unknown;
    const nomeMd = Array.isArray(mdJoin)
      ? (mdJoin[0] as { nome?: string } | undefined)?.nome
      : (mdJoin as { nome?: string } | null | undefined)?.nome;
    await notificar(supabase, [
      ...(equipe ?? []).map((p) => p.id),
      dApoio?.supervisor_id,
    ].map((pid) => ({
      profile_id: pid,
      tipo: "pedido_apoio",
      titulo: "Pedido de apoio",
      corpo: `${eu.nome} sinalizou no registro do ${encDb.numero}º encontro${nomeMd ? ` — dupla com ${nomeMd}` : ""}.`,
      // deep-link direto no card do registro que pediu apoio
      href: `/duplas/${dupla_id}#registrar-${encontro_id}`,
    })), eu.id);
  }

  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/agenda");
  revalidatePath("/registros");
  revalidatePath(`/duplas/${dupla_id}`);
  return { ok: true, concluidos, aviso };
}

// ---------- notas do mentor (plano de aula / lembretes pré-encontro) ----------

/** Autosave do NotaEncontro — texto vazio apaga a row ("tem anotação" = row
 *  existe). Chave (dupla_id, numero): a nota precede o agendamento e segue o
 *  nº do encontro na remarcação. */
export async function salvarNotaEncontro(duplaId: string, numero: number, texto: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  // a nota é o plano de aula do mentor — nem a coord escreve nela
  if (eu.role !== "mentor_dpp" && eu.role !== "mentor_especialista") {
    return { error: "A nota do encontro é do mentor da dupla." };
  }

  const { data: d } = await supabase.from("duplas").select("status, trilha").eq("id", duplaId).single();
  if (d && d.status !== "ativa") return { error: "Essa dupla não está ativa." };

  // teto de nº por trilha — a nota segue o passo do guia (16 DPP / 5 especialista)
  const maxNum = d?.trilha === "especialista"
    ? maxEncontros("especialista")
    : (
        await supabase
          .from("ciclo_eventos").select("numero")
          .eq("tipo", "encontro").order("numero", { ascending: false }).limit(1).maybeSingle()
      ).data?.numero ?? 16;
  if (!Number.isInteger(numero) || numero < 1 || numero > maxNum) {
    return { error: "Escolha um encontro da lista." };
  }

  const limpo = texto.trim();
  if (limpo.length > 10000) return { error: "Anotação muito longa (máx. 10.000 caracteres)." };

  if (!limpo) {
    const { error } = await supabase
      .from("encontro_notas").delete().eq("dupla_id", duplaId).eq("numero", numero);
    if (error) return { error: erroAmigavel(error) };
  } else {
    // update preserva created_by de quem anotou primeiro; insert marca o autor
    const { data: existente } = await supabase
      .from("encontro_notas").select("id").eq("dupla_id", duplaId).eq("numero", numero).maybeSingle();
    const { error } = existente
      ? await supabase.from("encontro_notas").update({ texto: limpo }).eq("id", existente.id)
      : await supabase.from("encontro_notas").insert({ dupla_id: duplaId, numero, texto: limpo, created_by: eu.id });
    if (error) return { error: erroAmigavel(error) };
  }

  revalidatePath("/agenda");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

// ---------- mural de notas do perfil (/pessoas/[id]) ----------

/** Publica nota individual no mural da pessoa. O RLS faz o escopo pesado:
 *  staff em qualquer perfil; mentor só no mentorado da própria dupla.
 *  `.select("id")` detecta escrita bloqueada silenciosamente pela policy. */
export async function addPessoaNota({
  profileId,
  mentoradoId,
  texto,
}: {
  profileId?: string;
  mentoradoId?: string;
  texto: string;
}) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const limpo = texto.trim();
  if (!limpo) return { error: "Escreva algo antes de publicar." };
  if (limpo.length > 10000) return { error: "Nota muito longa (máx. 10.000 caracteres)." };
  if (!profileId && !mentoradoId) return { error: "Não foi possível identificar a pessoa. Recarregue a página." };

  const { data, error } = await supabase
    .from("pessoa_notas")
    .insert({
      profile_id: profileId ?? null,
      mentorado_id: mentoradoId ?? null,
      texto: limpo,
      created_by: eu.id,
    })
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Só a coordenação anota neste perfil." };
  }
  revalidatePath(`/pessoas/${profileId ?? mentoradoId}`);
  return { ok: true };
}

/** Remove nota do mural — o autor ou a coordenação (policy garante). */
export async function deletePessoaNota(notaId: string, pessoaId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("pessoa_notas").delete().eq("id", notaId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível apagar. Recarregue a página e tente de novo." };
  }
  revalidatePath(`/pessoas/${pessoaId}`);
  return { ok: true };
}

export async function toggleEncaminhamento(id: string, feito: boolean, duplaId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("encaminhamentos")
    .update({ status: feito ? "feito" : "pendente" })
    .eq("id", id)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

export async function editarEncaminhamento(id: string, duplaId: string, formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  // o texto do acordo é da dupla — a coord só marca feito (toggleEncaminhamento)
  if (eu.role === "coordenacao") {
    return { error: "O combinado é da dupla — a coordenação só pode marcar como feito." };
  }
  const descricao = String(formData.get("descricao") ?? "").trim();
  const responsavel = String(formData.get("responsavel") ?? "mentorado");
  const prazo = String(formData.get("prazo") ?? "").trim();
  if (descricao.length < 2 || descricao.length > 500) {
    return { error: "A descrição precisa de 2 a 500 caracteres." };
  }
  if (!["mentor", "mentorado"].includes(responsavel)) {
    return { error: "Escolha quem fica responsável pelo combinado." };
  }
  if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) {
    return { error: "Confira a data do prazo." };
  }
  const { data, error } = await supabase
    .from("encaminhamentos")
    .update({ descricao, responsavel, prazo: prazo || null })
    .eq("id", id)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

export async function excluirEncaminhamento(id: string, duplaId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role === "coordenacao") {
    return { error: "O combinado é da dupla — a coordenação só pode marcar como feito." };
  }
  const { data, error } = await supabase
    .from("encaminhamentos").delete().eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível excluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

export async function resolverApoio(registroId: string, duplaId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("registros")
    .update({ precisa_apoio: false })
    .eq("id", registroId)
    .select("id, created_by");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  // o mentor fica sabendo que o pedido foi visto — fecha o ciclo do pedido
  const { data: dApoio } = await supabase
    .from("duplas").select("mentor_id").eq("id", duplaId).single();
  await notificar(supabase, [{
    profile_id: data[0].created_by ?? dApoio?.mentor_id,
    tipo: "apoio_resolvido",
    titulo: "Pedido de apoio atendido",
    corpo: "A coordenação marcou seu pedido como atendido.",
    href: `/duplas/${duplaId}`,
  }], eu.id);
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/registros");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

// ---------- materiais ----------

const TIPOS_MATERIAL = ["guia", "template", "conteudo", "link"] as const;
const AUDIENCIAS_MATERIAL = ["todos", "dpp", "especialista", "coordenacao"] as const;

/** Path do arquivo oficial — gerado no client como `materiais/{uuid}-{nome-saneado}`. */
const MATERIAL_PATH_RE = /^materiais\/[0-9a-f-]{36}-[a-zA-Z0-9._-]+$/;

export async function salvarMaterial(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return { error: "Título é obrigatório." };
  const tipo = String(formData.get("tipo") || "link");
  const audiencia = String(formData.get("audiencia") || "todos");
  if (!(TIPOS_MATERIAL as readonly string[]).includes(tipo) ||
      !(AUDIENCIAS_MATERIAL as readonly string[]).includes(audiencia)) {
    return { error: "Revise os campos — um dos valores não é válido." };
  }
  const url = String(formData.get("url") ?? "").trim() || null;
  if (url && !urlOk(url)) return { error: "Confira o link — precisa ser um endereço completo (https://…)." };
  // a row precisa nascer já com path: a policy de INSERT do storage exige a row
  // com path = name. Com path, o arquivo é o destino (a url fica de lado).
  const path = String(formData.get("path") ?? "").trim() || null;
  if (path && !MATERIAL_PATH_RE.test(path)) {
    return { error: "Revise os campos — um dos valores não é válido." };
  }
  const encontroRaw = String(formData.get("encontro_num") ?? "").trim();
  const encontroNum = encontroRaw ? Number(encontroRaw) : null;
  const { data: maxEv } = await supabase
    .from("ciclo_eventos").select("numero")
    .eq("tipo", "encontro").order("numero", { ascending: false }).limit(1).maybeSingle();
  // encontro_num segue a trilha da audiência: material de especialista
  // numera dentro dos 5 passos dela, o resto dentro do ciclo DPP
  const maxNumMat =
    audiencia === "especialista"
      ? maxEncontros("especialista")
      : (maxEv?.numero ?? 16);
  if (
    encontroRaw &&
    (!Number.isInteger(encontroNum) || encontroNum! < 1 || encontroNum! > maxNumMat)
  ) {
    return { error: "Escolha um encontro do programa." };
  }
  // material criado à mão entra depois dos oficiais — ordem era sempre 0
  const { data: maxOrd } = await supabase
    .from("materiais").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
  const { data: novo, error } = await supabase.from("materiais").insert({
    titulo,
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    tipo,
    url,
    path,
    audiencia,
    encontro_num: encontroNum,
    ordem: (maxOrd?.ordem ?? 0) + 1,
  }).select("id").single();
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/materiais");
  // id volta pro client poder desfazer a row se o upload do arquivo falhar
  return { ok: true, id: novo.id as string };
}

export async function editarMaterial(id: string, formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return { error: "Título é obrigatório." };
  const tipo = String(formData.get("tipo") || "link");
  const audiencia = String(formData.get("audiencia") || "todos");
  if (!(TIPOS_MATERIAL as readonly string[]).includes(tipo) ||
      !(AUDIENCIAS_MATERIAL as readonly string[]).includes(audiencia)) {
    return { error: "Revise os campos — um dos valores não é válido." };
  }
  const url = String(formData.get("url") ?? "").trim() || null;
  if (url && !urlOk(url)) return { error: "Confira o link — precisa ser um endereço completo (https://…)." };
  const encontroRaw = String(formData.get("encontro_num") ?? "").trim();
  const encontroNum = encontroRaw ? Number(encontroRaw) : null;
  const { data: maxEv } = await supabase
    .from("ciclo_eventos").select("numero")
    .eq("tipo", "encontro").order("numero", { ascending: false }).limit(1).maybeSingle();
  const maxNumMat =
    audiencia === "especialista"
      ? maxEncontros("especialista")
      : (maxEv?.numero ?? 16);
  if (
    encontroRaw &&
    (!Number.isInteger(encontroNum) || encontroNum! < 1 || encontroNum! > maxNumMat)
  ) {
    return { error: "Escolha um encontro do programa." };
  }
  const { data, error } = await supabase
    .from("materiais")
    .update({
      titulo,
      descricao: String(formData.get("descricao") ?? "").trim() || null,
      tipo,
      url,
      audiencia,
      encontro_num: encontroNum,
    })
    .eq("id", id)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/materiais");
  return { ok: true };
}

/** Anexa arquivo a material existente: grava o path na row (o upload vem depois,
 *  via client — a policy do storage só aceita objeto com row path = name). */
export async function anexarArquivoMaterial(id: string, path: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (!MATERIAL_PATH_RE.test(path)) {
    return { error: "Revise os campos — um dos valores não é válido." };
  }
  const { data, error } = await supabase
    .from("materiais").update({ path }).eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/materiais");
  return { ok: true };
}

/** Desfaz o vínculo do arquivo (path -> null). O objeto no storage é removido
 *  pelo client ANTES de chamar — aqui só zera a referência. */
export async function removerArquivoMaterial(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("materiais").update({ path: null }).eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/materiais");
  return { ok: true };
}

// ---------- documentos oficiais ----------

/** Path do documento oficial — gerado no client como `documentos/{uuid}-{nome-saneado}`. */
const DOCUMENTO_PATH_RE = /^documentos\/[0-9a-f-]{36}-[a-zA-Z0-9._-]+$/;

/** Anexa o documento oficial à pessoa (termo do mentor, autorização do
 *  mentorado): grava documento_path na row — o upload vem depois, via client,
 *  e a policy do storage só aceita objeto com row documento_path = name.
 *  Documento sensível: só a coordenação (a RLS já barra, mas a checagem aqui
 *  devolve erro claro em vez de "0 rows"). */
export async function definirDocumentoPessoa(
  tipo: "profile" | "mentorado",
  id: string,
  path: string
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação gerencia documentos." };
  }
  if (!DOCUMENTO_PATH_RE.test(path)) {
    return { error: "Revise os campos — um dos valores não é válido." };
  }
  const { data, error } = await supabase
    .from(tipo === "mentorado" ? "mentorados" : "profiles")
    .update({ documento_path: path })
    .eq("id", id)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/pessoas");
  return { ok: true };
}

/** Desfaz o vínculo do documento (documento_path -> null). O objeto no storage
 *  é removido pelo client ANTES de chamar — aqui só zera a referência. */
export async function removerDocumentoPessoa(
  tipo: "profile" | "mentorado",
  id: string
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação gerencia documentos." };
  }
  const { data, error } = await supabase
    .from(tipo === "mentorado" ? "mentorados" : "profiles")
    .update({ documento_path: null })
    .eq("id", id)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/pessoas");
  return { ok: true };
}

// ---------- meu perfil (self-service) ----------

export async function updateMeuPerfil(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  // patch parcial: /perfil tem um form de "Dados" e outro só da ficha de
  // mentor — cada um manda as próprias chaves e o que não veio não é tocado
  // (senão o save da mentoria apagaria nome/whatsapp/bio).
  const patch: Record<string, unknown> = {};
  if (formData.has("nome")) {
    const nome = normNome(String(formData.get("nome") ?? ""));
    if (!nome) return { error: "Informe seu nome." };
    patch.nome = nome;
  }
  if (formData.has("whatsapp")) {
    const whatsappRaw = String(formData.get("whatsapp") ?? "");
    const whatsapp = normWhatsapp(whatsappRaw);
    // lixo digitado não pode zerar o campo silenciosamente
    if (whatsappRaw.trim() && !whatsapp) return { error: "Confira o WhatsApp — use DDD e o número completo." };
    patch.whatsapp = whatsapp || null;
  }
  const apresentacao = camposApresentacao(formData, { parcial: true });
  if ("error" in apresentacao) return { error: apresentacao.error };
  // ficha pessoal (0034) — o self pode gravar os sensíveis próprios
  // (guard_profiles_self_columns só trava email/role/ativo/…), mas não os
  // lê de volta: /perfil pré-preenche o que o grant de coluna alcança
  const ficha = camposFicha(formData, { de: "pessoa", parcial: true });
  if ("error" in ficha) return { error: ficha.error };
  // Quem não é coordenação não lê os próprios sensíveis (fora do grant de
  // coluna — voltam null no getMe) — o input chega sempre em branco. Branco
  // nesses campos significa "não mexer", nunca "apagar": senão cada save do
  // /perfil zeraria nascimento/gênero/preferência/motivação já gravados.
  // Pra coordenação os inputs vêm pré-preenchidos — branco = limpar, ok.
  if (eu.role !== "coordenacao") {
    for (const k of ["data_nascimento", "genero", "pref_genero_par", "motivacao"] as const) {
      if (ficha[k] == null) delete ficha[k];
    }
  }
  Object.assign(patch, apresentacao, ficha, consentPatch(formData, eu.consent_lgpd_em));

  // role/ativo/user_id ficam fora do patch — profiles_self_update também
  // barra role no banco, mas nem depende disso: a coluna nem é enviada
  if (Object.keys(patch).length) {
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", eu.id);
    if (error) return { error: erroAmigavel(error) };
  }

  // ficha de mentor (mentor_profiles, 0034) — self-update cobre experiência/
  // formação/disponibilidade; o guard da 0004 continua travando
  // termo_ok/formacao_ok/capacidade/tipo. UPDATE direto: self não tem INSERT
  // (a linha nasce no cadastro pela coordenação).
  const ehMentor = eu.role === "mentor_dpp" || eu.role === "mentor_especialista";
  if (ehMentor && formData.has("disponibilidade")) {
    const mentorCampos = camposMentor(formData);
    if ("error" in mentorCampos) return { error: mentorCampos.error };
    const { error: mpErr } = await supabase
      .from("mentor_profiles")
      .update(mentorCampos)
      .eq("profile_id", eu.id);
    if (mpErr) return { error: erroAmigavel(mpErr) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** path novo já subiu no bucket `avatares` pelo client — aqui persiste a
 *  referência e remove o arquivo antigo (pasta <profile_id>/ é só dele). */
export async function setAvatarPath(path: string | null) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (path != null && !path.startsWith(`${eu.id}/`)) {
    return { error: "Não foi possível usar esse arquivo." };
  }

  const { data: atual } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", eu.id)
    .single();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", eu.id);
  if (error) return { error: erroAmigavel(error) };

  const antigo = atual?.avatar_path;
  if (antigo && antigo !== path) {
    await supabase.storage.from("avatares").remove([antigo]);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- onboarding ----------

/** Passo do wizard de primeiro acesso — grava no próprio profile só o
 *  subconjunto que o passo mandou (bio/linkedin/areas/voluntariado + a ficha
 *  pessoal do 0034, todos opcionais; listas chegam em JSON do TagInput) +
 *  foto opcional. O que não veio no FormData não é tocado — cada passo salva
 *  o seu pedaço. */
export async function salvarOnboarding(formData: FormData) {
  // o wizard do demo avança sem gravar — os campos do perfil não persistem
  if (await demoAtivo()) return { ok: true };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };

  const apresentacao = camposApresentacao(formData, { parcial: true });
  if ("error" in apresentacao) return { error: apresentacao.error };
  const ficha = camposFicha(formData, { de: "pessoa", parcial: true });
  if ("error" in ficha) return { error: ficha.error };
  const patch = {
    ...apresentacao,
    ...ficha,
    ...consentPatch(formData, eu.consent_lgpd_em),
  };
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("profiles").update(patch).eq("id", eu.id);
    if (error) return { error: erroAmigavel(error) };
  }

  // passo "Disponibilidade" (mentor): grade semanal + experiência/formação
  // do mentor_profiles — self-update (0004 trava só os campos de validação)
  const ehMentor = eu.role === "mentor_dpp" || eu.role === "mentor_especialista";
  if (ehMentor) {
    const mentorCampos = camposMentor(formData, { parcial: true });
    if ("error" in mentorCampos) return { error: mentorCampos.error };
    if (Object.keys(mentorCampos).length > 0) {
      const { error: mpErr } = await supabase
        .from("mentor_profiles").update(mentorCampos).eq("profile_id", eu.id);
      if (mpErr) return { error: erroAmigavel(mpErr) };
    }
  }

  // foto opcional — mesma mecânica da ficha da coordenação: sobe na pasta do
  // dono, troca o path e remove o arquivo antigo do bucket
  let aviso: string | undefined;
  const foto = await subirFoto(supabase, eu.id, formData);
  if (foto.path) {
    const { data: atualAv } = await supabase
      .from("profiles").select("avatar_path").eq("id", eu.id).single();
    const { error: avErr } = await supabase
      .from("profiles").update({ avatar_path: foto.path }).eq("id", eu.id);
    if (avErr) {
      aviso = "Dados salvos, mas a foto não subiu — tente de novo.";
    } else if (atualAv?.avatar_path) {
      await supabase.storage.from("avatares").remove([atualAv.avatar_path]);
    }
  } else {
    aviso = foto.aviso;
  }

  // wizard é full-screen — revalidar a home basta, nada de refresh em massa
  revalidatePath("/");
  return { ok: true, aviso };
}

/** Fim do wizard — `onboarded_em` marca que a pessoa já passou. O gate mora
 *  no layout do app, por isso a revalidação é do layout inteiro. A coluna
 *  fica fora do guard_profiles_self_columns (0023): o self-update grava
 *  nela direto. */
export async function concluirOnboarding() {
  // na demo o "concluído" mora num cookie por papel, não em profiles.onboarded_em
  const demo = await demoRole();
  if (demo) {
    await marcarOnboardingDemo(demo);
    return { ok: true };
  }
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_em: new Date().toISOString() })
    .eq("id", eu.id);
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- auth ----------

export async function signOut() {
  // a "sessão" da demo é só cookie — limpa e cai no login, como o signOut real
  if (await demoAtivo()) {
    await limparDemo();
    redirect("/login");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- comunicados & notificações ----------

// Mesma matriz do comunicados_select (0019) — se divergir, destinatário recebe
// ping de aviso que a RLS não deixa abrir.
const AUDIENCIAS_COMUNICADO = [
  "todos", "dpp", "especialista", "coordenacao", "equipe",
] as const;
const ROLES_POR_AUDIENCIA: Record<string, string[]> = {
  todos: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"],
  dpp: ["mentor_dpp"],
  especialista: ["mentor_especialista"],
  coordenacao: ["coordenacao"],
  equipe: ["coordenacao", "supervisor"],
};

/** Aviso geral da coordenação — grava o comunicado e cria a notificação de
 *  cada destinatário da audiência (o autor não se notifica do próprio aviso). */
export async function publicarComunicado(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao") return { error: "Só a coordenação publica avisos." };
  const titulo = String(formData.get("titulo") ?? "").trim();
  const corpo = String(formData.get("corpo") ?? "").trim();
  const audiencia = String(formData.get("audiencia") ?? "todos");
  if (titulo.length < 2 || titulo.length > 140) {
    return { error: "O título precisa de 2 a 140 caracteres." };
  }
  if (corpo.length < 2 || corpo.length > 5000) {
    return { error: "O texto precisa de 2 a 5000 caracteres." };
  }
  if (!(AUDIENCIAS_COMUNICADO as readonly string[]).includes(audiencia)) {
    return { error: "Escolha quem recebe o aviso." };
  }

  const { data: aviso, error } = await supabase
    .from("comunicados")
    .insert({ titulo, corpo, audiencia, created_by: eu.id })
    .select("id").single();
  if (error) return { error: erroAmigavel(error) };

  const { data: dests } = await supabase
    .from("profiles").select("id")
    .in("role", ROLES_POR_AUDIENCIA[audiencia]).eq("ativo", true);
  const resumo = corpo.length > 180 ? `${corpo.slice(0, 177)}…` : corpo;
  await notificar(supabase, (dests ?? []).map((p) => ({
    profile_id: p.id,
    tipo: "comunicado",
    titulo,
    corpo: resumo,
    href: "/#avisos",
    comunicado_id: aviso?.id,
  })), eu.id);

  revalidatePath("/");
  return { ok: true };
}

export async function excluirComunicado(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao") return { error: "Só a coordenação exclui avisos." };
  const { data, error } = await supabase
    .from("comunicados").delete().eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível excluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/");
  return { ok: true };
}

/** Poll do sino — mesma leitura de getNotificacoes, mas como action pra rodar
 *  no intervalo do client sem navegação. */
export async function listarNotificacoes() {
  // leitura — o sino faz poll mesmo na demo; devolve o dataset do papel ativo
  const demo = await demoRole();
  if (demo) {
    const itens = getDemoData().notificacoes[demo] ?? [];
    return { ok: true, itens: itens.slice(0, 15), naoLidas: itens.filter((n: Notificacao) => !n.lida_em).length };
  }
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const [{ data, error: errItens }, { count, error: errCount }] = await Promise.all([
    supabase
      .from("notificacoes")
      .select("id, tipo, titulo, corpo, href, lida_em, created_at")
      .eq("profile_id", eu.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("notificacoes")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", eu.id)
      .is("lida_em", null),
  ]);
  if (errItens || errCount) {
    console.error("listarNotificacoes:", errItens ?? errCount);
    return { error: "Não foi possível carregar as notificações." };
  }
  return { ok: true, itens: data ?? [], naoLidas: count ?? 0 };
}

export async function marcarNotificacaoLida(id: string) {
  // no-op silencioso na demo — a UI já marcou otimista; erro dispararia toast
  if (await demoAtivo()) return { ok: true };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", eu.id)
    .is("lida_em", null);
  if (error) return { error: "Não foi possível marcar como lida." };
  return { ok: true };
}

export async function marcarTodasNotificacoesLidas() {
  if (await demoAtivo()) return { ok: true };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("profile_id", eu.id)
    .is("lida_em", null);
  if (error) return { error: "Não foi possível marcar como lidas." };
  return { ok: true };
}
