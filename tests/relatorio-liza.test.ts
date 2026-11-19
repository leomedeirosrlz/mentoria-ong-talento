import { describe, expect, it } from "vitest";
import {
  ABAS_LIZA,
  contextoAssinaturas,
  contextoHash,
  contextoInteracoes,
  contextoVisao,
  promptLiza,
  recorteKey,
  recorteTexto,
  PERGUNTA_PADRAO,
  type RecorteLiza,
} from "@/lib/relatorios/contexto";
import { RESPOSTA_LIZA_DEMO } from "@/lib/demo/relatorio-liza";
import type { ItemInteracao } from "@/lib/relatorios/dados";

// Contrato do "Perguntar à Liza" (REALIZA-456): identidade do recorte
// canônica, hash estável dos agregados e prompt SÓ com agregados — texto
// livre de pessoa (nome, nota, demanda) nunca pode vazar pro modelo.

describe("recorteKey — identidade canônica do recorte", () => {
  it("campos sempre na mesma ordem, ausente = vazio", () => {
    const r: RecorteLiza = { aba: "aderencia" };
    expect(recorteKey(r)).toBe("aderencia|||||");
    expect(recorteKey({ ...r, turma: "T1" })).toBe("aderencia|T1||||");
  });

  it("janela/papel/medida só contam na aba adocao", () => {
    const base: RecorteLiza = {
      aba: "aderencia",
      janela: 30,
      papel: "mentor_dpp",
      medida: "gestos",
    };
    expect(recorteKey(base)).toBe("aderencia|||||");
    const ad: RecorteLiza = { ...base, aba: "adocao" };
    expect(recorteKey(ad)).toBe("adocao|||30|mentor_dpp|gestos");
  });

  it("recorteTexto monta o rótulo humano", () => {
    expect(recorteTexto({ aba: "visao" })).toBe("Saúde");
    expect(recorteTexto({ aba: "adocao", janela: 30, papel: "mentor_dpp" })).toBe(
      "Adoção · janela de 30 dias · Mentor DPP"
    );
  });
});

describe("contextoHash — fingerprint estável dos agregados", () => {
  it("mesmo contexto, mesmo hash — independente da ordem das chaves", () => {
    const a = contextoHash({ x: 1, y: { b: 2, a: 3 } });
    const b = contextoHash({ y: { a: 3, b: 2 }, x: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("agregado diferente, hash diferente — é o que marca desatualizado", () => {
    const c1 = contextoVisao([{ dia: "2026-10-06", risco: 1, atencao: 2, ok: 9 }]);
    const c2 = contextoVisao([{ dia: "2026-10-06", risco: 2, atencao: 2, ok: 8 }]);
    expect(contextoHash(c1)).not.toBe(contextoHash(c2));
  });
});

describe("contexto builders — só agregado, nunca texto livre", () => {
  it("interações: contagens por tipo/canal + data, sem nota nem nome", () => {
    const itens: ItemInteracao[] = [
      {
        interacaoId: "i1",
        duplaId: "d1",
        tipo: "nudge",
        canal: "whatsapp",
        linha: {
          dupla: "André ↔ Ana",
          tipo: "lembrete",
          canal: "whatsapp",
          autor: "Coord",
          data: "2026-10-06T12:00:00Z",
          nota: "texto livre que não pode vazar",
        },
      },
    ];
    const ctx = contextoInteracoes(itens);
    const json = JSON.stringify(ctx);
    expect(ctx.total).toBe(1);
    expect(json).not.toContain("André");
    expect(json).not.toContain("Ana");
    expect(json).not.toContain("texto livre");
    expect(json).not.toContain("Coord");
  });

  it("assinaturas: por status e documento, sem nome da pessoa", () => {
    const ctx = contextoAssinaturas([
      {
        status: "pendente",
        pessoaId: "p1",
        linha: {
          nome: "Fulana de Tal",
          papel: "mentor",
          documento: "Termo de mentoria",
          status: "pendente",
          emitido_em: "2026-10-01T00:00:00Z",
          expira_em: "2026-11-01T00:00:00Z",
        },
      },
    ]);
    const json = JSON.stringify(ctx);
    expect(ctx.total).toBe(1);
    expect(json).not.toContain("Fulana");
    expect(json).toContain("Termo de mentoria");
  });
});

describe("promptLiza — o modelo só vê agregado", () => {
  it("system + user com seção, recorte, JSON agregado e a pergunta", () => {
    const msgs = promptLiza({
      secao: "Aderência",
      recorte: "Aderência · T1",
      contexto: { duplas_no_recorte: 3, sinais: { limbo: 1 } },
      pergunta: "o que pede ação?",
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].content).toContain('"duplas_no_recorte":3');
    expect(msgs[1].content).toContain("o que pede ação?");
    expect(msgs[1].content).not.toContain("<");
  });
});

describe("contrato demo", () => {
  it("toda aba tem resposta enlatada e a pergunta padrão existe", () => {
    for (const aba of ABAS_LIZA) {
      expect(RESPOSTA_LIZA_DEMO[aba].length).toBeGreaterThan(20);
    }
    expect(PERGUNTA_PADRAO).toContain("ação");
  });
});
