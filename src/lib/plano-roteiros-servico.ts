import "server-only";

/** Leitura e nascimento lazy dos roteiros do plano (020 — REALIZA-521).
 *  A autorização é a mesma do plano: `contextoPlano` prova o papel real
 *  do chamador no banco antes de qualquer leitura de referência, e as
 *  escritas passam só pelas RPCs definer (roteiro_salvar/publicar) com o
 *  client de sessão — a RLS da tabela é a fronteira final. */

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { carregarDocCorpus } from "./materiais/corpus-doc";
import { contextoPlano, nomesDaDupla, type LadoPlano } from "./plano-servico";
import { quemCombinou } from "./sua-semana";
import { aceitesDoPlano } from "./plano-combinado";
import {
  contextoRoteiro,
  montarDocCombinado,
  montarRoteiro,
  numerosMarcadosDe,
  numerosRealizadosDe,
  roteirosDevidos,
  slugRoteiro,
} from "./plano-roteiros";
import { getCicloEventos } from "./queries";
import { demoRole } from "./demo/mode";
import { demoDupla, demoDuplaJovem } from "./demo/queries";
import type { DocBloco } from "./materiais-documentos";
import type {
  CicloEvento,
  Dupla,
  DuplaPlano,
  DuplaPlanoRoteiro,
} from "./types";

/** Recessos da dupla resolvidos pra exibição — título e janela do evento
 *  do ciclo + a decisão declarada (null = ainda não decidida). */
export function recessosDaDupla(
  dupla: Dupla,
  eventos: readonly CicloEvento[]
): { titulo: string; inicio: string; fim: string; usa: boolean | null }[] {
  const decisoes = new Map(
    (dupla.recessos ?? []).map((r) => [r.ciclo_evento_id, r.usa])
  );
  return eventos
    .filter((e) => e.tipo === "recesso" && e.data)
    .map((e) => ({
      titulo: e.titulo,
      inicio: e.data!,
      fim: e.data_fim ?? e.data!,
      usa: decisoes.get(e.id) ?? null,
    }));
}

/** O plano que rege os roteiros agora — aceito ou ativo (proposto não
 *  gera roteiro: ainda não virou combinado). */
export function planoVigente(dupla: Dupla): DuplaPlano | null {
  return (
    [...(dupla.planos ?? [])]
      .filter((p) => p.status === "aceito" || p.status === "ativo")
      .sort((a, b) => b.versao - a.versao)[0] ?? null
  );
}

/** Monta o DocBloco[] de uma semana: corpus do slug canônico + contexto
 *  do plano (passo, sessão fusa, recesso) + ajustes do guia da dupla.
 *  Corpus ausente → roteiro só com o contexto (nunca quebra). */
export async function montarRoteiroDoPlano(
  dupla: Dupla,
  plano: DuplaPlano,
  numero: number,
  eventos: readonly CicloEvento[] = []
): Promise<DocBloco[]> {
  const doc = await carregarDocCorpus(slugRoteiro(numero));
  return montarRoteiro(
    doc,
    contextoRoteiro(plano, numero, {
      ajustes:
        dupla.guia_ajustes?.find((g) => g.numero === numero)?.ajustes ?? null,
      recessos: recessosDaDupla(dupla, eventos),
    })
  );
}

/** Roteiros de uma dupla com lazy generation embutida: semanas devidas
 *  (1ª com encontro marcado; seguinte quando a anterior concluiu) nascem
 *  publicadas, idempotente por (plano, numero, versao) — a RPC devolve a
 *  row existente sem duplicar. Escritas com o client de sessão pra RLS
 *  revalidar o papel; falha de escrita não derruba a leitura. */
export async function carregarRoteirosDaDupla(input: {
  duplaId: string;
  /** Ficha já tem a dupla embedada e o lado resolvido — pula o contextoPlano */
  dupla?: Dupla;
  lado?: LadoPlano | null;
}): Promise<
  | {
      ok: true;
      lado: LadoPlano | null;
      dupla: Dupla;
      plano: DuplaPlano | null;
      roteiros: DuplaPlanoRoteiro[];
      /** profile id → nome de uso — autoria das rows */
      autores: Map<string, string>;
      eventos: CicloEvento[];
    }
  | { error: string }
> {
  const papelDemo = await demoRole();
  if (papelDemo) {
    const dupla =
      demoDupla(papelDemo, input.duplaId) ??
      demoDuplaJovem(papelDemo, input.duplaId);
    if (!dupla) return { error: "Sem permissão pra ver o plano dessa dupla." };
    const plano = planoVigente(dupla);
    const roteiros = plano ? await roteirosDemo(dupla, plano) : [];
    return {
      ok: true,
      lado: null,
      dupla,
      plano,
      roteiros,
      autores: new Map(),
      eventos: [],
    };
  }

  let dupla: Dupla;
  let lado: LadoPlano | null;
  let eventos: CicloEvento[];
  if (input.dupla) {
    dupla = input.dupla;
    lado = input.lado ?? null;
    eventos = [];
  } else {
    eventos = await getCicloEventos();
    const ctx = await contextoPlano(input.duplaId, eventos);
    if ("error" in ctx) return ctx;
    dupla = ctx.dupla;
    lado = ctx.lado;
  }
  if (!eventos.length) eventos = await getCicloEventos();

  const supabase = await createClient();
  const plano = planoVigente(dupla);

  let roteiros: DuplaPlanoRoteiro[] = [];
  const buscar = async () => {
    const { data, error } = await supabase
      .from("dupla_plano_roteiros")
      .select("*")
      .eq("dupla_id", input.duplaId)
      .order("numero")
      .order("versao", { ascending: false });
    if (error) console.error("carregarRoteiros:", error);
    return (data ?? []) as DuplaPlanoRoteiro[];
  };

  roteiros = await buscar();

  // lazy: só com combinado vigente; a RPC já garante idempotência
  if (plano) {
    const devidos = roteirosDevidos({
      numeros: plano.escopo?.numeros ?? [],
      marcados: numerosMarcadosDe(dupla.encontros ?? []),
      realizados: numerosRealizadosDe(dupla.encontros ?? []),
    });
    const faltam = devidos.filter(
      (n) =>
        !roteiros.some(
          (r) =>
            r.plano_id === plano.id &&
            r.numero === n &&
            r.plano_versao === plano.versao
        )
    );
    let escreveu = false;
    for (const n of faltam) {
      try {
        const conteudo = await montarRoteiroDoPlano(dupla, plano, n, eventos);
        const { data, error } = await supabase.rpc("roteiro_salvar", {
          p_plano: plano.id,
          p_numero: n,
          p_conteudo: conteudo as unknown as never,
          p_via: "app",
        });
        const id =
          data && typeof data === "object" && "id" in data
            ? (data as { id: string }).id
            : null;
        if (error || !id) {
          console.error("roteiro lazy:", error ?? data);
          continue;
        }
        // a semana devida nasce publicada — determinística, sem revisão
        const { error: erroPub } = await supabase.rpc("roteiro_publicar", {
          p_id: id,
        });
        if (erroPub) console.error("roteiro lazy publicar:", erroPub);
        else escreveu = true;
      } catch (e) {
        console.error("roteiro lazy:", e);
      }
    }
    if (escreveu) roteiros = await buscar();
  }

  // autoria legível: um fetch batelado de profiles pras rows da dupla
  const ids = [
    ...new Set(
      roteiros
        .flatMap((r) => [r.gerado_por, r.editado_por, r.publicado_por])
        .filter((x): x is string => x != null)
    ),
  ];
  const autores = new Map<string, string>();
  if (ids.length) {
    const svc = createServiceClient();
    const { data: profs } = await svc
      .from("profiles")
      .select("id, nome, nome_social")
      .in("id", ids);
    for (const p of profs ?? [])
      autores.set(p.id, p.nome_social ?? p.nome);
  }
  return { ok: true, lado, dupla, plano, roteiros, autores, eventos };
}

const STATUS_ROTULO: Record<string, string> = {
  proposto: "Proposto · espera aceite",
  aceito: "Aceito",
  ativo: "Em prática",
  contestado: "Contestado",
  expirado: "Expirado",
  concluido: "Concluído",
};

function planoDoDoc(dupla: Dupla, versao?: number): DuplaPlano | null {
  const planos = dupla.planos ?? [];
  if (versao != null) return planos.find((p) => p.versao === versao) ?? null;
  return (
    planos.find((p) =>
      ["proposto", "aceito", "ativo"].includes(p.status)
    ) ??
    [...planos].sort((a, b) => b.versao - a.versao)[0] ??
    null
  );
}

/** A montagem do doc do combinado a partir da dupla — compartilhada
 *  entre a rota da ficha e a do jovem (mesmo conteúdo; só o "voltar"
 *  muda). `versao` lê uma versão fechada (?v=). */
export async function docCombinadoProps(
  dupla: Dupla,
  versao: number | undefined,
  eventos: readonly CicloEvento[]
): Promise<{
  plano: DuplaPlano;
  titulo: string;
  meta: string;
  blocos: ReturnType<typeof montarDocCombinado>;
} | null> {
  const plano = planoDoDoc(dupla, versao);
  if (!plano) return null;
  const nomes = nomesDaDupla(dupla);
  const nomesPorId = new Map<string, string>();
  if (dupla.mentor && nomes.mentor)
    nomesPorId.set(dupla.mentor.id, nomes.mentor);
  if (dupla.supervisor) {
    const s = dupla.supervisor;
    nomesPorId.set(s.id, (s.nome_social ?? s.nome).split(" ")[0]);
  }
  const nomesPorOutroId = new Map<string, string>();
  if (dupla.mentorado && nomes.jovem)
    nomesPorOutroId.set(dupla.mentorado.id, nomes.jovem);
  const quem = quemCombinou({
    propostoPor: plano.proposto_por,
    propostoVia: plano.proposto_via,
    nomesPorId,
    nomesPorOutroId,
  });
  const quemPropos =
    plano.proposto_via === "liza"
      ? "A Liza"
      : quem.charAt(0).toUpperCase() + quem.slice(1);
  const blocos = montarDocCombinado({
    status: plano.status,
    versao: plano.versao,
    propostoEm: plano.aprovado_em ?? plano.created_at,
    quemPropos,
    escopo: plano.escopo,
    aceites: aceitesDoPlano(plano),
    nomes:
      nomes.mentor && nomes.jovem
        ? { mentor: nomes.mentor, mentorado: nomes.jovem }
        : null,
    recessos: recessosDaDupla(
      dupla,
      eventos.filter((e) => e.cronograma_id === dupla.cronograma_id)
    ),
    marcados: new Map(
      (plano.passos ?? []).map((p) => [p.numero, p.data_nova.slice(0, 10)])
    ),
    realizados: numerosRealizadosDe(dupla.encontros ?? []),
  });
  return {
    plano,
    titulo:
      nomes.mentor && nomes.jovem
        ? `${nomes.mentor} × ${nomes.jovem}`
        : "O combinado da dupla",
    meta: `Versão ${plano.versao} · ${STATUS_ROTULO[plano.status] ?? plano.status}`,
    blocos,
  };
}

/** Síntese demo: as semanas devidas nascem publicadas e a próxima fica
 *  rascunho, com o conteúdo montado de verdade (o corpus lê do disco no
 *  server também na demo). */
async function roteirosDemo(
  dupla: Dupla,
  plano: DuplaPlano
): Promise<DuplaPlanoRoteiro[]> {
  const eventos = await getCicloEventos().catch(() => [] as CicloEvento[]);
  const devidos = roteirosDevidos({
    numeros: plano.escopo?.numeros ?? [],
    marcados: numerosMarcadosDe(dupla.encontros ?? []),
    realizados: numerosRealizadosDe(dupla.encontros ?? []),
  });
  const rascunho = (plano.escopo?.numeros ?? []).find(
    (n) => !devidos.includes(n)
  );
  const agora = new Date().toISOString();
  const rows: DuplaPlanoRoteiro[] = [];
  for (const [status, numero] of [
    ...devidos.map((n) => ["publicado", n] as const),
    ...(rascunho != null ? [["rascunho", rascunho] as const] : []),
  ]) {
    rows.push({
      id: `roteiro-demo-${plano.id}-${numero}`,
      dupla_id: dupla.id,
      plano_id: plano.id,
      numero,
      versao: 1,
      plano_versao: plano.versao,
      conteudo: await montarRoteiroDoPlano(dupla, plano, numero, eventos),
      status,
      gerado_por: null,
      gerado_via: "app",
      gerado_em: agora,
      editado_por: null,
      publicado_por: null,
      publicado_em: status === "publicado" ? agora : null,
      updated_at: agora,
    });
  }
  return rows;
}
