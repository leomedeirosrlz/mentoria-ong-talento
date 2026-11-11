"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { convidarAcesso } from "./actions-convite";
import {
  emitirAssinaturasEmLote,
  enviarLinksAssinatura,
} from "./actions-assinaturas";
import { slugDocMentorado } from "./pessoas-status";

// Ações em lote da seleção do /pessoas (REALIZA-39) — orquestração das
// primitivas que já existem, nada de caminho paralelo: convite vai por
// convidarAcesso pessoa a pessoa (a guarda de papel/atividade/e-mail é
// dela); termo vai por emitirAssinaturasEmLote agrupando pelo documento
// devido de cada alvo (profile → termo-voluntario; jovem → a régua da
// 0046 por idade) e enviando os links prontos por e-mail no mesmo gesto.
// Resultado por item: nada de "ok" genérico — cada falha volta nomeada.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AlvoPessoaLote = {
  tipo: "profile" | "mentorado";
  id: string;
  /** só pra ecoar em mensagem de falha — nada é lido dele no servidor */
  nome?: string | null;
};

export type FalhaLote = {
  tipo: "profile" | "mentorado";
  id: string;
  nome: string | null;
  erro: string;
};

export type ResultadoPessoasLote =
  | {
      ok: true;
      total: number;
      /** convite: e-mails de acesso disparados; termo: links emitidos
       *  (novo ou reuso de um vivo) */
      feitos: number;
      /** termo: dos links emitidos, quantos saíram por e-mail no mesmo
       *  gesto — os demais ficam prontos pra WhatsApp/cópia */
      enviados?: number;
      /** termo: quantos já tinham o documento assinado — fora do "feitos"
       *  pra não inflar emissão com no-op */
      jaAssinados?: number;
      falhas: FalhaLote[];
    }
  | { error: string };

async function meCoord() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data: eu } = await supabase
    .from("profiles")
    .select("id, role, ativo")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, eu };
}

export async function actionPessoasLote({
  acao,
  alvos,
}: {
  acao: "convite" | "termo";
  alvos: AlvoPessoaLote[];
}): Promise<ResultadoPessoasLote> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, eu } = await meCoord();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  // gate explícito de ativo — idem convidarAcesso/enviarLinksAssinatura:
  // a ação dispara e-mail antes de bater em policy
  if (eu.role !== "coordenacao" || !eu.ativo) {
    return { error: "Só a coordenação executa ações em lote." };
  }

  // dedup + formato — lixo aqui viraria falha por item, não guarda útil
  const vistos = new Set<string>();
  const limpos = (Array.isArray(alvos) ? alvos : []).filter(
    (a): a is AlvoPessoaLote =>
      (a?.tipo === "profile" || a?.tipo === "mentorado") &&
      UUID_RE.test(a?.id ?? "") &&
      !vistos.has(`${a.tipo}:${a.id}`) &&
      (vistos.add(`${a.tipo}:${a.id}`), true)
  );
  if (!limpos.length) return { error: "Escolha ao menos uma pessoa." };

  if (acao === "convite") {
    let feitos = 0;
    const falhas: FalhaLote[] = [];
    for (const a of limpos) {
      const r = await convidarAcesso({ tipo: a.tipo, id: a.id });
      if ("error" in r) {
        falhas.push({ tipo: a.tipo, id: a.id, nome: a.nome ?? null, erro: r.error });
      } else {
        feitos++;
      }
    }
    revalidatePath("/pessoas");
    return { ok: true, total: limpos.length, feitos, falhas };
  }

  // ---------- termo: um grupo por documento devido ----------
  // O slug do jovem depende da idade (0046) — data_nascimento mora na view
  // coord mentorados_pessoal; sem dado, cai no termo-mentorando (maior).
  const mentoradoIds = limpos
    .filter((a) => a.tipo === "mentorado")
    .map((a) => a.id);
  const nascPorId = new Map<string, string | null>();
  if (mentoradoIds.length) {
    const { data: nasc } = await supabase
      .from("mentorados_pessoal")
      .select("id, data_nascimento")
      .in("id", mentoradoIds);
    for (const r of nasc ?? [])
      if (r.id) nascPorId.set(r.id, r.data_nascimento);
  }

  // não-voluntário não deve termo — o flag é do banco, nunca do client
  const profileIds = limpos
    .filter((a) => a.tipo === "profile")
    .map((a) => a.id);
  const voluntarioPorId = new Map<string, boolean | null>();
  if (profileIds.length) {
    const { data: vs } = await supabase
      .from("profiles")
      .select("id, voluntario")
      .in("id", profileIds);
    for (const r of vs ?? []) voluntarioPorId.set(r.id, r.voluntario);
  }

  const grupos = new Map<string, AlvoPessoaLote[]>();
  const falhas: FalhaLote[] = [];
  for (const a of limpos) {
    if (a.tipo === "profile" && voluntarioPorId.get(a.id) === false) {
      falhas.push({
        tipo: a.tipo,
        id: a.id,
        nome: a.nome ?? null,
        erro: "Cadastro não-voluntário — sem termo a assinar.",
      });
      continue;
    }
    const slug =
      a.tipo === "profile"
        ? "termo-voluntario"
        : slugDocMentorado({
            data_nascimento: nascPorId.get(a.id) ?? null,
          });
    (grupos.get(slug) ?? grupos.set(slug, []).get(slug)!).push(a);
  }

  let feitos = 0;
  let enviados = 0;
  let jaAssinados = 0;
  for (const [slug, grupo] of grupos) {
    const r = await emitirAssinaturasEmLote({
      slug,
      alvos: grupo.map((a) => ({ tipo: a.tipo, id: a.id })),
    });
    if ("error" in r) {
      for (const a of grupo)
        falhas.push({
          tipo: a.tipo,
          id: a.id,
          nome: a.nome ?? null,
          // a união inferida da primitiva declara error?: undefined no
          // membro ok — "in" não descarta; em runtime aqui é sempre string
          erro: r.error ?? "Falha na emissão.",
        });
      continue;
    }
    const porId = new Map(r.itens.map((i) => [i.id, i]));
    for (const a of grupo) {
      const item = porId.get(a.id);
      if (!item) {
        falhas.push({
          tipo: a.tipo,
          id: a.id,
          nome: a.nome ?? null,
          erro: "Fora do recorte deste documento.",
        });
        continue;
      }
      if (item.assinado) {
        jaAssinados++;
        continue;
      }
      if (!item.link) {
        falhas.push({
          tipo: a.tipo,
          id: a.id,
          nome: item.nome ?? a.nome ?? null,
          erro: item.faltantes.length
            ? `Faltam dados civis: ${item.faltantes.join(", ")}.`
            : "Não foi possível emitir o link.",
        });
        continue;
      }
      feitos++;
    }

    // envio por e-mail no mesmo gesto — quem não tem e-mail fica com o
    // link emitido pra WhatsApp/cópia na ficha (não é falha do lote)
    const envios = r.itens
      .filter((i) => i.link && i.email && !i.assinado)
      .map((i) => ({
        para: i.email as string,
        nome: i.nome,
        link: i.link as string,
        destinatario: i.destinatario,
      }));
    if (envios.length) {
      const e = await enviarLinksAssinatura({ slug, envios });
      if ("error" in e) {
        console.error("actionPessoasLote envio:", slug, e.error);
      } else {
        enviados += e.enviados;
        for (const em of e.falhas) {
          const item = r.itens.find((i) => i.email === em);
          falhas.push({
            tipo: item?.tipo ?? "profile",
            id: item?.id ?? "",
            nome: item?.nome ?? null,
            erro: "Falha ao enviar o e-mail (o link segue emitido).",
          });
        }
      }
    }
  }
  revalidatePath("/pessoas");
  return {
    ok: true,
    total: limpos.length,
    feitos,
    enviados,
    jaAssinados,
    falhas,
  };
}
