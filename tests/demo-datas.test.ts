import { describe, expect, it } from "vitest";
import { getDemoData } from "../src/lib/demo/data";
import {
  cobertosDaDupla,
  semanaBounds,
  toDateStr,
} from "../src/lib/ciclo";

// Âncoras do dataset evergreen — a invariante é "hoje" e a semana corrente
// no fuso do PROGRAMA (America/Sao_Paulo), não no fuso da máquina. Rode com
// TZ=Pacific/Kiritimati pra reproduzir o drift que esta guarda cobre:
// meio-dia local em UTC+14 cai no dia anterior em SP.

const dowDaData = (iso: string): number =>
  new Date(`${iso}T12:00:00Z`).getUTCDay();

describe("datas do dataset demo", () => {
  const data = getDemoData();
  const hojeSP = toDateStr(new Date());
  const { seg, dom } = semanaBounds(new Date());

  it("o 5º encontro da T1 cai na terça da semana corrente (seg–dom)", () => {
    // Âncora do cronograma T1: a terça DESTA semana ISO — de quarta a
    // domingo ela já passou (o encontro recente fica vencido, a coluna
    // "semana" do panorama acende e a T2 empilha: o 1º enc. dela é esta
    // mesma terça); seg/ter ainda está por vir. A âncora anterior mirava
    // a próxima terça e deixava a semana sem célula "a acontecer".
    const ev5 = data.cicloEventos.find(
      (e) =>
        e.tipo === "encontro" &&
        e.numero === 5 &&
        e.data != null &&
        e.cronograma_id === data.cronogramas[0]?.id
    );
    expect(ev5).toBeDefined();
    expect(dowDaData(ev5!.data!)).toBe(2); // terça
    expect(ev5!.data! >= seg && ev5!.data! <= dom).toBe(true);
  });

  it("as exceções ancoradas em HOJE caem dentro da semana corrente", () => {
    const ancoradas = data.especialistaExcecoes.filter((x) =>
      ["07:00", "12:00"].includes(x.hora_inicio.slice(0, 5))
    );
    expect(ancoradas.length).toBeGreaterThanOrEqual(2);
    for (const x of ancoradas) {
      expect(x.data).toBe(hojeSP);
      expect(x.data >= seg && x.data <= dom).toBe(true);
    }
  });

  it("todas as datas do dataset são YYYY-MM-DD válidas no calendário SP", () => {
    for (const x of data.especialistaExcecoes)
      expect(x.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const ev of data.cicloEventos)
      if (ev.data != null) expect(ev.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("passo aplicado do plano bate com a row do encontro (R6)", () => {
    // A 0219 aplica os dois lados juntos: dupla_plano_passos.encontro_id
    // aponta a row e data_nova === data_hora dela (com data_anterior sendo
    // o instante anterior e motivo quando a data mudou). O fixture antigo
    // tinha o passo aplicado e a row na data oficial — estado impossível.
    for (const d of data.duplas) {
      for (const plano of d.planos ?? []) {
        for (const passo of plano.passos ?? []) {
          if (passo.encontro_id == null) continue;
          const enc = d.encontros.find((e) => e.id === passo.encontro_id);
          expect(
            enc,
            `passo ${passo.numero} do plano ${plano.id} aponta encontro inexistente`
          ).toBeDefined();
          expect(passo.data_nova).toBe(enc!.data_hora);
          if (passo.data_anterior != null) {
            expect(passo.data_anterior).not.toBe(passo.data_nova);
            // a RPC exige motivo quando uma row existente muda de data
            expect(passo.motivo?.trim().length ?? 0).toBeGreaterThanOrEqual(2);
            // e o trigger carimba a remarcação no ledger do encontro
            expect(
              enc!.remarcacoes?.some(
                (r) =>
                  r.data_anterior === passo.data_anterior &&
                  r.data_nova === passo.data_nova
              )
            ).toBe(true);
          }
        }
      }
    }
  });

  it("nenhuma dupla tem dois agendados no mesmo instante (R6)", () => {
    // Dois encontros agendados na mesma hora é a encavalação que o apply
    // do plano produzia quando a row ficava na data oficial.
    for (const d of data.duplas) {
      const vistos = new Set<string>();
      for (const e of d.encontros) {
        if (e.status !== "agendado" || e.data_hora == null) continue;
        expect(
          vistos.has(e.data_hora),
          `dupla ${d.id} encavala dois agendados em ${e.data_hora}`
        ).toBe(false);
        vistos.add(e.data_hora);
      }
    }
  });

  it("sessão combinada (018): o dataset espelha o que o salvarRegistro grava", () => {
    // A d-fim guarda o par 5/6 — a invariante vale pra QUALQUER sessão
    // que o dataset venha a ganhar, então a guarda corre sobre tudo:
    // coberto sem registro/link próprios, mesmo sessao_id e mesmo
    // instante da âncora, e a avaliação cobrindo o grupo inteiro.
    for (const d of data.duplas) {
      const cobertos = cobertosDaDupla(d.encontros);
      for (const [nCoberto, nAncora] of cobertos) {
        const ancora = d.encontros.find((e) => e.numero === nAncora)!;
        const enc = d.encontros.find((e) => e.numero === nCoberto)!;
        expect(
          ancora.registro?.cobertura,
          `âncora ${nAncora} da dupla ${d.id} lista ${nCoberto}`
        ).toContain(nCoberto);
        expect(
          enc.registro,
          `coberto ${nCoberto} da dupla ${d.id} tem registro próprio`
        ).toBeNull();
        expect(enc.sessao_id, "sessao_id do coberto").toBe(
          ancora.sessao_id
        );
        expect(enc.sessao_id).toBeTruthy();
        expect(enc.status).toBe("realizado");
        expect(enc.data_hora).toBe(ancora.data_hora);
        // link e resposta são UM por sessão, na âncora, cobrindo o grupo
        const linkAnc = data.avaliacaoLinks.find(
          (l) => l.encontro_id === ancora.id
        );
        expect(linkAnc?.cobertura).toContain(nAncora);
        expect(linkAnc?.cobertura).toContain(nCoberto);
        expect(
          data.avaliacaoLinks.some((l) => l.encontro_id === enc.id),
          `coberto ${nCoberto} mintou link próprio`
        ).toBe(false);
        const avalAnc = data.avaliacoes.find(
          (a) => a.encontro_id === ancora.id
        );
        expect(avalAnc?.cobertura).toContain(nAncora);
        expect(avalAnc?.cobertura).toContain(nCoberto);
        expect(
          data.avaliacoes.some((a) => a.encontro_id === enc.id),
          `coberto ${nCoberto} tem avaliação própria`
        ).toBe(false);
      }
    }
    // a história âncora existe de fato: a d-fim tem o par 5/6 coberto
    const fim = data.duplas.find((d) => d.id.endsWith("1541"))!;
    expect(fim).toBeDefined();
    expect(cobertosDaDupla(fim.encontros).get(6)).toBe(5);
  });
});
