// smoke dos conceitos da Liza — o contrato de liza/tipos.ts diz que os três
// protótipos aceitam as mesmas props (trocar de conceito = trocar o
// import). Aqui se prova que os três renderizam todo LizaEstado sem
// explodir e como svg neutro pra a11y (aria-hidden — o significado vai no
// botão/label de quem hospeda).
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LizaBalao } from "../src/components/liza/liza-balao";
import { LizaBlob } from "../src/components/liza/liza-blob";
import { LizaDisco } from "../src/components/liza/liza-disco";
import type { LizaEstado } from "../src/components/liza/tipos";

const ESTADOS: LizaEstado[] = [
  "parado",
  "atento",
  "aberto",
  "consultando",
  "escrevendo",
  "pronto",
  "erro",
  "sonolento",
];

const CONCEITOS = { LizaBalao, LizaBlob, LizaDisco } as const;

describe("liza — contrato dos conceitos", () => {
  for (const [nome, Comp] of Object.entries(CONCEITOS)) {
    it(`${nome}: todo LizaEstado renderiza um svg escondido da a11y`, () => {
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
