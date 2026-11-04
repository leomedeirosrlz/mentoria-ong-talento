import { describe, expect, it } from "vitest";
import { painelDuplasDoDia, type LinhaPainelDia } from "@/lib/painel-dia";
import {
  CICLO_16,
  encAgendado,
  encRealizado,
  mkDupla,
  mkEncontro,
} from "./helpers";
import type { Dupla } from "@/lib/types";

// Semana de referência: a do 8º encontro oficial (terça 2025-11-25 no
// CICLO_16) — seg 24/11 a dom 30/11. "Hoje" sempre injetado; os encontros
// levam instante com offset -03:00 pelos helpers (dth), sem depender do fuso.
const TERCA = "2025-11-25"; // dia oficial do 8º
const QUINTA = "2025-11-27";
const SEXTA = "2025-11-28";
const SABADO = "2025-11-29";

function painel(duplas: Dupla[], dia: string, hoje = SABADO) {
  return painelDuplasDoDia({ duplas, eventos: CICLO_16, selecionado: dia, hoje });
}

const tipos = (linhas: LinhaPainelDia[]) => linhas.map((l) => l.tipo);
const numeros = (linhas: LinhaPainelDia[]) =>
  linhas.map((l) => (l.tipo === "agendar" ? l.numero : l.encontro.numero));

const ana = (encontros: Dupla["encontros"]) =>
  mkDupla({ id: "d-ana", encontros });
const larissa = (encontros: Dupla["encontros"]) =>
  mkDupla({ id: "d-lar", encontros });

describe("painelDuplasDoDia — Neste dia", () => {
  it("só entra encontro com data no dia, de qualquer dupla, por horário", () => {
    const a = ana([
      encAgendado(7, SABADO, "19:00"),
      encAgendado(8, TERCA),
    ]);
    const l = larissa([encAgendado(5, SABADO, "18:30")]);
    const p = painel([a, l], SABADO);
    // Larissa 18:30 antes de Ana 19:00 — a ordem é do dia, não da dupla
    expect(p.noDia.map((i) => i.encontro.numero)).toEqual([5, 7]);
    expect(p.noDia.map((i) => i.dupla.id)).toEqual(["d-lar", "d-ana"]);
  });
});

describe("F — rótulo da linha e ação falam do mesmo encontro", () => {
  // o bug: num dia da semana do 8º a linha dizia "8º · a agendar" e o botão
  // era "Remarcar" do 7º (o alvoAgendamento apontava ele, não o da linha)
  it("7º agendado + 8º sem row ⇒ remarcar do 7º E agendar do 8º, por nº", () => {
    const d = ana([encAgendado(7, QUINTA)]); // agendado em outro dia da semana
    const p = painel([d], SABADO);
    expect(p.noDia).toEqual([]);
    expect(p.semana).toHaveLength(1);
    const linhas = p.semana[0].linhas;
    expect(tipos(linhas)).toEqual(["remarcar", "agendar"]);
    expect(numeros(linhas)).toEqual([7, 8]);
    // o remarcar carrega o encontro certo — nunca o "a agendar" com Remarcar
    expect(linhas[0]).toMatchObject({ tipo: "remarcar", encontro: { numero: 7 } });
  });

  it("mesma leitura no dia oficial (o antigo caía noutro ramo)", () => {
    const d = ana([encAgendado(7, QUINTA)]);
    const p = painel([d], TERCA);
    const linhas = p.semana[0].linhas;
    expect(tipos(linhas)).toEqual(["remarcar", "agendar"]);
    expect(numeros(linhas)).toEqual([7, 8]);
  });
});

describe("G/H — o que é do dia não se mistura com o que é da semana", () => {
  // reprodução do print: sábado, Ana com o 7º no próprio dia e o 8º marcado
  // na terça; Larissa com o 7º na quinta e o 8º sem agendar
  const a = ana([encAgendado(7, SABADO), encAgendado(8, TERCA)]);
  const l = larissa([encAgendado(7, QUINTA)]);

  it("no sábado: dia mostra só o 7º da Ana; semana separa por dupla e por nº", () => {
    const p = painel([a, l], SABADO);
    expect(p.noDia.map((i) => i.encontro.numero)).toEqual([7]);
    expect(p.noDia[0].dupla.id).toBe("d-ana");
    expect(p.semana.map((g) => g.dupla.id)).toEqual(["d-ana", "d-lar"]);
    // Ana: o 8º oficial marcado na terça — linha de encontro, sem ação solta
    expect(tipos(p.semana[0].linhas)).toEqual(["encontro"]);
    expect(numeros(p.semana[0].linhas)).toEqual([8]);
    // Larissa: remarcar o 7º, agendar o 8º — nada de "a agendar" com Remarcar
    expect(tipos(p.semana[1].linhas)).toEqual(["remarcar", "agendar"]);
    expect(numeros(p.semana[1].linhas)).toEqual([7, 8]);
  });

  it("no dia oficial: a linha do 8º da Ana sai da semana e vai pro dia", () => {
    const p = painel([a, l], TERCA);
    expect(p.noDia.map((i) => i.encontro.numero)).toEqual([8]);
    // Ana fica na semana só pelo 7º anterior agendado (sábado, não realizado)
    expect(p.semana.map((g) => g.dupla.id)).toEqual(["d-ana", "d-lar"]);
    expect(tipos(p.semana[0].linhas)).toEqual(["remarcar"]);
    expect(numeros(p.semana[0].linhas)).toEqual([7]);
    expect(numeros(p.semana[1].linhas)).toEqual([7, 8]);
  });

  it("num dia vazio da semana: sem 'Neste dia', semana segue completa", () => {
    const p = painel([a, l], SEXTA);
    expect(p.noDia).toEqual([]);
    expect(p.semana).toHaveLength(2);
    // na sexta o 7º da Ana não é do dia — entra como anterior agendado
    expect(tipos(p.semana[0].linhas)).toEqual(["remarcar", "encontro"]);
    expect(numeros(p.semana[0].linhas)).toEqual([7, 8]);
    expect(numeros(p.semana[1].linhas)).toEqual([7, 8]);
  });
});

describe("demais casos da regra", () => {
  it("oficial realizado em outro dia sem registro entra como linha de encontro", () => {
    const d = ana([{ ...encRealizado(8, QUINTA), registro: null }]);
    const p = painel([d], SABADO);
    expect(tipos(p.semana[0].linhas)).toEqual(["encontro"]);
    expect(numeros(p.semana[0].linhas)).toEqual([8]);
  });

  it("oficial realizado e registrado é história: não entra na semana", () => {
    const d = ana([
      { ...encRealizado(8, QUINTA), registro: { id: "r8" } as never },
    ]);
    const p = painel([d], SABADO);
    expect(p.semana).toEqual([]);
  });

  it("oficial marcado como não aconteceu pede remarcar (reagendar)", () => {
    const d = ana([
      mkEncontro(8, {
        status: "nao_aconteceu",
        data_hora: "2025-11-25T19:00:00-03:00",
      }),
    ]);
    const p = painel([d], SABADO);
    expect(tipos(p.semana[0].linhas)).toEqual(["remarcar"]);
    expect(numeros(p.semana[0].linhas)).toEqual([8]);
  });

  it("dupla sem nada no dia nem na semana some do quadro", () => {
    // o oficial da semana cai no próprio dia selecionado e não há pendência
    // anterior — nada sobra pra "Também nesta semana"
    const d = ana([encAgendado(8, TERCA)]);
    const p = painel([d], TERCA);
    expect(p.noDia.map((i) => i.encontro.numero)).toEqual([8]);
    expect(p.semana).toEqual([]);
  });

  it("semana sem oficial pra dupla mostra o 'Agendar o Nº' do próximo pendente", () => {
    // semana após o ciclo (16º foi ter 20/01 — seg 26/01 não tem oficial)
    const feitos = (n: number) =>
      Array.from({ length: n }, (_, i) => encRealizado(i + 1, "2025-08-05"));
    const cicloCompleto = painel([ana(feitos(16))], "2026-01-27", "2026-01-27");
    expect(cicloCompleto.semana).toEqual([]); // 16/16 feitos — some
    const p = painel([ana(feitos(10))], "2026-01-27", "2026-01-27");
    expect(tipos(p.semana[0].linhas)).toEqual(["agendar"]);
    expect(numeros(p.semana[0].linhas)).toEqual([11]); // próximo pendente
  });

  it("semana sem oficial com encontro alvo agenda... vira remarcar dele", () => {
    const d = ana([encAgendado(11, "2026-01-30")]);
    const p = painel([d], "2026-01-27", "2026-01-27");
    expect(tipos(p.semana[0].linhas)).toEqual(["remarcar"]);
    expect(numeros(p.semana[0].linhas)).toEqual([11]);
  });

  it("agendado de nº posterior ao oficial não entra na semana", () => {
    const d = ana([encAgendado(9, "2025-12-02"), encAgendado(8, TERCA)]);
    const p = painel([d], SABADO);
    // o 9º é da semana seguinte — só o 8º (oficial desta) aparece
    expect(tipos(p.semana[0].linhas)).toEqual(["encontro"]);
    expect(numeros(p.semana[0].linhas)).toEqual([8]);
  });
});
