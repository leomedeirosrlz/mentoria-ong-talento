// smoke dos conceitos da Rea — o contrato de rea/tipos.ts diz que os três
// protótipos aceitam as mesmas props (trocar de conceito = trocar o
// import). Aqui se prova que os três renderizam todo ReaEstado sem
// explodir e como svg neutro pra a11y (aria-hidden — o significado vai no
// botão/label de quem hospeda).
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReaBalao } from "../src/components/rea/rea-balao";
import { ReaBlob } from "../src/components/rea/rea-blob";
import { ReaDisco } from "../src/components/rea/rea-disco";
import type { ReaEstado } from "../src/components/rea/tipos";

const ESTADOS: ReaEstado[] = [
  "parado",
  "atento",
  "aberto",
  "consultando",
  "escrevendo",
  "pronto",
  "erro",
  "sonolento",
];

const CONCEITOS = { ReaBalao, ReaBlob, ReaDisco } as const;

describe("rea — contrato dos conceitos", () => {
  for (const [nome, Comp] of Object.entries(CONCEITOS)) {
    it(`${nome}: todo ReaEstado renderiza um svg escondido da a11y`, () => {
      for (const estado of ESTADOS) {
        const html = renderToStaticMarkup(
          createElement(Comp, { estado, tamanho: 44 })
        );
        expect(html, `${nome}/${estado}`).toContain("<svg");
        expect(html, `${nome}/${estado}`).toContain('aria-hidden="true"');
        expect(html, `${nome}/${estado}`).toContain('width="44"');
      }
    });
  }
});
