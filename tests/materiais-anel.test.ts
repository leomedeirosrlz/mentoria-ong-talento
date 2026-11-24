// 022 (US1) — regressão do anel do card-estante de /jovem/materiais.
// O defeito era de ordem de pintura: ring-inset é sombra interna, sai
// ABAIXO dos filhos opacos (a capa bg-[var(--ict)] e a lombada cobriam o
// contorno) — o anel "abraçava uma div interna". O padrão local virou
// outline com offset negativo, que pinta por cima dos filhos e segue o
// radius. InstrumentoCard e MaterialCard são funções privadas do page
// server component, então o assert é de fonte, escopado por bloco: os
// três pontos do padrão (shell do gesto, tira "Ler o guia", âncora do
// MaterialCard) carregam outline e nenhum volta a ring-inset.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  path.join(process.cwd(), "src/app/(jovem)/jovem/materiais/page.tsx"),
  "utf8"
);

/** Recorta o trecho entre dois marcadores — o assert fica escopado ao
 *  bloco, não ao arquivo inteiro (o ring-inset segue legítimo em outras
 *  superfícies, como o <summary> do "Mais adiante"). */
function bloco(inicio: string, fim: string): string {
  const i = SRC.indexOf(inicio);
  const j = i < 0 ? -1 : SRC.indexOf(fim, i + inicio.length);
  if (i < 0 || j < 0)
    throw new Error(`trecho não achado: "${inicio}" ~ "${fim}"`);
  return SRC.slice(i, j + fim.length);
}

describe("anel do card-estante (022/US1)", () => {
  it("o shell do card de instrumento usa outline sobre os filhos", () => {
    const shell = bloco("const shell = cn(", ");");
    expect(shell).not.toContain("ring-inset");
    expect(shell).not.toContain("transition-shadow");
    // mesmo desenho de ~2px, mas pintado por cima de capa e lombada
    expect(shell).toContain("hover:outline-2");
    expect(shell).toContain("hover:-outline-offset-2");
    expect(shell).toContain("has-[.gesto:focus-visible]:outline-2");
    expect(shell).toContain("has-[.gesto:focus-visible]:-outline-offset-2");
    // hover na cor do instrumento, foco na cor de foco do sistema
    expect(shell).toContain("hover:outline-[var(--ic)]/50");
    expect(shell).toContain("has-[.gesto:focus-visible]:outline-ring");
  });

  it("a tira 'Ler o guia' é alvo de foco separado com outline próprio", () => {
    const guia = bloco("const guia = guiaHref", ") : null;");
    expect(guia).not.toContain("ring-inset");
    expect(guia).toContain("focus-visible:outline-2");
    expect(guia).toContain("focus-visible:-outline-offset-2");
    expect(guia).toContain("focus-visible:outline-ring");
    // alvo próprio (Link com href real), não zona do gesto principal
    expect(guia).toContain("href={guiaHref}");
  });

  it("o conteúdo do gesto não carrega a tira — alvos seguem irmãos", () => {
    const conteudo = bloco("const conteudo = (", ");");
    expect(conteudo).not.toContain("{guia}");
    // {guia} entra como irmão do gesto nas 3 variantes do card
    expect(SRC.match(/\{guia\}/g)).toHaveLength(3);
  });

  it("a âncora do MaterialCard troca ring-inset por outline", () => {
    const ancora = bloco('href={href}', "{capa}");
    expect(ancora).not.toContain("ring-inset");
    expect(ancora).toContain("focus-visible:outline-2");
    expect(ancora).toContain("focus-visible:-outline-offset-2");
    expect(ancora).toContain("focus-visible:outline-ring");
  });
});
