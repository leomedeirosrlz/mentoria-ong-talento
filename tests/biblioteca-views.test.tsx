// @vitest-environment jsdom

// spec 029 — o contrato do alternador Cartões/Lista e das duas gramáticas:
// o default resolve por viewport × superfície (mobile lista; desktop jovem
// cartões, staff lista), a escolha explícita persiste por superfície no
// aparelho (localStorage) e a lista nunca monta iframe/img de preview.

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
import { clicar, montar } from "./dom";

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
    // a thumb de imagem monta a <img> lazy; o PDF cai no ícone (jsdom
    // não embute) — e nenhum iframe sobe em hipótese nenhuma
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
});
