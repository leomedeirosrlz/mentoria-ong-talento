import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  docOkMentorado,
  docsDevidosMentorado,
  docsOkMentorado,
  type DocsResumo,
} from "@/lib/pessoas-status";
import { emitirUm } from "@/lib/documentos/emissao";

/** "YYYY-MM-DD" de quem nasceu há `anos` anos (+`dias` a mais) — relativo
 *  ao hoje porque idade() ancora na data local, não numa constante. */
const nascimento = (anos: number, dias = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anos);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const VAZIO: DocsResumo = { assinado: {}, pendente: [] };
const comDocs = (
  assinado: string[] = [],
  pendente: string[] = []
): DocsResumo => ({
  assinado: Object.fromEntries(assinado.map((s) => [s, { id: s }])),
  pendente,
});

describe("docsDevidosMentorado", () => {
  it("menor de idade deve os DOIS documentos — termo dele + autorização", () => {
    expect(
      docsDevidosMentorado({ data_nascimento: nascimento(16) })
    ).toEqual(["termo-mentorando", "autorizacao-responsavel"]);
    // quem faz 18 amanhã ainda é menor — os dois seguem devidos
    expect(
      docsDevidosMentorado({ data_nascimento: nascimento(18, 1) })
    ).toEqual(["termo-mentorando", "autorizacao-responsavel"]);
  });

  it("adulto deve só o termo de participação", () => {
    expect(
      docsDevidosMentorado({ data_nascimento: nascimento(18) })
    ).toEqual(["termo-mentorando"]);
    expect(
      docsDevidosMentorado({ data_nascimento: nascimento(30) })
    ).toEqual(["termo-mentorando"]);
  });

  it("sem data de nascimento válida, só o termo (a autorização fica pra emissão manual quando a data entrar)", () => {
    expect(docsDevidosMentorado({ data_nascimento: null })).toEqual([
      "termo-mentorando",
    ]);
    expect(docsDevidosMentorado({ data_nascimento: "não-é-data" })).toEqual([
      "termo-mentorando",
    ]);
  });
});

describe("docOkMentorado / docsOkMentorado", () => {
  const menor = { data_nascimento: nascimento(16), documento_path: null };

  it("menor sem nada assinado está pendente", () => {
    expect(docsOkMentorado(menor, VAZIO)).toBe(false);
    expect(docsOkMentorado(menor, undefined)).toBe(false);
  });

  it("menor com só UM dos dois assinados segue pendente", () => {
    expect(
      docsOkMentorado(menor, comDocs(["termo-mentorando"]))
    ).toBe(false);
    expect(
      docsOkMentorado(menor, comDocs(["autorizacao-responsavel"]))
    ).toBe(false);
  });

  it("menor com os dois assinados está completo", () => {
    expect(
      docsOkMentorado(
        menor,
        comDocs(["termo-mentorando", "autorizacao-responsavel"])
      )
    ).toBe(true);
  });

  it("documento_path quita a autorização, nunca o termo", () => {
    const comPapel = { ...menor, documento_path: "documentos/aut.pdf" };
    // papel no arquivo + termo assinado → completo
    expect(
      docsOkMentorado(comPapel, comDocs(["termo-mentorando"]))
    ).toBe(true);
    // papel no arquivo mas termo faltando → pendente (o upload é a
    // autorização, não o documento do jovem)
    expect(docsOkMentorado(comPapel, VAZIO)).toBe(false);
    expect(
      docOkMentorado(comPapel, "termo-mentorando", VAZIO)
    ).toBe(false);
    expect(
      docOkMentorado(comPapel, "autorizacao-responsavel", VAZIO)
    ).toBe(true);
  });

  it("adulto: só o termo conta — autorização assinada não quita nada", () => {
    const adulto = { data_nascimento: nascimento(20), documento_path: null };
    expect(docsOkMentorado(adulto, VAZIO)).toBe(false);
    expect(
      docsOkMentorado(adulto, comDocs(["autorizacao-responsavel"]))
    ).toBe(false);
    expect(
      docsOkMentorado(adulto, comDocs(["termo-mentorando"]))
    ).toBe(true);
    // documento_path em adulto não vale autorização nem termo
    const adultoPapel = { ...adulto, documento_path: "documentos/x.pdf" };
    expect(docsOkMentorado(adultoPapel, VAZIO)).toBe(false);
  });

  it("quem fez 18 com a autorização assinada passa a dever o termo", () => {
    // a régua olha a idade ATUAL: a autorização da época de menor não
    // apaga o termo que virou devido
    const recemAdulto = {
      data_nascimento: nascimento(18),
      documento_path: "documentos/aut.pdf",
    };
    expect(
      docsOkMentorado(recemAdulto, comDocs(["autorizacao-responsavel"]))
    ).toBe(false);
    expect(
      docsOkMentorado(
        recemAdulto,
        comDocs(["autorizacao-responsavel", "termo-mentorando"])
      )
    ).toBe(true);
  });

  it("sem nascimento registrado, o termo assinado basta", () => {
    const semData = { data_nascimento: null, documento_path: null };
    expect(docsOkMentorado(semData, VAZIO)).toBe(false);
    expect(
      docsOkMentorado(semData, comDocs(["termo-mentorando"]))
    ).toBe(true);
  });
});

// ---------- emissão do par (emitirUm) ----------

type RowAssinatura = {
  id: string;
  template_id: string;
  mentorado_id: string;
  status: "pendente" | "assinado" | "revogado" | "expirado";
  token: string;
  token_expira_em: string | null;
  created_at: string;
};

/** supabase-js falso só da tabela assinaturas — mesmo padrão do
 *  supaFake de escritas.test.ts, mas honrando eq/in porque emitirUm
 *  filtra a row viva por alvo×template. O insert materializa a row na
 *  lista: a segunda emissão enxerga a primeira, como a viva_uk faria. */
function supaAssinaturas(rowsIni: RowAssinatura[] = []) {
  const rows = [...rowsIni];
  let seq = rows.length;
  const builder = () => {
    const filtros: ((r: RowAssinatura) => boolean)[] = [];
    let inserida: RowAssinatura | null = null;
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (col: string, v: unknown) => {
        filtros.push((r) => r[col as keyof RowAssinatura] === v);
        return b;
      },
      in: (col: string, vs: unknown[]) => {
        filtros.push((r) => vs.includes(r[col as keyof RowAssinatura]));
        return b;
      },
      insert: (p: Record<string, unknown>) => {
        inserida = {
          id: `a-${++seq}`,
          status: "pendente",
          token: `tok-${seq}`,
          token_expira_em: null,
          created_at: "2026-01-01T00:00:00Z",
          ...p,
        } as RowAssinatura;
        rows.push(inserida);
        return b;
      },
      single: () =>
        Promise.resolve({
          data: inserida ?? rows.find((r) => filtros.every((f) => f(r))) ?? null,
          error: null,
        }),
      maybeSingle: () =>
        Promise.resolve({
          data: rows.find((r) => filtros.every((f) => f(r))) ?? null,
          error: null,
        }),
    };
    return b;
  };
  const supabase = {
    from: (t: string) => {
      expect(t).toBe("assinaturas");
      return builder();
    },
    rpc: (name: string, args: { p_id: string }) => {
      expect(name).toBe("regenerar_token_assinatura");
      const r = rows.find((x) => x.id === args.p_id);
      if (!r) return Promise.resolve({ data: null, error: { message: "x" } });
      r.token = `tok-regen-${r.id}`;
      r.token_expira_em = new Date(Date.now() + 30 * 86400e3).toISOString();
      return Promise.resolve({ data: r.token, error: null });
    },
  };
  return { supabase: supabase as unknown as SupabaseClient, rows };
}

const JOVEM = "11111111-2222-4333-8444-555555555555";
const TPL_TERMO = "tpl-termo";
const TPL_AUT = "tpl-aut";
const COORD = "coord-1";

/** O par devido do menor, emitido na ordem da régua — o que solicitar e o
 *  lote fazem internamente. */
const emitirPar = (supabase: SupabaseClient) =>
  Promise.all(
    [TPL_TERMO, TPL_AUT].map((tpl) =>
      emitirUm(supabase, tpl, "mentorado", JOVEM, COORD)
    )
  );

describe("emitirUm — par do menor idempotente", () => {
  it("a primeira passada cria uma row por documento, com link cada", async () => {
    const { supabase, rows } = supaAssinaturas();
    const rs = await emitirPar(supabase);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.template_id)).size).toBe(2);
    for (const r of rs) expect(r).toHaveProperty("token");
    for (const r of rs)
      expect((r as { existente: boolean }).existente).toBe(false);
  });

  it("repetir a passada reusa as pendências vivas — nada duplica", async () => {
    const { supabase, rows } = supaAssinaturas();
    const primeira = await emitirPar(supabase);
    const segunda = await emitirPar(supabase);
    expect(rows).toHaveLength(2);
    for (const r of segunda) {
      expect(r).not.toBe("assinado");
      expect((r as { existente: boolean }).existente).toBe(true);
    }
    // mesmo token da pendência viva — o link já mandado segue valendo
    expect(
      segunda.map((r) => (r as { token: string }).token)
    ).toEqual(primeira.map((r) => (r as { token: string }).token));
  });

  it("documento já assinado responde 'assinado' sem row nova", async () => {
    const { supabase, rows } = supaAssinaturas([
      {
        id: "a-1",
        template_id: TPL_TERMO,
        mentorado_id: JOVEM,
        status: "assinado",
        token: "tok-1",
        token_expira_em: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
    const r = await emitirUm(supabase, TPL_TERMO, "mentorado", JOVEM, COORD);
    expect(r).toBe("assinado");
    expect(rows).toHaveLength(1);
  });

  it("pendência vencida regenera o token na MESMA row", async () => {
    const { supabase, rows } = supaAssinaturas([
      {
        id: "a-1",
        template_id: TPL_TERMO,
        mentorado_id: JOVEM,
        status: "pendente",
        token: "tok-morto",
        token_expira_em: "2020-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
    const r = await emitirUm(supabase, TPL_TERMO, "mentorado", JOVEM, COORD);
    expect(rows).toHaveLength(1);
    expect(r).not.toBe("assinado");
    expect((r as { existente: boolean }).existente).toBe(true);
    expect((r as { token: string }).token).toBe("tok-regen-a-1");
    expect(rows[0].token).toBe("tok-regen-a-1");
  });
});
