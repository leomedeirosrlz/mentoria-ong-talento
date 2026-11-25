// @vitest-environment jsdom
// US5/US6 da spec 022: a superfície única renderiza Dialog (lg+) no
// desktop e Sheet de rodapé no celular — useDesktop lê o matchMedia na
// montagem via useSyncExternalStore, então o stub tem que estar no ar
// ANTES do montar. E a validação honesta do form de meta do PDM
// (SC-005): submit sem título marca o campo, fala o motivo inline e
// devolve o foco — nunca um botão disabled mudo.

import { act, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormSurface } from "@/components/form-surface";
import { PdmDupla } from "@/components/pdm-dupla";
import { pdmSalvarItem } from "@/lib/actions-pdm";
import type { PdmDoc } from "@/lib/pdm";
import {
  assentar,
  botao,
  clicar,
  digitar,
  montar,
  submeter,
} from "./dom";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/actions-pdm", () => ({
  pdmReordenar: vi.fn(async () => ({ ok: true })),
  pdmRemoverItem: vi.fn(async () => ({ ok: true })),
  pdmSalvarItem: vi.fn(async () => ({ ok: true })),
  pdmSalvarVisao: vi.fn(async () => ({ ok: true })),
  pdmStatusItem: vi.fn(async () => ({ ok: true })),
}));

/** Stub do viewport: só a query do useDesktop ("(min-width: 768px)")
 *  recebe a resposta pedida — as demais (hover, reduced-motion…) ficam
 *  em `false`, senão o stub vazaria pra primitivos que consultam outras
 *  media queries. Rodar antes de qualquer montar. */
function viewport(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query === "(min-width: 768px)" ? desktop : false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

const DOC_VAZIO: PdmDoc = {
  duplaId: "d1",
  visao: null,
  visaoEm: null,
  visaoPor: null,
  itens: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("FormSurface — uma superfície, dois corpos", () => {
  it("desktop: abre Dialog lg com o rodapé preso no pé", async () => {
    viewport(true);
    const { desmontar } = montar(
      <FormSurface
        open
        onOpenChange={() => {}}
        titulo="Meta"
        footer={<button type="button">Salvar</button>}
      >
        <p>corpo</p>
      </FormSurface>
    );
    await assentar();
    const dlg =
      document.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    expect(dlg).toBeTruthy();
    // lg é o default — a convenção proíbe cair no md de 448px
    expect(dlg!.className).toContain("sm:max-w-lg");
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
    const footer = document.querySelector<HTMLElement>(
      '[data-slot="dialog-footer"]'
    );
    expect(footer?.className).toContain("sticky");
    expect(footer?.textContent).toContain("Salvar");
    desmontar();
  });

  it("celular: abre Sheet de rodapé com a ação na faixa sticky", async () => {
    viewport(false);
    const { desmontar } = montar(
      <FormSurface
        open
        onOpenChange={() => {}}
        titulo="Meta"
        footer={<button type="button">Salvar</button>}
      >
        <p>corpo</p>
      </FormSurface>
    );
    await assentar();
    const sheet =
      document.querySelector<HTMLElement>('[data-slot="sheet-content"]');
    expect(sheet).toBeTruthy();
    expect(sheet!.className).toContain("bottom-0");
    expect(
      document.querySelector('[data-slot="dialog-content"]')
    ).toBeNull();
    // faixa sticky sangrando o padding do sheet — ação sempre visível
    const faixa = [...sheet!.querySelectorAll<HTMLElement>("div")].find(
      (d) =>
        d.className.includes("sticky") && d.className.includes("bottom-0")
    );
    expect(faixa?.textContent).toContain("Salvar");
    desmontar();
  });

  it("trigger abre a superfície controlada no viewport certo", async () => {
    viewport(true);
    function Arnês() {
      const [open, setOpen] = useState(false);
      return (
        <FormSurface
          open={open}
          onOpenChange={setOpen}
          trigger={<button type="button">Editar dados</button>}
          titulo="T"
        >
          <p>corpo</p>
        </FormSurface>
      );
    }
    const { alvo, desmontar } = montar(<Arnês />);
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    act(() => clicar(botao(alvo, "Editar dados")));
    await assentar();
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeTruthy();
    desmontar();
  });
});

describe("PdmDupla — Nova meta denso e validação honesta", () => {
  async function abrirNovaMeta() {
    const montagem = montar(
      <PdmDupla
        duplaId="d1"
        doc={DOC_VAZIO}
        podeEditar
        mentoradoNome="Ana Beatriz"
      />
    );
    act(() => clicar(botao(montagem.alvo, "Adicionar a primeira meta")));
    await assentar();
    return montagem;
  }

  it("submit sem título: aria-invalid + mensagem inline + foco no campo", async () => {
    viewport(true);
    const { desmontar } = await abrirNovaMeta();
    const form = document.querySelector<HTMLFormElement>("#pdm-item-form")!;
    const campo = document.querySelector<HTMLInputElement>("#pdm-titulo")!;
    expect(form).toBeTruthy();
    expect(campo.hasAttribute("aria-invalid")).toBe(false);

    act(() => submeter(form));
    await assentar();

    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(campo.getAttribute("aria-describedby")).toBe("pdm-titulo-erro");
    expect(document.getElementById("pdm-titulo-erro")?.textContent).toContain(
      "nome pra meta"
    );
    expect(document.activeElement).toBe(campo);
    expect(pdmSalvarItem).not.toHaveBeenCalled();
    desmontar();
  });

  it("o erro limpa ao digitar e o submit preenchido grava pela action", async () => {
    viewport(true);
    const { desmontar } = await abrirNovaMeta();
    const form = document.querySelector<HTMLFormElement>("#pdm-item-form")!;
    const campo = document.querySelector<HTMLInputElement>("#pdm-titulo")!;
    act(() => submeter(form));
    await assentar();
    expect(campo.hasAttribute("aria-invalid")).toBe(true);

    act(() => digitar(campo, "Conseguir um jovem aprendiz"));
    await assentar();
    expect(campo.hasAttribute("aria-invalid")).toBe(false);
    expect(document.getElementById("pdm-titulo-erro")).toBeNull();

    act(() => submeter(form));
    await assentar();
    expect(pdmSalvarItem).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({
        titulo: "Conseguir um jovem aprendiz",
        itemId: null,
        parentId: null,
      })
    );
    desmontar();
  });

  it("no celular a Nova meta vira Sheet de rodapé com o form dentro", async () => {
    viewport(false);
    const { desmontar } = await abrirNovaMeta();
    const sheet =
      document.querySelector<HTMLElement>('[data-slot="sheet-content"]');
    expect(sheet?.querySelector("#pdm-item-form")).toBeTruthy();
    expect(sheet?.textContent).toContain("Adicionar");
    desmontar();
  });
});
