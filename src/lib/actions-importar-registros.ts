"use server";

// Import em lote do form semanal externo ("Avaliação semanal das
// Mentorias") — exceção legítima à regra "o registro é do mentor": a
// plataforma ainda não era o canal quando essas respostas chegaram, e a
// RPC importar_registros (0082) grava com created_by = mentor da dupla.
//
// Fluxo espelha o pareamento (importar-duplas): preview resolve TUDO sem
// escrever; executar recebe as linhas aprovadas — inclusive as que a UI
// resolveu à mão (linha 'revisar' com duplaId escolhido no Select).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { erroAmigavel } from "./utils";
import {
  itemRpc,
  parseCsvRegistros,
  processaLinhas,
  saneiaLinhaReg,
  type DuplaCandidata,
  type LinhaReg,
  type UniversoReg,
} from "./importar-registros";
import type { Json } from "./database.types";

const MAX_IMPORT = 500;

async function me() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, nome")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, me: data };
}

type Supa = Awaited<ReturnType<typeof createClient>>;

/** "novo" = o encontro (dupla, numero) não existe — a RPC cria
 *  born-realizado · "anexa" = existe agendado/pendente, ganha o registro ·
 *  "atualiza" = já tem registro, o form sobrescreve os campos mapeados. */
export type EncontroInfo = "novo" | "anexa" | "atualiza";

export type LinhaPrev = LinhaReg & { encontroInfo: EncontroInfo | null };

/** Universo do match — uma leva de selects, resolução toda em memória.
 *  TODAS as duplas entram (ativa/pausada/encerrada): registro histórico é
 *  legítimo em dupla encerrada (encontro aconteceu antes da saída). */
async function universoRegistros(supabase: Supa): Promise<{
  universo: UniversoReg;
  encPorDuplaNumero: Map<string, EncontroInfo>;
}> {
  const [{ data: mentoresRole }, { data: mentorados }, { data: duplas }, { data: encs }, { data: eventos }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, nome_social")
        .in("role", ["mentor_dpp", "mentor_especialista"]),
      supabase.from("mentorados").select("id, nome, nome_social"),
      supabase
        .from("duplas")
        .select(
          "id, mentor_id, mentorado_id, status, trilha, cronograma_id, iniciada_em, mentor:profiles!duplas_mentor_id_fkey(nome), mentorado:mentorados!duplas_mentorado_id_fkey(nome)"
        ),
      supabase.from("encontros").select("dupla_id, numero, status, data_hora, registros(id)"),
      supabase
        .from("ciclo_eventos")
        .select("cronograma_id, numero, data")
        .eq("tipo", "encontro"),
    ]);
  // mentor_id é FK nua — mentor com papel híbrido (coord/supervisor que
  // também mentora) não aparece no filtro por role. Pool completo =
  // roles + todo id referenciado em duplas, senão ele pontua 0 sempre.
  const temMentor = new Set((mentoresRole ?? []).map((m) => m.id));
  const faltam = [
    ...new Set((duplas ?? []).map((d) => d.mentor_id).filter(Boolean)),
  ].filter((id) => !temMentor.has(id!));
  const { data: mentoresExtra } = faltam.length
    ? await supabase
        .from("profiles")
        .select("id, nome, nome_social")
        .in("id", faltam as string[])
    : { data: [] as { id: string; nome: string; nome_social: string | null }[] };
  const mentores = [...(mentoresRole ?? []), ...(mentoresExtra ?? [])];
  const norm = (v: unknown) => (Array.isArray(v) ? (v[0] ?? null) : v);
  const duplasRef: DuplaCandidata[] = (duplas ?? []).map((d) => {
    const mentor = norm(d.mentor) as { nome: string } | null;
    const mentorado = norm(d.mentorado) as { nome: string } | null;
    return {
      id: d.id,
      mentor_id: d.mentor_id,
      mentorado_id: d.mentorado_id,
      status: d.status,
      trilha: d.trilha,
      cronograma_id: d.cronograma_id,
      iniciada_em: d.iniciada_em,
      mentorNome: mentor?.nome ?? "?",
      mentoradoNome: mentorado?.nome ?? "?",
    };
  });
  const encPorDuplaNumero = new Map<string, EncontroInfo>();
  const encontros = new Map<string, Map<number, { status: string; data: string | null }>>();
  for (const e of encs ?? []) {
    const regs = e.registros as unknown;
    const temRegistro = Array.isArray(regs) ? regs.length > 0 : regs != null;
    encPorDuplaNumero.set(
      `${e.dupla_id}|${e.numero}`,
      temRegistro ? "atualiza" : "anexa"
    );
    let porNumero = encontros.get(e.dupla_id);
    if (!porNumero) encontros.set(e.dupla_id, (porNumero = new Map()));
    porNumero.set(e.numero, { status: e.status, data: e.data_hora });
  }
  const calendario = new Map<string, Map<number, string>>();
  for (const ev of eventos ?? []) {
    if (ev.numero == null || !ev.data) continue;
    let porNumero = calendario.get(ev.cronograma_id);
    if (!porNumero) calendario.set(ev.cronograma_id, (porNumero = new Map()));
    porNumero.set(ev.numero, ev.data);
  }
  return {
    universo: {
      mentores: mentores ?? [],
      mentorados: mentorados ?? [],
      duplas: duplasRef,
      calendario,
      encontros,
    },
    encPorDuplaNumero,
  };
}

/** Prévia do import — parse + match contra o banco, sem escrever nada.
 *  O que a prévia promete é o que executarImportRegistros faz (salvo
 *  drift entre os dois cliques). */
export async function previewImportRegistros(csvText: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação importa registros." };
  }
  const { linhas: cruas, ignoradas } = parseCsvRegistros(
    typeof csvText === "string" ? csvText : ""
  );
  if (cruas.length > MAX_IMPORT) {
    return {
      error: `O arquivo tem ${cruas.length} respostas. Importe em lotes de até ${MAX_IMPORT}.`,
    };
  }
  const { universo, encPorDuplaNumero } = await universoRegistros(supabase);
  const { linhas, stats } = processaLinhas(cruas, universo);
  const enriquecidas: LinhaPrev[] = linhas.map((l) => ({
    ...l,
    encontroInfo:
      l.duplaId && l.numero != null
        ? (encPorDuplaNumero.get(`${l.duplaId}|${l.numero}`) ?? "novo")
        : null,
  }));
  // mapa dupla → (nº → estado) pro client recomputar o tag quando a
  // pessoa troca o Select — sem ele, linha manual nunca avisaria que a
  // dupla escolhida já tem registro
  const encPorDupla: Record<string, Record<number, EncontroInfo>> = {};
  for (const [k, v] of encPorDuplaNumero) {
    const [duplaId, numero] = k.split("|");
    (encPorDupla[duplaId] ??= {})[Number(numero)] = v;
  }
  // todas as duplas ordenadas pro Select das linhas 'revisar'
  const duplas = [...universo.duplas].sort((a, b) =>
    a.mentoradoNome.localeCompare(b.mentoradoNome, "pt-BR")
  );
  return {
    ok: true as const,
    linhas: enriquecidas,
    duplas,
    encPorDupla,
    stats,
    ignoradas,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ItemResultado = {
  i: number;
  dupla_id?: string;
  encontro_id?: string;
  encontro_criado?: boolean;
  registro_criado?: boolean;
  erro?: string;
};

/** Aplica as linhas aprovadas — a RPC decide por item (cria encontro
 *  born-realizado quando falta, upsert do registro sempre) e devolve o
 *  relatório por posição; erros viram linhas puladas, o lote segue. */
export async function executarImportRegistros(linhas: LinhaReg[]) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação importa registros." };
  }
  if (!Array.isArray(linhas)) return { error: "Lote inválido." };
  const saneadas = linhas.map(saneiaLinhaReg);
  if (saneadas.length > MAX_IMPORT) {
    return {
      error: `O lote tem ${saneadas.length} respostas. Importe em lotes de até ${MAX_IMPORT}.`,
    };
  }
  // revalida ids: duplaId precisa existir de verdade — a linha pode ter
  // sido montada à mão no client
  const ids = [...new Set(saneadas.map((l) => l.duplaId).filter(Boolean))] as string[];
  const { data: existentes } = ids.length
    ? await supabase.from("duplas").select("id").in("id", ids.filter((i) => UUID_RE.test(i)))
    : { data: [] as { id: string }[] };
  const validas = new Set((existentes ?? []).map((d) => d.id));

  const itens: { linha: LinhaReg; item: NonNullable<ReturnType<typeof itemRpc>> }[] = [];
  const puladas: string[] = [];
  // (dupla, numero) é unique — duas linhas apontando pro mesmo encontro
  // na mesma leva faziam a segunda sobrescrever a primeira em silêncio
  const vistos = new Map<string, number>();
  saneadas.forEach((l) => {
    const item = itemRpc(l);
    if (!item || !UUID_RE.test(l.duplaId ?? "") || !validas.has(l.duplaId!)) {
      puladas.push(
        `Linha ${l.n}: ${
          item ? "dupla inválida" : l.numero == null ? "sem nº de encontro" : "sem dupla definida"
        }`
      );
      return;
    }
    const chave = `${l.duplaId}|${l.numero}`;
    const colide = vistos.get(chave);
    if (colide != null) {
      puladas.push(
        `Linha ${l.n}: mesma dupla e nº da linha ${colide} — só uma entra`
      );
      return;
    }
    vistos.set(chave, l.n);
    itens.push({ linha: l, item });
  });
  if (!itens.length) {
    return {
      ok: true as const,
      criados: 0,
      atualizados: 0,
      encontrosCriados: 0,
      erros: puladas,
    };
  }

  const { data, error } = await supabase.rpc("importar_registros", {
    itens: itens.map((x) => x.item) as unknown as Json,
  });
  if (error) return { error: erroAmigavel(error) };

  const resultado = (Array.isArray(data) ? data : []) as ItemResultado[];
  const porIndice = new Map(resultado.map((r) => [r.i, r]));
  let criados = 0;
  let atualizados = 0;
  let encontrosCriados = 0;
  const erros = [...puladas];
  itens.forEach(({ linha }, i) => {
    const r = porIndice.get(i);
    if (!r) {
      erros.push(`Linha ${linha.n}: sem resposta do banco`);
    } else if (r.erro) {
      erros.push(
        `Linha ${linha.n} (${linha.mentoradoNome ?? linha.mentoradoTxt}): ${r.erro}`
      );
    } else if (r.registro_criado) {
      criados++;
      if (r.encontro_criado) encontrosCriados++;
    } else {
      atualizados++;
    }
  });

  revalidatePath("/registros");
  revalidatePath("/");
  revalidatePath("/duplas");
  return { ok: true as const, criados, atualizados, encontrosCriados, erros };
}
