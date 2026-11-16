import { NextResponse, type NextRequest } from "next/server";
import { ByteWriter, parquetWriteRows } from "hyparquet-writer";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "@/lib/demo/mode";
import { getDemoData } from "@/lib/demo/data";
import { dadosAdocaoEventosDemo } from "@/lib/relatorios/adocao";
import { temPapel } from "@/lib/types";
import type { LinhaEventoExport } from "@/lib/adocao";

// GET /api/adocao/export — REALIZA-417 fase B. Só coordenação (mesma
// checagem do /api/export: cookie demo ou claims + papel efetivo).
// Devolve o cru de produto_eventos em PARQUET pro explorador ad-hoc da
// aba (DuckDB-WASM registra o buffer e consulta no navegador) — e pra
// análise externa, já que é attachment também fora do explorador.
//
//   ?formato=parquet   único formato (qualquer outro → 400)
//   ?desde=YYYY-MM-DD  recorte inferior; default 90d, teto 400d.
//
// Não entra profile: profile_id vai cru e quem cruza puxa nome por fora
// — o export fica no escopo da tabela de eventos (decisão do ticket).

const JANELA_PADRAO_DIAS = 90;
const JANELA_MAX_DIAS = 400;
// teto de segurança: passa de ~5x o volume esperado do ciclo — em tese
// inalcançável com a retenção de 90d (0201), fica como almofada de
// memória se a retenção atrasar ou a janela crescer
const TETO_LINHAS = 500_000;
// PostgREST corta em max_rows (1000, supabase/config.toml) — paginar
// sempre, um .limit maior voltava truncado em silêncio (mesmo padrão de
// IA_EVENTOS_PAGINA em lib/ia/queries.ts)
const PAGINA = 1000;
// demo: o cru fabricado encolhe pra não pesar — 4k linhas dão ao
// explorador um dataset real de mastigar sem custo de CPU na navegação
const DEMO_LINHAS = 4000;

const COLUNAS: { name: string; type: "UUID" | "STRING" | "JSON" | "TIMESTAMP" }[] = [
  { name: "id", type: "UUID" },
  { name: "profile_id", type: "UUID" },
  { name: "papel", type: "STRING" },
  { name: "superficie", type: "STRING" },
  { name: "acao", type: "STRING" },
  { name: "meta", type: "JSON" },
  { name: "created_at", type: "TIMESTAMP" },
];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const formato = params.get("formato") ?? "parquet";
  if (formato !== "parquet") {
    return NextResponse.json(
      { error: "Formato não suportado. Use formato=parquet." },
      { status: 400 }
    );
  }

  const agora = Date.now();
  const desde = parseDesde(params.get("desde"), agora);
  if (desde instanceof NextResponse) return desde;

  const demo = await demoRole();
  if (demo) {
    if (demo !== "coordenacao") {
      return NextResponse.json(
        { error: "Só a coordenação pode exportar os gestos do produto." },
        { status: 403 }
      );
    }
    // demo não coleta eventos reais — o cru é fabricado da mesma matriz
    // sintética da aba, no mesmo formato parquet (o explorador não
    // sabe a diferença)
    const janelaDias = Math.min(
      JANELA_MAX_DIAS,
      Math.max(1, Math.round((agora - desde.getTime()) / 86400000))
    );
    const linhas = dadosAdocaoEventosDemo(getDemoData(), janelaDias, DEMO_LINHAS);
    const writer = new ByteWriter();
    await parquetWriteRows({
      writer,
      rows: linhas,
      columns: COLUNAS,
      rowGroupSize: 4096,
    });
    return resposta(writer, desde, linhas.length, false);
  }

  const supabase = await createClient();

  // middleware já protege /api/*; a checagem de papel replica /api/export
  // porque route handler não passa pelo layout (e redirect pra API não
  // ajuda ninguém)
  const { data: claims } = await supabase.auth.getClaims();
  const sub = claims?.claims?.sub;
  if (!sub) {
    return NextResponse.json(
      { error: "Sessão expirada. Entre de novo." },
      { status: 401 }
    );
  }
  const [{ data: me }, { data: papeis }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("user_id", sub)
      .maybeSingle(),
    supabase.rpc("my_papeis"),
  ]);
  if (!temPapel(me ? { ...me, papeis } : null, "coordenacao")) {
    return NextResponse.json(
      { error: "Só a coordenação pode exportar os gestos do produto." },
      { status: 403 }
    );
  }

  // RLS coord = tabela inteira. Fonte única: produto_eventos cru; o
  // rollup produto_eventos_dia (0201) é agregado e fica fora do export —
  // o explorador trabalha em cima do gesto, não do pré-cálculo.
  let linhas = 0;
  let truncado = false;
  const desdeIso = desde.toISOString();
  async function* fonte(): AsyncGenerator<LinhaEventoExport> {
    for (let i = 0; i < TETO_LINHAS; i += PAGINA) {
      const { data, error } = await supabase
        .from("produto_eventos")
        .select("id, profile_id, papel, superficie, acao, meta, created_at")
        .gte("created_at", desdeIso)
        .order("created_at", { ascending: true })
        .range(i, i + PAGINA - 1);
      if (error) throw error;
      for (const r of data ?? []) {
        linhas++;
        yield {
          id: r.id,
          profile_id: r.profile_id,
          papel: r.papel,
          superficie: r.superficie,
          acao: r.acao,
          meta: r.meta,
          created_at: new Date(r.created_at),
        };
      }
      if ((data ?? []).length < PAGINA) return;
    }
    truncado = true;
  }

  // row-group a row-group: a fonte é puxada sob demanda e a memória fica
  // plana independente do total — só o buffer do arquivo cresce
  const writer = new ByteWriter();
  try {
    await parquetWriteRows({
      writer,
      rows: fonte(),
      columns: COLUNAS,
      rowGroupSize: 50_000,
      createdBy: "realiza.vc adocao export",
    });
  } catch (e) {
    console.error("adocao/export", e);
    return NextResponse.json(
      { error: "Não foi possível gerar o arquivo. Tente de novo." },
      { status: 500 }
    );
  }
  return resposta(writer, desde, linhas, truncado);
}

/** ?desde=YYYY-MM-DD validado e preso ao teto — passado demais clamp no
 *  máximo (a retenção já encurta o que existe de qualquer jeito), futuro
 *  é erro de uso (400, não silêncio). */
function parseDesde(
  param: string | null,
  agora: number
): Date | NextResponse {
  if (param == null) {
    return new Date(agora - JANELA_PADRAO_DIAS * 86400000);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(param)) {
    return NextResponse.json(
      { error: "desde inválido. Use AAAA-MM-DD." },
      { status: 400 }
    );
  }
  const d = new Date(`${param}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return NextResponse.json(
      { error: "desde inválido. Use AAAA-MM-DD." },
      { status: 400 }
    );
  }
  if (d.getTime() > agora) {
    return NextResponse.json(
      { error: "desde não pode estar no futuro." },
      { status: 400 }
    );
  }
  const minimo = agora - JANELA_MAX_DIAS * 86400000;
  if (d.getTime() < minimo) return new Date(minimo);
  return d;
}

function resposta(
  writer: ByteWriter,
  desde: Date,
  linhas: number,
  truncado: boolean
) {
  const nome = `produto-eventos-${desde.toISOString().slice(0, 10)}.parquet`;
  return new NextResponse(new Uint8Array(writer.getBuffer()), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nome}"`,
      // gesto é dado pessoal de uso — fora de cache compartilhado
      "Cache-Control": "private, no-store",
      "X-Eventos-Linhas": String(linhas),
      ...(truncado ? { "X-Eventos-Truncado": "1" } : {}),
    },
  });
}
