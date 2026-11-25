// @vitest-environment jsdom

// spec 029 + REALIZA-528 — o contrato do alternador Cartões/Lista, das
// duas gramáticas, da capa tipográfica e das seções colapsáveis: o
// default resolve por viewport × superfície (mobile lista; desktop jovem
// cartões, staff lista), a escolha explícita persiste por superfície no
// aparelho (localStorage), a lista nunca monta iframe/img de preview e
// a capa do cartão é derivada do título (capa-doc p/ doc:/arquivo,
// tinta --inst-* p/ doc de instrumento, host p/ link, <img> só p/
// imagem). As seções abrem por padrão, dobram no gesto, reabrem com a
// busca e não zeram a dobra na troca de view.

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/materiais",
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/actions", () => ({
  marcarMaterialLido: vi.fn(async () => ({ ok: true })),
  anexarArquivoMaterial: vi.fn(async () => ({ ok: true })),
  removerArquivoMaterial: vi.fn(async () => ({ ok: true })),
  editarMaterial: vi.fn(async () => ({ ok: true })),
  deleteMaterial: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/actions-email", () => ({
  enviarMaterialEmail: vi.fn(async () => ({ ok: true })),
  reenviarComunicadoEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

import { BibliotecaLista } from "@/components/biblioteca-lista";
import { BibliotecaViewToggle } from "@/components/biblioteca-view-toggle";
import { MateriaisLista } from "@/components/materiais-jovem-lista";
import type { Material } from "@/lib/types";
import { clicar, digitar, montar } from "./dom";

// o stub do dom.ts devolve matches:false (mobile). Pra desktop, o override
// responde true só pra media query que o store escuta.
const MQ = "(min-width: 768px)";
const viewport = (largo: boolean) => {
  window.matchMedia = ((q: string) => ({
    matches: largo && q === MQ,
    media: q,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
};

const pressionado = (alvo: ParentNode, rotulo: string) =>
  [...alvo.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === rotulo
  )?.getAttribute("aria-pressed");

const mat = (over: Partial<Material>): Material => ({
  id: "m0",
  titulo: "Material",
  descricao: null,
  tipo: "conteudo",
  url: null,
  path: null,
  audiencia: "todos",
  encontro_num: null,
  ordem: 0,
  ...over,
});

const MATERIAIS = [
  mat({ id: "m1", titulo: "Guia do encontro", tipo: "guia", path: "d/guia.pdf" }),
  mat({ id: "m2", titulo: "Pôster da jornada", tipo: "conteudo", path: "i/poster.png" }),
  mat({ id: "m3", titulo: "Site do programa", tipo: "link", url: "https://realiza.vc" }),
  mat({ id: "m4", titulo: "Roteiro futuro", tipo: "template" }),
];

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  viewport(false);
  localStorage.clear();
});

describe("useViewBiblioteca — defaults por viewport × superfície (FR-002)", () => {
  it("mobile (<768px) abre em Lista nas duas superfícies", () => {
    viewport(false);
    const j = montar(<BibliotecaViewToggle superficie="jovem" />);
    const s = montar(<BibliotecaViewToggle superficie="staff" />);
    expect(pressionado(j.alvo, "Lista")).toBe("true");
    expect(pressionado(s.alvo, "Lista")).toBe("true");
    j.desmontar();
    s.desmontar();
  });

  it("desktop sem preferência: jovem Cartões, staff Lista", () => {
    viewport(true);
    const j = montar(<BibliotecaViewToggle superficie="jovem" />);
    const s = montar(<BibliotecaViewToggle superficie="staff" />);
    expect(pressionado(j.alvo, "Cartões")).toBe("true");
    expect(pressionado(s.alvo, "Lista")).toBe("true");
    j.desmontar();
    s.desmontar();
  });

  it("a escolha explícita persiste por superfície e vence o viewport", () => {
    viewport(false);
    const t = montar(<BibliotecaViewToggle superficie="jovem" />);
    act(() =>
      clicar(
        [...t.alvo.querySelectorAll("button")].find(
          (b) => b.textContent?.trim() === "Cartões"
        )!
      )
    );
    expect(localStorage.getItem("biblioteca:view:jovem")).toBe("cards");
    expect(localStorage.getItem("biblioteca:view:staff")).toBeNull();
    t.desmontar();

    // remonta no MESMO mobile — a preferência ganha do default "list"
    const t2 = montar(<BibliotecaViewToggle superficie="jovem" />);
    expect(pressionado(t2.alvo, "Cartões")).toBe("true");
    // a região de status anuncia modo + total (FR-001)
    expect(t2.alvo.querySelector("[role='status']")?.textContent).toContain(
      "Cartões"
    );
    t2.desmontar();
  });

  it("preferência corrompida cai no default como se não existisse", () => {
    viewport(false);
    localStorage.setItem("biblioteca:view:jovem", "lixo");
    const { alvo, desmontar } = montar(
      <BibliotecaViewToggle superficie="jovem" />
    );
    expect(pressionado(alvo, "Lista")).toBe("true");
    desmontar();
  });
});

describe("BibliotecaLista — a lista não monta preview (FR-004)", () => {
  it("view Lista: zero iframe e zero img, ⋯ simétrico nas linhas com destino", () => {
    viewport(false);
    const { alvo, desmontar } = montar(
      <BibliotecaLista materiais={MATERIAIS} />
    );
    expect(alvo.querySelectorAll("iframe")).toHaveLength(0);
    expect(alvo.querySelectorAll("img")).toHaveLength(0);
    // ⋯ de leitura em cada linha que tem destino (o "em breve" não tem)
    const menus = alvo.querySelectorAll("[aria-label^='Ações de']");
    expect(menus).toHaveLength(3);
    expect(alvo.textContent).toContain("em breve");
    desmontar();
  });

  it("view Cartões: capa em cada card, ⋯ FORA do link e ainda zero iframe", () => {
    viewport(false);
    localStorage.setItem("biblioteca:view:staff", "cards");
    const { alvo, desmontar } = montar(
      <BibliotecaLista materiais={MATERIAIS} />
    );
    // cada material aparece uma vez, como link (ou faixa) + capa h-24
    const link = alvo.querySelector("a[href='/api/material/m1']");
    expect(link).not.toBeNull();
    // a imagem segue <img> lazy de verdade; o PDF ganha a capa
    // tipográfica capa-doc — e nenhum iframe sobe em hipótese nenhuma
    // (528 aposentou o embed da 1ª página)
    expect(alvo.querySelector("img[src='/api/material/m2']")).not.toBeNull();
    expect(alvo.querySelectorAll("iframe")).toHaveLength(0);
    // botão dentro de link seria HTML inválido — o ⋯ é sibling (spec)
    expect(alvo.querySelector("a button")).toBeNull();
    const menus = alvo.querySelectorAll("[aria-label^='Ações de']");
    expect(menus.length).toBeGreaterThanOrEqual(3);
    desmontar();
  });

  it("view Cartões da coord: 'sem conteúdo' sai uma vez e o ⋯ fica mesmo sem destino", () => {
    viewport(false);
    localStorage.setItem("biblioteca:view:staff", "cards");
    const { alvo, desmontar } = montar(
      <BibliotecaLista materiais={MATERIAIS} ehCoord />
    );
    // o badge trailing do card já diz "sem conteúdo" — a meta não repete
    const ocorrencias = alvo.textContent?.match(/sem conteúdo/g) ?? [];
    expect(ocorrencias).toHaveLength(1);
    // ⋯ da coord (editar/anexar/excluir) fica até no material sem destino —
    // é onde mora o "Anexar arquivo"
    const menus = alvo.querySelectorAll("[aria-label^='Ações de']");
    expect(menus).toHaveLength(4);
    desmontar();
  });

  it("busca continua filtrando dentro da view Cartões (FR-005)", () => {
    viewport(false);
    localStorage.setItem("biblioteca:view:staff", "cards");
    const muitos = [
      ...MATERIAIS,
      mat({ id: "m5", titulo: "Apostila 5", tipo: "guia", path: "a/5.pdf" }),
      mat({ id: "m6", titulo: "Apostila 6", tipo: "guia", path: "a/6.pdf" }),
      mat({ id: "m7", titulo: "Apostila 7", tipo: "guia", path: "a/7.pdf" }),
    ];
    const { alvo, desmontar } = montar(
      <BibliotecaLista materiais={muitos} />
    );
    const busca = alvo.querySelector("input[type='search']")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!;
      setter.call(busca, "pôster");
      busca.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(alvo.textContent).toContain("Pôster da jornada");
    expect(alvo.textContent).not.toContain("Apostila 5");
    // segue na grade de cartões — a busca não volta pra lista
    expect(alvo.querySelector("a[href='/api/material/m2']")).not.toBeNull();
    desmontar();
  });
});

describe("CapaMaterial — a capa tipográfica por destino (528)", () => {
  it("instrumento --inst-*, doc/arquivo capa-doc, link com host, imagem <img>, sem destino faixa", () => {
    viewport(false);
    localStorage.setItem("biblioteca:view:staff", "cards");
    const mats = [
      // doc de instrumento ao vivo — a tinta do sistema
      mat({ id: "i1", titulo: "PDM", tipo: "template", path: "doc:instrumento-pdm" }),
      // doc nativo sem instrumento — capa-doc "documento"
      mat({ id: "i2", titulo: "Guia", tipo: "guia", path: "doc:guia-mentor-dpp" }),
      // arquivo — capa-doc com a extensão no kicker
      mat({ id: "i3", titulo: "Apostila", tipo: "conteudo", path: "d/a.pdf" }),
      // imagem — o único preview real que sobrou
      mat({ id: "i4", titulo: "Foto", tipo: "conteudo", path: "i/foto.png" }),
      // link — o host no kicker (sem www)
      mat({ id: "i5", titulo: "Site", tipo: "link", url: "https://www.realiza.vc/sobre" }),
      // sem destino — a faixa de ícone de sempre
      mat({ id: "i6", titulo: "Futuro", tipo: "guia" }),
    ];
    const { alvo, desmontar } = montar(
      <BibliotecaLista materiais={mats} />
    );
    // a capa de instrumento se identifica pelo kicker — o selo da Linha
    expect(alvo.textContent).toContain("instrumento oficial");
    // doc nativo + arquivo = as duas capas ink+lima; a do instrumento
    // NÃO é capa-doc (vive nos tokens --inst-*)
    expect(alvo.querySelectorAll(".capa-doc")).toHaveLength(2);
    // arquivo: a extensão vira o kicker
    expect(alvo.textContent).toContain("PDF");
    // imagem segue <img> de verdade
    expect(alvo.querySelector("img[src='/api/material/i4']")).not.toBeNull();
    // link: o host sem www — o que a PreviewLink ensinava
    expect(alvo.textContent).toContain("realiza.vc");
    // sem destino: uma faixa de ícone só (a grade de capas não conta)
    expect(
      alvo.querySelectorAll(".h-24.place-items-center")
    ).toHaveLength(1);
    // a capa é decorativa — nada dentro dela é focável nem nomeado
    expect(alvo.querySelectorAll("[aria-hidden] .capa-doc").length).toBe(0);
    expect(alvo.querySelectorAll(".capa-doc").length).toBeGreaterThan(0);
    expect(
      [...alvo.querySelectorAll(".capa-doc")].every(
        (c) => c.closest("[aria-hidden]") === c
      )
    ).toBe(true);
    desmontar();
  });
});

// seções colapsáveis (528): o gatilho é o button dentro do h3 e o painel
// fecha em hidden="until-found" (find-in-page revela). Estado fora da
// subárvore re-keyed — busca e view não zeram a dobra. A seção da
// categoria é a que o aria-labelledby aponta pro PRÓPRIO h3 — a landmark
// externa da biblioteca também carrega h3s descendentes.
const secao = (alvo: ParentNode, rotulo: string) =>
  [...alvo.querySelectorAll("section[aria-labelledby]")].find((s) => {
    const h = document.getElementById(s.getAttribute("aria-labelledby")!);
    return h?.tagName === "H3" && h.textContent?.includes(rotulo);
  })!;

describe("seções colapsáveis da biblioteca (528)", () => {
  const gatilho = (s: Element) =>
    s.querySelector("h3 button[aria-expanded]") as HTMLButtonElement;

  it("aberta por padrão, dobra e abre no gesto — a região segue nomeada", () => {
    viewport(false);
    const { alvo, desmontar } = montar(
      <BibliotecaLista materiais={MATERIAIS} />
    );
    const guias = secao(alvo, "Guias");
    expect(gatilho(guias).getAttribute("aria-expanded")).toBe("true");
    // a contagem mora no rótulo dobrável ("Guias 1 item")
    expect(guias.querySelector("h3")!.textContent).toContain("1 item");

    act(() => clicar(gatilho(guias)));
    expect(gatilho(secao(alvo, "Guias")).getAttribute("aria-expanded")).toBe(
      "false"
    );
    // fechado é until-found — Ctrl+F ainda revela o material dentro
    const painel = secao(alvo, "Guias").querySelector("[hidden]");
    expect(painel?.getAttribute("hidden")).toBe("until-found");
    // a região continua nomeada pelo heading — navegação por landmark ok
    const s2 = secao(alvo, "Guias");
    expect(s2.getAttribute("aria-labelledby")).toBe(
      s2.querySelector("h3")!.id
    );

    act(() => clicar(gatilho(s2)));
    expect(gatilho(secao(alvo, "Guias")).getAttribute("aria-expanded")).toBe(
      "true"
    );
    desmontar();
  });

  it("a busca força a seção fechada a abrir — hit nunca fica invisível", () => {
    viewport(false);
    // a caixa de busca só existe com >6 itens — a régua da casa
    const muitos = [
      ...MATERIAIS,
      mat({ id: "m5", titulo: "Apostila 5", tipo: "guia", path: "a/5.pdf" }),
      mat({ id: "m6", titulo: "Apostila 6", tipo: "guia", path: "a/6.pdf" }),
      mat({ id: "m7", titulo: "Apostila 7", tipo: "guia", path: "a/7.pdf" }),
    ];
    const { alvo, desmontar } = montar(
      <BibliotecaLista materiais={muitos} />
    );
    act(() => clicar(gatilho(secao(alvo, "Guias"))));
    expect(gatilho(secao(alvo, "Guias")).getAttribute("aria-expanded")).toBe(
      "false"
    );
    const busca = alvo.querySelector("input[type='search']")!;
    act(() => digitar(busca as HTMLInputElement, "guia"));
    expect(gatilho(secao(alvo, "Guias")).getAttribute("aria-expanded")).toBe(
      "true"
    );
    desmontar();
  });

  it("a dobra sobrevive à troca de view — o estado mora fora do re-key", () => {
    viewport(false);
    const { alvo, desmontar } = montar(
      <BibliotecaLista materiais={MATERIAIS} />
    );
    act(() => clicar(gatilho(secao(alvo, "Guias"))));
    expect(gatilho(secao(alvo, "Guias")).getAttribute("aria-expanded")).toBe(
      "false"
    );
    // a troca real do toggle: localStorage + o canal do
    // useSyncExternalStore (evento storage)
    act(() => {
      localStorage.setItem("biblioteca:view:staff", "cards");
      window.dispatchEvent(new Event("storage"));
    });
    // remontou na gramática de cartões — e a dobra não zerou
    expect(alvo.querySelector(".capa-doc")).not.toBeNull();
    expect(gatilho(secao(alvo, "Guias")).getAttribute("aria-expanded")).toBe(
      "false"
    );
    desmontar();
  });
});

describe("Acervo do jovem — mesma régua, docBase própria", () => {
  it("a linha do doc nativo aponta pra /jovem/materiais/documento (não a do staff)", () => {
    viewport(false);
    const doc = mat({
      id: "d1",
      titulo: "Como conduzir",
      tipo: "guia",
      path: "doc:como-conduzir",
    });
    const { alvo, desmontar } = montar(<MateriaisLista materiais={[doc]} />);
    expect(
      alvo.querySelector("a[href='/jovem/materiais/documento/como-conduzir']")
    ).not.toBeNull();
    desmontar();
  });

  it("o 'Mais adiante' segue recolhido nas duas views (FR-005)", () => {
    viewport(false);
    localStorage.setItem("biblioteca:view:jovem", "cards");
    const futuro = mat({
      id: "f1",
      titulo: "Material do enc. 5",
      encontro_num: 5,
      path: "d/f.pdf",
    });
    const { alvo, desmontar } = montar(
      <MateriaisLista materiais={[futuro]} encCorrente={2} />
    );
    const det = alvo.querySelector("details");
    expect(det).not.toBeNull();
    expect(det!.open).toBe(false);
    expect(det!.textContent).toContain("Mais adiante na jornada");
    desmontar();
  });

  it("grupo dobrável com contagem — e a dobra não zera na troca de view", () => {
    viewport(false);
    const g1 = mat({
      id: "g1",
      titulo: "Guia A",
      tipo: "guia",
      path: "d/g.pdf",
    });
    const { alvo, desmontar } = montar(<MateriaisLista materiais={[g1]} />);
    const gatilho = () =>
      alvo.querySelector("h3 button[aria-expanded]") as HTMLButtonElement;
    // rótulo dobrável carrega a contagem, mesmo padrão do staff
    expect(
      gatilho().closest("h3")!.textContent
    ).toContain("1 item");
    expect(gatilho().getAttribute("aria-expanded")).toBe("true");
    act(() => clicar(gatilho()));
    expect(
      alvo
        .querySelector("h3 button[aria-expanded]")!
        .getAttribute("aria-expanded")
    ).toBe("false");
    // troca pra Cartões pelo canal do store — remonta e a dobra fica
    act(() => {
      localStorage.setItem("biblioteca:view:jovem", "cards");
      window.dispatchEvent(new Event("storage"));
    });
    expect(
      alvo
        .querySelector("h3 button[aria-expanded]")!
        .getAttribute("aria-expanded")
    ).toBe("false");
    desmontar();
  });
});
