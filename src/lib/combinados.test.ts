import { describe, expect, it } from "vitest";
import {
  reconciliaCombinados,
  type CombinadoEnviado,
  type CombinadoExistente,
} from "./combinados";

const ex = (
  id: string,
  descricao: string,
  responsavel = "mentorado",
  prazo: string | null = null
): CombinadoExistente => ({ id, descricao, responsavel, prazo });

const env = (
  descricao: string,
  id: string | null = null,
  responsavel: "mentor" | "mentorado" = "mentorado",
  prazo: string | null = null
): CombinadoEnviado => ({ id, descricao, responsavel, prazo });

describe("reconciliaCombinados", () => {
  it("registro novo: sem existentes, tudo vira insert (id local é ignorado)", () => {
    const r = reconciliaCombinados([], [
      env("Enviar o questionário", "uuid-do-react"),
      env("Revisar a submeta", null, "mentor", "2026-05-10"),
    ]);
    expect(r).toEqual({
      inserir: [
        { descricao: "Enviar o questionário", responsavel: "mentorado", prazo: null },
        { descricao: "Revisar a submeta", responsavel: "mentor", prazo: "2026-05-10" },
      ],
      atualizar: [],
      remover: [],
    });
  });

  it("edição sem mudança: id casado e conteúdo igual não gera write", () => {
    const r = reconciliaCombinados(
      [ex("enc-1", "Enviar o questionário", "mentorado", "2026-05-10")],
      [env("Enviar o questionário", "enc-1", "mentorado", "2026-05-10")]
    );
    expect(r).toEqual({ inserir: [], atualizar: [], remover: [] });
  });

  it("edição altera a linha: id casado com campo diferente vira update", () => {
    const r = reconciliaCombinados(
      [ex("enc-1", "Enviar o questionário", "mentorado", "2026-05-10")],
      [env("Enviar o questionário revisado", "enc-1", "mentor", "2026-05-12")]
    );
    expect(r).toEqual({
      inserir: [],
      atualizar: [
        {
          id: "enc-1",
          descricao: "Enviar o questionário revisado",
          responsavel: "mentor",
          prazo: "2026-05-12",
        },
      ],
      remover: [],
    });
  });

  it("existente ausente no envio vira delete; status nunca entra no payload", () => {
    const r = reconciliaCombinados(
      [ex("enc-1", "Ficou", "mentorado"), ex("enc-2", "Sumiu", "mentor")],
      [env("Ficou melhor", "enc-1", "mentorado")]
    );
    expect(r.inserir).toEqual([]);
    expect(r.remover).toEqual(["enc-2"]);
    // o plano de update não carrega status — feito/pendente é preservado
    expect(r.atualizar).toEqual([
      { id: "enc-1", descricao: "Ficou melhor", responsavel: "mentorado", prazo: null },
    ]);
    expect(Object.keys(r.atualizar[0])).not.toContain("status");
  });

  it("linha nova na edição (sem id / id desconhecido) vira insert", () => {
    const r = reconciliaCombinados(
      [ex("enc-1", "Antigo")],
      [
        env("Antigo", "enc-1"),
        env("Novo combinado", null, "mentor", "2026-05-20"),
        env("Linha com uuid local", "uuid-novo-nao-existe"),
      ]
    );
    expect(r.inserir).toEqual([
      { descricao: "Novo combinado", responsavel: "mentor", prazo: "2026-05-20" },
      { descricao: "Linha com uuid local", responsavel: "mentorado", prazo: null },
    ]);
    expect(r.atualizar).toEqual([]);
    expect(r.remover).toEqual([]);
  });

  it("removeu e redigitou igual: substitui a row em vez de perder o combinado", () => {
    const r = reconciliaCombinados(
      [ex("enc-1", "Mesmo texto", "mentorado", "2026-05-10")],
      [env("Mesmo texto", null, "mentorado", "2026-05-10")]
    );
    expect(r.remover).toEqual(["enc-1"]);
    expect(r.inserir).toEqual([
      { descricao: "Mesmo texto", responsavel: "mentorado", prazo: "2026-05-10" },
    ]);
    expect(r.atualizar).toEqual([]);
  });

  it("re-submit de aba duplicada: não duplica o que o próprio envio já cobre", () => {
    // primeiro save da aba A gravou enc-1; a aba B reenvia o mesmo payload
    // com os ids que tinha (uuid local) — o casado cobre o conteúdo
    const r = reconciliaCombinados(
      [ex("enc-1", "Questionário", "mentorado", null)],
      [
        env("Questionário", "enc-1"),
        env("Questionário", "uuid-aba-velha"),
      ]
    );
    expect(r.inserir).toEqual([]);
    expect(r.atualizar).toEqual([]);
    expect(r.remover).toEqual([]);
  });

  it("duas linhas idênticas no mesmo envio não duplicam", () => {
    const r = reconciliaCombinados([], [
      env("Questionário"),
      env("Questionário"),
    ]);
    expect(r.inserir).toHaveLength(1);
    expect(r.remover).toEqual([]);
  });

  it("id repetido no envio colapsa na primeira ocorrência", () => {
    const r = reconciliaCombinados(
      [ex("enc-1", "Original", "mentorado")],
      [
        env("Editado", "enc-1", "mentor"),
        env("Editado de novo", "enc-1", "mentorado"),
      ]
    );
    expect(r).toEqual({
      inserir: [],
      atualizar: [{ id: "enc-1", descricao: "Editado", responsavel: "mentor", prazo: null }],
      remover: [],
    });
  });

  it("prazo null do banco casa com null do envio (mesma chave)", () => {
    const r = reconciliaCombinados(
      [ex("enc-1", "Sem prazo", "mentorado", null)],
      [env("Sem prazo", "enc-1", "mentorado", null)]
    );
    expect(r.atualizar).toEqual([]);
    expect(r.remover).toEqual([]);
  });
});
