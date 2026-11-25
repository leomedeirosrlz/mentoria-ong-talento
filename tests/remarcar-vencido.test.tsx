// @vitest-environment jsdom

// REALIZA-507 — R9: remarcar um encontro já vencido não pode abrir com o
// valor velho abaixo do min (o input nascia inválido e a action recusa o
// passado de qualquer jeito). Os dois dialogs — staff e jovem — abrem
// vazio pedindo a data nova e o min cobre "hoje" (o guard "sempre pra
// frente" no confirmar segura a hora já passada do próprio dia). No 530
// o par datetime-local virou os dois campos nativos do SeletorDiaHora —
// a asserção é no `input[type="date"]` do sheet.

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/actions", () => ({
  agendarEncontro: vi.fn(async () => ({ ok: true })),
  agendarEncontroJovem: vi.fn(async () => ({ ok: true })),
  conflitoEncontro: vi.fn(async () => ({ conflitos: [] })),
  desmarcarEncontro: vi.fn(async () => ({ ok: true })),
  disponibilidadesDaDupla: vi.fn(async () => ({
    mentor: null,
    jovem: null,
    jovemNome: null,
  })),
  registrarEncontroRetroativo: vi.fn(async () => ({ ok: true })),
}));

import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { JovemAgendarDialog } from "@/components/jovem-agendar-dialog";
import { toDateStr } from "@/lib/ciclo";
import type { Encontro } from "@/lib/types";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { assentar, botao, clicar, digitar, montar } from "./dom";

// uma semana atrás / daqui a uma semana — âncoras independentes do relógio
const VENCIDO_ISO = new Date(Date.now() - 7 * 86_400_000).toISOString();
const DIA = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const FUTURO_DIA = DIA(new Date(Date.now() + 7 * 86_400_000));
const PASSADO_DIA = DIA(new Date(Date.now() - 7 * 86_400_000));
const HOJE_DIA = toDateStr(new Date());

const ENCONTRO_VENCIDO: Encontro = {
  id: "e1",
  dupla_id: "d1",
  numero: 3,
  data_hora: VENCIDO_ISO,
  realizado_em: null,
  duracao_min: 60,
  status: "agendado",
  origem: "plataforma",
  link: null,
  motivo_reagendamento: null,
};

const JOVEM_VENCIDO: JovemEncontro = {
  id: "e1",
  dupla_id: "d1",
  numero: 3,
  data_hora: VENCIDO_ISO,
  realizado_em: null,
  duracao_min: 60,
  status: "agendado",
  link: null,
  motivo_reagendamento: null,
};

const campoData = () =>
  document.querySelector<HTMLInputElement>('input[type="date"]')!;

describe("dialog do staff (507)", () => {
  it("remarcar o vencido abre sem valor inválido e com min = hoje", async () => {
    const { desmontar } = montar(
      <AgendarEncontroDialog
        duplaId="d1"
        numero={3}
        atual={ENCONTRO_VENCIDO}
        open
        onOpenChange={() => {}}
        trigger={null}
      />
    );
    await assentar();
    const input = campoData();
    // antes do 507 o campo nascia com a data vencida — abaixo do min
    expect(input.value).toBe("");
    // o piso civil é hoje: carimbo fresco, não a data velha do encontro —
    // a hora de hoje já passada o confirmar barra ("sempre pra frente")
    expect(input.min).toBe(HOJE_DIA);
    // a linha de contexto devolve a data original e pede a nova
    expect(document.body.textContent).toContain("Estava marcado pra");
    expect(document.body.textContent).toContain("Escolha a nova data");
    desmontar();
  });

  it("data passada não passa pela validação nativa; futura passa", async () => {
    const { desmontar } = montar(
      <AgendarEncontroDialog
        duplaId="d1"
        numero={3}
        atual={ENCONTRO_VENCIDO}
        open
        onOpenChange={() => {}}
        trigger={null}
      />
    );
    await assentar();
    const input = campoData();
    act(() => digitar(input, PASSADO_DIA));
    expect(input.checkValidity()).toBe(false);
    act(() => digitar(input, FUTURO_DIA));
    expect(input.checkValidity()).toBe(true);
    desmontar();
  });
});

describe("dialog do jovem (507)", () => {
  it("remarcar o vencido abre pedindo a nova data, sem valor inválido", async () => {
    const { alvo, desmontar } = montar(
      <JovemAgendarDialog duplaId="d1" numero={3} atual={JOVEM_VENCIDO} />
    );
    act(() => clicar(botao(alvo, "Remarcar")));
    await assentar();
    const input = campoData();
    expect(input.value).toBe("");
    expect(input.min).toBe(HOJE_DIA);
    expect(document.body.textContent).toContain("Estava marcado pra");
    expect(document.body.textContent).toContain("Escolha a nova data");
    desmontar();
  });

  it("data passada não passa pela validação nativa; futura passa", async () => {
    const { alvo, desmontar } = montar(
      <JovemAgendarDialog duplaId="d1" numero={3} atual={JOVEM_VENCIDO} />
    );
    act(() => clicar(botao(alvo, "Remarcar")));
    await assentar();
    const input = campoData();
    act(() => digitar(input, PASSADO_DIA));
    expect(input.checkValidity()).toBe(false);
    act(() => digitar(input, FUTURO_DIA));
    expect(input.checkValidity()).toBe(true);
    desmontar();
  });
});
