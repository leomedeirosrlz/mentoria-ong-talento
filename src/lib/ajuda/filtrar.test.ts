import { describe, expect, it } from "vitest";
import {
  COMO_FUNCIONA,
  MENU_DO_PAPEL,
  PERGUNTAS,
  TEMAS_AJUDA,
} from "./conteudo";
import {
  buscarPerguntas,
  menuDoPapel,
  papeisDe,
  perguntasPara,
  secoesPara,
} from "./filtrar";

// REALIZA-345 — a Ajuda é conteúdo estático filtrado por papel. O contrato
// testado aqui é o do filtro: quem lê nunca recebe item que não declara o
// papel dele, e a busca casa pergunta+resposta sem acento e sem caixa.

describe("papeisDe", () => {
  it("junta role primário + papeis efetivos sem repetir", () => {
    expect(
      papeisDe({
        role: "mentor_dpp",
        papeis: ["mentor_dpp", "mentor_especialista"],
      })
    ).toEqual(["mentor_dpp", "mentor_especialista"]);
  });

  it("cai no role quando papeis vem vazio/ausente", () => {
    expect(papeisDe({ role: "supervisor", papeis: [] })).toEqual(["supervisor"]);
    expect(papeisDe({ role: "coordenacao" })).toEqual(["coordenacao"]);
  });

  it("null e sem papel devolvem lista vazia", () => {
    expect(papeisDe(null)).toEqual([]);
    expect(papeisDe({ role: null })).toEqual([]);
  });
});

describe("perguntasPara", () => {
  it("todo item devolvido declara um papel efetivo de quem lê", () => {
    for (const papeis of [
      ["coordenacao"],
      ["supervisor"],
      ["mentor_dpp"],
      ["mentor_especialista"],
      ["mentorado"],
      ["mentor_dpp", "mentor_especialista"],
    ] as const) {
      const visiveis = perguntasPara(papeis, PERGUNTAS);
      for (const p of visiveis) {
        expect(p.papeis.some((r) => (papeis as readonly string[]).includes(r)), p.id).toBe(true);
      }
    }
  });

  it("mentorado não recebe pergunta exclusiva de staff", () => {
    const jovem = perguntasPara(["mentorado"], PERGUNTAS);
    expect(jovem.length).toBeGreaterThan(0);
    expect(jovem.every((p) => p.papeis.includes("mentorado"))).toBe(true);
    // a fila de Chamados é superfície de staff — fora do FAQ do jovem
    expect(jovem.some((p) => p.id === "apoio-fila")).toBe(false);
    expect(jovem.some((p) => p.id === "registro-onde")).toBe(false);
  });

  it("híbrido DPP+especialista recebe a união dos dois mundos", () => {
    const hibrido = perguntasPara(
      ["mentor_dpp", "mentor_especialista"],
      PERGUNTAS
    );
    expect(hibrido.some((p) => p.id === "registro-onde")).toBe(true); // DPP
    expect(hibrido.some((p) => p.id === "encontro-esp-sessao")).toBe(true); // esp
    expect(hibrido.some((p) => p.id === "apoio-fila")).toBe(false); // equipe
  });

  it("ordena dentro de cada tema por prioridade, desempatando pela ordem do array", () => {
    const mentor = perguntasPara(["mentor_dpp"], PERGUNTAS);
    const encontros = mentor.filter((p) => p.tema === "encontros");
    expect(encontros.map((p) => p.id)).toEqual([
      "encontro-quem-marca", // 10 — a dúvida nº 1 de quem chega
      "encontro-quantos", // 15
      "encontro-online", // 20
      "encontro-remarcar", // 30
      "encontro-ja-foi", // neutro: ordem do array daqui pra baixo
      "encontro-nao-rolou",
      "encontro-especialista",
    ]);
  });

  it("mantém a ordem das seções de TEMAS_AJUDA mesmo com prioridades diferentes", () => {
    // a prioridade reordena dentro do tema, nunca os temas entre si
    const mentor = perguntasPara(["mentor_dpp"], PERGUNTAS);
    const temasNaLista = [...new Set(mentor.map((p) => p.tema))];
    expect(temasNaLista).toEqual(TEMAS_AJUDA.map((t) => t.id));
  });

  it("filtra links por papel quando o mesmo destino tem rota diferente", () => {
    // a Agenda do mentor é /agenda; a do jovem, /jovem/agenda — cada um
    // recebe só o link da própria rota
    const mentor = perguntasPara(["mentor_dpp"], PERGUNTAS).find(
      (p) => p.id === "encontro-remarcar"
    )!;
    expect(mentor.links?.map((l) => l.href)).toEqual(["/agenda"]);
    const jovem = perguntasPara(["mentorado"], PERGUNTAS).find(
      (p) => p.id === "encontro-remarcar"
    )!;
    expect(jovem.links?.map((l) => l.href)).toEqual(["/jovem/agenda"]);
  });

  it("link com papeis fora da audiência não aparece (ação é do mentor, não da equipe)", () => {
    const equipe = perguntasPara(["coordenacao"], PERGUNTAS).find(
      (p) => p.id === "encontro-ja-foi"
    )!;
    expect(equipe.links ?? []).toHaveLength(0);
    const mentor = perguntasPara(["mentor_dpp"], PERGUNTAS).find(
      (p) => p.id === "encontro-ja-foi"
    )!;
    expect(mentor.links?.length).toBeGreaterThan(0);
  });

  it("todo link declarado usa rota interna e, se escopado, papel válido", () => {
    const papeisValidos = new Set(MENU_DO_PAPEL.map((m) => m.papel));
    for (const p of PERGUNTAS) {
      for (const l of p.links ?? []) {
        expect(l.href.startsWith("/"), `${p.id} → ${l.href}`).toBe(true);
        for (const papel of l.papeis ?? []) {
          expect(papeisValidos.has(papel), `${p.id} → ${papel}`).toBe(true);
        }
      }
    }
  });

  it("todo papel tem ao menos uma pergunta e todo item cita um tema declarado", () => {
    for (const { papel } of MENU_DO_PAPEL) {
      const itens = perguntasPara([papel], PERGUNTAS);
      expect(itens.length, papel).toBeGreaterThan(0);
      for (const p of itens) {
        expect(TEMAS_AJUDA.some((t) => t.id === p.tema), p.id).toBe(true);
      }
    }
  });

  it("dados são válidos: ids únicos, papel declarado, texto preenchido", () => {
    const ids = new Set(PERGUNTAS.map((p) => p.id));
    expect(ids.size).toBe(PERGUNTAS.length);
    for (const p of PERGUNTAS) {
      expect(p.papeis.length, p.id).toBeGreaterThan(0);
      expect(p.pergunta.trim().length, p.id).toBeGreaterThan(0);
      expect(p.resposta.trim().length, p.id).toBeGreaterThan(0);
    }
  });
});

describe("buscarPerguntas", () => {
  it("ignora acentos e caixa", () => {
    const q = PERGUNTAS.find((p) => p.id === "registro-o-que-e")!;
    const porPergunta = buscarPerguntas(PERGUNTAS, "REGISTRO");
    expect(porPergunta).toContain(q);
  });

  it("casa a resposta além da pergunta", () => {
    // "videochamada" só existe na resposta do encontro online
    const q = buscarPerguntas(PERGUNTAS, "videochamada");
    expect(q.some((p) => p.id === "encontro-online")).toBe(true);
  });

  it("acento na busca encontra texto sem acento e vice-versa", () => {
    const com = buscarPerguntas(PERGUNTAS, "agenda");
    const sem = buscarPerguntas(PERGUNTAS, "agênda");
    expect(sem.length).toBe(com.length);
  });

  it("vazia (ou só espaços) devolve a lista inteira", () => {
    expect(buscarPerguntas(PERGUNTAS, "")).toHaveLength(PERGUNTAS.length);
    expect(buscarPerguntas(PERGUNTAS, "   ")).toHaveLength(PERGUNTAS.length);
  });

  it("sem match devolve vazio", () => {
    expect(buscarPerguntas(PERGUNTAS, "xyzzy plugh")).toHaveLength(0);
  });
});

describe("secoesPara + menuDoPapel", () => {
  it("seções valem por papel efetivo; jovem recebe as versões dele", () => {
    const jovem = secoesPara(["mentorado"], COMO_FUNCIONA);
    expect(jovem.length).toBeGreaterThan(0);
    expect(jovem.every((s) => s.papeis.includes("mentorado"))).toBe(true);
    expect(jovem.some((s) => s.id === "ciclo")).toBe(false); // staff
    expect(jovem.some((s) => s.id === "ciclo-jovem")).toBe(true);
  });

  it("papel único devolve o próprio mapa, um texto por item; sem papel, []", () => {
    for (const { papel, itens } of MENU_DO_PAPEL) {
      const menu = menuDoPapel([papel]);
      expect(menu.map((m) => m.rotulo)).toEqual(itens.map((i) => i.rotulo));
      expect(
        menu.every((m) => m.textos.length === 1),
        papel
      ).toBe(true);
      expect(
        menu.every((m, i) => m.textos[0] === itens[i]!.texto),
        papel
      ).toBe(true);
    }
    expect(menuDoPapel([])).toEqual([]);
  });

  it("híbrido DPP+especialista mergeia os mapas: dedup por rótulo, texto dos dois mundos", () => {
    const menu = menuDoPapel(["mentor_dpp", "mentor_especialista"]);
    const dpp = MENU_DO_PAPEL.find((m) => m.papel === "mentor_dpp")!;
    const esp = MENU_DO_PAPEL.find((m) => m.papel === "mentor_especialista")!;
    // os rótulos são os mesmos nos dois mapas — a ordem é a do primário
    expect(menu.map((m) => m.rotulo)).toEqual(dpp.itens.map((i) => i.rotulo));
    // e cada destino traz a descrição dos dois papéis, primário primeiro
    const agenda = menu.find((m) => m.rotulo === "Agenda")!;
    expect(agenda.textos).toEqual([
      dpp.itens.find((i) => i.rotulo === "Agenda")!.texto,
      esp.itens.find((i) => i.rotulo === "Agenda")!.texto,
    ]);
    // texto idêntico nos dois mapas não vira linha dupla
    const ajuda = menu.find((m) => m.rotulo === "Ajuda")!;
    expect(ajuda.textos).toHaveLength(1);
  });

  it("destino que só existe no papel secundário entra ao final da lista", () => {
    // supervisor não tem Formulários/Turmas/Relatórios — o mapa da
    // coordenação chega depois e os destinos exclusivos fecham a fila
    const menu = menuDoPapel(["supervisor", "coordenacao"]);
    const rotulos = menu.map((m) => m.rotulo);
    expect(rotulos[0]).toBe("Visão geral");
    expect(rotulos.slice(-3)).toEqual(["Formulários", "Turmas", "Relatórios"]);
  });
});
