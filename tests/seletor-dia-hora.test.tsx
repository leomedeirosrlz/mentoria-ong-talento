// @vitest-environment jsdom

// REALIZA-530 — o SeletorDiaHora virou O jeito de escolher dia+hora:
// sem `sugestoes` cai no modo manual (dois campos nativos sempre visíveis,
// janela civil por `modo`/`piso`/`teto`), com `sugestoes` mostra os chips
// e o "Outro dia" abre o picker nativo; o motivo da remarcação só é
// obrigatório quando o par escolhido difere de `compararCom`; o select
// primário de encontro preenche a data oficial do guia via `dataPorNumero`.
// No jsdom o matchMedia nunca casa → ramo mobile (Sheet em portal, então
// as queries rolam no document, não no `alvo` do montar).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/actions", () => ({
  agendarEncontroJovem: vi.fn(async () => ({ ok: true })),
  conflitoEncontro: vi.fn(async () => ({ conflitos: [] })),
}));
vi.mock("@/lib/actions-jovem", () => ({
  registrarRetroativoJovem: vi.fn(async () => ({ ok: true })),
}));

import {
  SeletorDiaHora,
  ddmm,
  fimDe,
  type SeletorSugestoes,
} from "@/components/seletor-dia-hora";
import { JovemAgendarDialog } from "@/components/jovem-agendar-dialog";
import { JovemRetroativoDialog } from "@/components/jovem-retroativo-dialog";
import { perfilDeEncontros } from "@/lib/sugestoes-encontro";
import { assentar, botao, clicar, clicarItem, digitar, esperar, montar } from "./dom";

const ler = (p: string) =>
  readFileSync(resolve(process.cwd(), p), "utf8");

const HOJE = "2026-11-21"; // sábado — a janela civil dos testes é fixa

const base = {
  aberto: true,
  onAberto: () => {},
  numero: 6,
  pending: false,
  aviso: null as string | null,
  onAviso: () => {},
  hoje: HOJE,
};

const SUGESTOES: SeletorSugestoes = {
  datas: [
    { data: "2026-11-25", origem: "padrao", peso: 1 },
    { data: "2026-11-27", origem: "padrao", peso: 1 },
  ],
  perfil: perfilDeEncontros([], new Date(`${HOJE}T12:00:00-03:00`)),
  disponibilidade: null,
  ocupados: [],
  duracaoMin: 60,
  hoje: HOJE,
  janela: null,
};

const campoDia = () =>
  document.querySelector<HTMLInputElement>('input[type="date"]')!;
const campoHora = () =>
  document.querySelector<HTMLInputElement>('input[type="time"]')!;

/** Abre o select do Base UI e commita o item pelo texto — o gesto de
 *  mouse completo mora no `clicarItem` do harness. */
async function escolherNoSelect(trigger: HTMLElement, texto: string) {
  act(() => clicar(trigger));
  await esperar();
  const item = [...document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')].find(
    (i) => i.textContent?.includes(texto)
  );
  if (!item) throw new Error(`item "${texto}" não achado no select`);
  act(() => clicarItem(item));
  await esperar();
}

describe("helpers de rótulo", () => {
  it("ddmm corta a data civil; fimDe soma a duração na faixa", () => {
    expect(ddmm("2026-12-01")).toBe("01/12");
    expect(fimDe("19:00", 60)).toBe("20:00");
    expect(fimDe("23:30", 60)).toBe("00:30");
  });
});

describe("modo manual (sem sugestoes)", () => {
  it("mostra os campos de dia e horário direto, sem chips", async () => {
    const { desmontar } = montar(
      <SeletorDiaHora {...base} onConfirmar={vi.fn()} />
    );
    await assentar();
    // os dois campos nativos nascem montados — nada de chip/radiogroup
    expect(campoDia()).not.toBeNull();
    expect(campoHora()).not.toBeNull();
    expect(campoDia().getAttribute("aria-label")).toBe("Escolher outro dia");
    expect(campoHora().getAttribute("aria-label")).toBe(
      "Escolher outro horário"
    );
    expect(document.querySelector('[role="radiogroup"]')).toBeNull();
    desmontar();
  });

  it("confirma só com os dois campos preenchidos", async () => {
    const { desmontar } = montar(
      <SeletorDiaHora {...base} onConfirmar={vi.fn()} />
    );
    await assentar();
    const confirmar = botao(document.body, "Confirmar agendamento");
    expect(confirmar.disabled).toBe(true);
    // horário sozinho não libera — a data segue vazia
    act(() => digitar(campoHora(), "19:00"));
    await assentar();
    expect(confirmar.disabled).toBe(true);
    // a data preenche o par — e a hora vazia cai em 19:00, o horário típico
    act(() => digitar(campoDia(), "2026-12-01"));
    await assentar();
    expect(campoHora().value).toBe("19:00");
    expect(confirmar.disabled).toBe(false);
    // limpar a hora volta a bloquear — os dois são obrigatórios
    act(() => digitar(campoHora(), ""));
    await assentar();
    expect(confirmar.disabled).toBe(true);
    desmontar();
  });

  it("janela civil: min = amanhã no futuro; piso/teto explícitos ganham", async () => {
    const { desmontar, atualizar } = montar(
      <SeletorDiaHora {...base} onConfirmar={vi.fn()} />
    );
    await assentar();
    // futuro sem piso: o "Outro dia" não aceita hoje nem passado
    expect(campoDia().min).toBe("2026-11-22");
    expect(campoDia().max).toBe("");
    atualizar(
      <SeletorDiaHora
        {...base}
        piso="2026-11-25"
        teto="2026-12-31"
        onConfirmar={vi.fn()}
      />
    );
    await assentar();
    expect(campoDia().min).toBe("2026-11-25");
    expect(campoDia().max).toBe("2026-12-31");
    // piso="" pede "sem borda" — o agendar dual aceita passado (retroativo)
    atualizar(<SeletorDiaHora {...base} piso="" onConfirmar={vi.fn()} />);
    await assentar();
    expect(campoDia().min).toBe("");
    desmontar();
  });

  it("resumo do rodapé acompanha o par escolhido e espelha via onMudanca", async () => {
    const mudanca = vi.fn();
    const { desmontar } = montar(
      <SeletorDiaHora {...base} onMudanca={mudanca} onConfirmar={vi.fn()} />
    );
    await assentar();
    const resumo = () =>
      document.querySelector('[aria-live="polite"]')!.textContent;
    expect(resumo()).toBe("6º encontro · escolha dia e horário");
    act(() => digitar(campoDia(), "2026-12-01"));
    await assentar();
    expect(resumo()).toBe("6º encontro · ter 01/12 · 19:00");
    expect(mudanca).toHaveBeenLastCalledWith({
      data: "2026-12-01",
      hora: "19:00",
      numero: 6,
    });
    desmontar();
  });
});

describe("modo retroativo", () => {
  it("limita o dia a hoje pra trás e `inicial` pré-preenche o par", async () => {
    const { desmontar } = montar(
      <SeletorDiaHora
        {...base}
        modo="retroativo"
        rotuloDia="Quando foi"
        inicial={{ data: "2026-11-19", hora: "18:45" }}
        onConfirmar={vi.fn()}
      />
    );
    await assentar();
    expect(document.body.textContent).toContain("Quando foi");
    expect(campoDia().getAttribute("aria-label")).toBe("Dia em que aconteceu");
    expect(campoHora().getAttribute("aria-label")).toBe(
      "Horário em que aconteceu"
    );
    expect(campoDia().max).toBe(HOJE);
    expect(campoDia().min).toBe(""); // retroativo não tem piso por padrão
    expect(campoDia().value).toBe("2026-11-19");
    expect(campoHora().value).toBe("18:45");
    // o par completo já libera o confirmar na abertura (correção de data)
    expect(botao(document.body, "Confirmar").disabled).toBe(false);
    desmontar();
  });

  it("`teto` explícito ganha do hoje no max", async () => {
    const { desmontar } = montar(
      <SeletorDiaHora
        {...base}
        modo="retroativo"
        teto="2026-11-10"
        onConfirmar={vi.fn()}
      />
    );
    await assentar();
    expect(campoDia().max).toBe("2026-11-10");
    desmontar();
  });
});

describe("motivo da remarcação (pedeMotivo + compararCom)", () => {
  const props = {
    ...base,
    pedeMotivo: true,
    compararCom: { data: "2026-11-30", hora: "19:00" },
    inicial: { data: "2026-11-30", hora: "19:00" },
  };

  it("mesmo par: motivo opcional ('Só precisa se mudar a data'), confirmar livre", async () => {
    const confirmar = vi.fn();
    const { desmontar } = montar(
      <SeletorDiaHora {...props} onConfirmar={confirmar} />
    );
    await assentar();
    expect(document.querySelector("#motivo-select")).not.toBeNull();
    expect(document.body.textContent).toContain(
      "Só precisa se mudar a data."
    );
    const btn = botao(document.body, "Confirmar");
    expect(btn.disabled).toBe(false);
    // mesma data: confirmar sai sem motivo — a RPC não cobra
    act(() => clicar(btn));
    await assentar();
    expect(confirmar).toHaveBeenCalledWith("2026-11-30", "19:00", 6, null);
    desmontar();
  });

  it("data nova bloqueia o confirmar até escolher o motivo", async () => {
    const confirmar = vi.fn();
    const { desmontar } = montar(
      <SeletorDiaHora {...props} onConfirmar={confirmar} />
    );
    await assentar();
    act(() => digitar(campoDia(), "2026-12-02"));
    await assentar();
    // o par mudou → o aviso de "opcional" some e o motivo vira obrigatório
    expect(document.body.textContent).not.toContain(
      "Só precisa se mudar a data."
    );
    const btn = botao(document.body, "Confirmar");
    expect(btn.disabled).toBe(true);
    await escolherNoSelect(
      document.querySelector<HTMLElement>("#motivo-select")!,
      "Conflito de agenda"
    );
    expect(btn.disabled).toBe(false);
    act(() => clicar(btn));
    await assentar();
    // o caller recebe o preset cru — cada superfície resolve label/texto
    expect(confirmar).toHaveBeenCalledWith("2026-12-02", "19:00", 6, {
      preset: "conflito",
      outro: "",
    });
    desmontar();
  });

  it("'Outro motivo' exige o texto livre (2+ chars) pra confirmar", async () => {
    const confirmar = vi.fn();
    const { desmontar } = montar(
      <SeletorDiaHora {...props} onConfirmar={confirmar} />
    );
    await assentar();
    act(() => digitar(campoDia(), "2026-12-02"));
    await assentar();
    await escolherNoSelect(
      document.querySelector<HTMLElement>("#motivo-select")!,
      "Outro motivo"
    );
    const livre = document.querySelector<HTMLInputElement>("#motivo_outro")!;
    expect(livre).not.toBeNull();
    const btn = botao(document.body, "Confirmar");
    // preset "outro" com texto vazio/curto não libera
    expect(btn.disabled).toBe(true);
    act(() => digitar(livre, "x"));
    await assentar();
    expect(btn.disabled).toBe(true);
    act(() => digitar(livre, "prova na escola"));
    await assentar();
    expect(btn.disabled).toBe(false);
    act(() => clicar(btn));
    await assentar();
    expect(confirmar).toHaveBeenCalledWith("2026-12-02", "19:00", 6, {
      preset: "outro",
      outro: "prova na escola",
    });
    desmontar();
  });
});

describe("select primário de encontro (encontroPrimario)", () => {
  it("mostra o select rotulado e `dataPorNumero` preenche o par do guia", async () => {
    const confirmar = vi.fn();
    const { desmontar } = montar(
      <SeletorDiaHora
        {...base}
        modo="retroativo"
        numeros={[3, 4]}
        encontroPrimario
        idEncontro="retro-numero-select"
        rotuloEncontro="Qual encontro foi"
        rotuloNumero={(n) => `${n}º encontro`}
        dataPorNumero={(n) =>
          n === 4 ? { data: "2026-11-18", hora: "18:30" } : null
        }
        onConfirmar={confirmar}
      />
    );
    await assentar();
    // o select abre no topo com o rótulo ligando o trigger
    const trigger =
      document.querySelector<HTMLElement>("#retro-numero-select")!;
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute("aria-labelledby")).toContain(
      "rotulo-encontro"
    );
    expect(document.querySelector("#rotulo-encontro")?.textContent).toBe(
      "Qual encontro foi"
    );
    // trocar o encontro puxa a data oficial do guia (data+hora explícitas)
    await escolherNoSelect(trigger, "4º encontro");
    expect(campoDia().value).toBe("2026-11-18");
    expect(campoHora().value).toBe("18:30");
    act(() => clicar(botao(document.body, "Confirmar")));
    await assentar();
    expect(confirmar).toHaveBeenCalledWith("2026-11-18", "18:30", 4, null);
    desmontar();
  });
});

describe("chips com sugestoes — 'Outro dia' abre o picker nativo", () => {
  it("clique no chip mostra o campo e chama showPicker uma vez", async () => {
    const spy = vi.fn();
    // jsdom não tem showPicker: definido no teste, o código chama ele
    // (typeof === "function") em vez do fallback de foco
    (HTMLInputElement.prototype as unknown as Record<string, unknown>).showPicker = spy;
    const { desmontar } = montar(
      <SeletorDiaHora
        {...base}
        sugestoes={SUGESTOES}
        inicial={{ data: "2026-11-25", hora: "19:00", origem: "padrao" }}
        onConfirmar={vi.fn()}
      />
    );
    try {
      await assentar();
      // com `inicial` num chip, o campo de data nasce fora de cena
      expect(document.querySelector('input[type="date"]')).toBeNull();
      act(() => clicar(botao(document.body, "Outro dia")));
      await esperar();
      const dia = campoDia();
      expect(dia).not.toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
      // o campo não abre vazio: o valor já digitado (o `inicial`) volta a valer
      expect(dia.value).toBe("2026-11-25");
    } finally {
      delete (HTMLInputElement.prototype as unknown as Record<string, unknown>)
        .showPicker;
      desmontar();
    }
  });

  it("sem showPicker o fallback é o foco no campo", async () => {
    const { desmontar } = montar(
      <SeletorDiaHora
        {...base}
        sugestoes={SUGESTOES}
        inicial={{ data: "2026-11-25", hora: "19:00", origem: "padrao" }}
        onConfirmar={vi.fn()}
      />
    );
    await assentar();
    act(() => clicar(botao(document.body, "Outro dia")));
    await esperar();
    // sem showPicker o rAF cai no focus() — o gesto não se perde
    expect(document.activeElement).toBe(campoDia());
    desmontar();
  });
});

describe("dialogs que embrulham o seletor", () => {
  it("JovemAgendarDialog: select 'Qual encontro?' (#numero-select) preenche a data", async () => {
    const { alvo, desmontar } = montar(
      <JovemAgendarDialog
        duplaId="d1"
        atual={null}
        numeros={[
          { numero: 3 },
          { numero: 4, data: "2026-11-19" },
        ]}
      />
    );
    act(() => clicar(botao(alvo, "Agendar encontro")));
    await assentar();
    const trigger = document.querySelector<HTMLElement>("#numero-select");
    expect(trigger).not.toBeNull();
    expect(document.querySelector("#rotulo-encontro")?.textContent).toBe(
      "Qual encontro?"
    );
    await escolherNoSelect(trigger!, "4º encontro");
    // a data oficial do guia entra no campo — a hora cai em 19:00
    expect(campoDia().value).toBe("2026-11-19");
    expect(campoHora().value).toBe("19:00");
    // o link da chamada mora no slot children do seletor
    expect(document.querySelector<HTMLInputElement>("#link")).not.toBeNull();
    desmontar();
  });

  it("JovemRetroativoDialog sem elegível: dialog pequeno com a fronteira explicada", async () => {
    const { alvo, desmontar } = montar(
      <JovemRetroativoDialog duplaId="d1" numeros={[]} />
    );
    act(() => clicar(botao(alvo, "Registrar encontro")));
    await assentar();
    const dlg = document.querySelector('[role="dialog"]');
    expect(dlg?.textContent).toContain(
      "Todos os encontros do guia que já venceram estão na sua agenda."
    );
    expect(dlg?.textContent).toContain("Esse quem registra é o seu mentor");
    desmontar();
  });
});

describe("guarda de fonte — os 4 dialogs largaram o datetime-local", () => {
  it("nenhum dialog nem o seletor voltam pro campo combinado", () => {
    for (const p of [
      "src/components/seletor-dia-hora.tsx",
      "src/components/agendar-encontro-dialog.tsx",
      "src/components/jovem-agendar-dialog.tsx",
      "src/components/jovem-retroativo-dialog.tsx",
      "src/components/registrar-retroativo-dialog.tsx",
    ]) {
      // o padrão proibido é o atributo — comentários que citam a regra
      // ("nunca datetime-local") são legítimos
      expect(ler(p), p).not.toMatch(/type="datetime-local"/);
    }
  });
});
