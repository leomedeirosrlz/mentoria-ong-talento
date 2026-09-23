import { describe, expect, it } from "vitest";
import {
  bucketsDoEncontro,
  duplasSemEncontroDoNumero,
  resumoSemana,
  resumoSemanaDe,
  semanaBounds,
} from "@/lib/ciclo";
import {
  CICLO_16,
  dt,
  encAgendado,
  encRealizado,
  mkDupla,
  mkEncontro,
  mkEvento,
  mkRegistro,
} from "./helpers";

// Derivações do board da semana da agenda — mesmas terças de referência da
// suíte do semáforo (enc 1 = 07/10, enc 2 = 14/10, enc 3 = 21/10). `agoraMs`
// sempre injetado — nada depende do relógio.

const AGORA = dt("2025-10-15").getTime(); // quarta da semana do encontro 2

describe("semanaBounds", () => {
  it("devolve seg–dom da semana calendário que contém o dia", () => {
    expect(semanaBounds(dt("2025-10-15"))).toEqual({
      seg: "2025-10-13",
      dom: "2025-10-19",
    });
  });

  it("as pontas da semana caem na mesma semana", () => {
    expect(semanaBounds(dt("2025-10-13")).seg).toBe("2025-10-13"); // segunda
    expect(semanaBounds(dt("2025-10-19")).seg).toBe("2025-10-13"); // domingo
  });
});

describe("bucketsDoEncontro", () => {
  const d = () => mkDupla();

  it("agendado vencido sem registro (limbo) é pendente, não agendado", () => {
    const b = bucketsDoEncontro(
      [
        { encontro: encAgendado(2, "2025-10-14"), dupla: d() }, // ontem → limbo
        { encontro: encAgendado(3, "2025-10-21"), dupla: d() }, // futuro
      ],
      AGORA
    );
    expect(b.pendentes.map((i) => i.encontro.numero)).toEqual([2]);
    expect(b.agendados.map((i) => i.encontro.numero)).toEqual([3]);
  });

  it("realizado sem registro é pendente; com registro é realizado", () => {
    const b = bucketsDoEncontro(
      [
        { encontro: encRealizado(1, "2025-10-07", null), dupla: d() },
        { encontro: encRealizado(2, "2025-10-14", mkRegistro()), dupla: d() },
      ],
      AGORA
    );
    expect(b.pendentes.map((i) => i.encontro.numero)).toEqual([1]);
    expect(b.realizados.map((i) => i.encontro.numero)).toEqual([2]);
  });

  it("nao_aconteceu e cancelado fecham em naoAconteceram", () => {
    const b = bucketsDoEncontro(
      [
        { encontro: mkEncontro(1, { status: "nao_aconteceu" }), dupla: d() },
        { encontro: mkEncontro(2, { status: "cancelado" }), dupla: d() },
      ],
      AGORA
    );
    expect(b.naoAconteceram).toHaveLength(2);
    expect(b.pendentes).toHaveLength(0);
  });

  it("agendado vencido COM registro não é limbo — segue em agendados", () => {
    const b = bucketsDoEncontro(
      [
        {
          encontro: mkEncontro(2, {
            status: "agendado",
            data_hora: "2025-10-14T19:00:00-03:00",
            registro: mkRegistro(),
          }),
          dupla: d(),
        },
      ],
      AGORA
    );
    expect(b.pendentes).toHaveLength(0);
    expect(b.agendados).toHaveLength(1);
  });

  it("os quatro buckets somam o total de itens", () => {
    const itens = [
      { encontro: encRealizado(1, "2025-10-07", null), dupla: d() },
      { encontro: encRealizado(2, "2025-10-14", mkRegistro()), dupla: d() },
      { encontro: encAgendado(3, "2025-10-14"), dupla: d() }, // limbo
      { encontro: encAgendado(4, "2025-10-28"), dupla: d() },
      { encontro: mkEncontro(5, { status: "nao_aconteceu" }), dupla: d() },
    ];
    const b = bucketsDoEncontro(itens, AGORA);
    const soma =
      b.pendentes.length +
      b.agendados.length +
      b.realizados.length +
      b.naoAconteceram.length;
    expect(soma).toBe(itens.length);
    expect(b.pendentes).toHaveLength(2); // realizado s/ registro + limbo
  });
});

describe("duplasSemEncontroDoNumero", () => {
  it("itemiza a dupla ativa sem nenhuma row do número", () => {
    const sem = mkDupla({ id: "d-sem" });
    const com = mkDupla({
      id: "d-com",
      encontros: [encAgendado(2, "2025-10-14")],
    });
    expect(
      duplasSemEncontroDoNumero([sem, com], 2, "2025-10-14").map((x) => x.id)
    ).toEqual(["d-sem"]);
  });

  it("iniciada_em depois da data oficial tira a dupla da coorte", () => {
    const nova = mkDupla({ iniciada_em: "2025-10-21" }); // nasceu na semana do enc 3
    // o encontro 2 (14/10) é anterior à janela dela — não é falta
    expect(duplasSemEncontroDoNumero([nova], 2, "2025-10-14")).toHaveLength(0);
    // dentro da janela, conta
    expect(duplasSemEncontroDoNumero([nova], 3, "2025-10-21")).toHaveLength(1);
  });

  it("exclui especialista e duplas não-ativas", () => {
    const esp = mkDupla({ trilha: "especialista" });
    const pausada = mkDupla({ status: "pausada" });
    const concluida = mkDupla({ status: "concluida" });
    expect(
      duplasSemEncontroDoNumero([esp, pausada, concluida], 2, "2025-10-14")
    ).toHaveLength(0);
  });

  it("qualquer row do número já cobre o encontro — até cancelada", () => {
    const d = mkDupla({ encontros: [mkEncontro(2, { status: "cancelado" })] });
    expect(duplasSemEncontroDoNumero([d], 2, "2025-10-14")).toHaveLength(0);
  });
});

describe("resumoSemanaDe", () => {
  it("conta por número, não por data — realizado em semana diferente conta no número certo", () => {
    // a dupla fez o 2º encontro só na semana do 3º — no resumo do evento 2 ela
    // entra como "realizou", mesmo o realizado_em caindo noutra semana
    const d = mkDupla({ encontros: [encRealizado(2, "2025-10-21")] });
    const r = resumoSemanaDe([d], mkEvento(2, "2025-10-14"));
    expect(r?.realizaram).toBe(1);
    expect(r?.comRegistro).toBe(1);
    expect(r?.naoAconteceram).toBe(0);
  });

  it("reposição respeita os bounds explícitos da semana", () => {
    // realizou o encontro 3 DENTRO da semana do 2 — sem o 2 realizado, ela se
    // encontrou mesmo assim → reposição, não "sem encontro"
    const d = mkDupla({ encontros: [encRealizado(3, "2025-10-15")] });
    const r = resumoSemanaDe([d], mkEvento(2, "2025-10-14"), {
      seg: "2025-10-13",
      dom: "2025-10-19",
    });
    expect(r?.realizaram).toBe(0);
    expect(r?.naoAconteceram).toBe(1);
    expect(r?.reposicao).toBe(1);
  });

  it("resumoSemana delega no resumoSemanaDe com a semana corrente", () => {
    const duplas = [
      mkDupla({ id: "d-1", encontros: [encRealizado(2, "2025-10-14")] }),
      mkDupla({ id: "d-2", encontros: [encRealizado(3, "2025-10-16")] }),
    ];
    const viaSemana = resumoSemana(duplas, CICLO_16, dt("2025-10-15"));
    const viaEvento = resumoSemanaDe(duplas, CICLO_16[1], {
      seg: "2025-10-13",
      dom: "2025-10-19",
    });
    expect(viaSemana?.evento.id).toBe(CICLO_16[1].id);
    expect(viaSemana?.realizaram).toBe(viaEvento?.realizaram);
    expect(viaSemana?.reposicao).toBe(viaEvento?.reposicao);
    expect(viaSemana?.naoAconteceram).toBe(viaEvento?.naoAconteceram);
  });

  it("null quando o evento não tem número", () => {
    expect(
      resumoSemanaDe(
        [mkDupla()],
        mkEvento(0, "2025-10-14", { numero: null, tipo: "formacao" })
      )
    ).toBeNull();
  });
});
