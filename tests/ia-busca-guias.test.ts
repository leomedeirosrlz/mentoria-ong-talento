// Regras puras da busca nos guias (lib/ia/busca-guias.ts): a moldura
// "o que o guia diz" sai do braço FTS (o lexema "gui" casava no slug de
// todo chunk dos guias) e os candidatos viram seções únicas.

import { describe, expect, it } from "vitest";
import { perguntaFts, topSecoes } from "@/lib/ia/busca-guias";

describe("perguntaFts", () => {
  it("tira a moldura da pergunta e mantém o assunto", () => {
    expect(perguntaFts("O que diz o guia sobre a Roda da Vida?")).toBe(
      "O que o sobre a Roda da Vida?"
    );
    expect(perguntaFts("o que os guias dizem de remarcar encontro")).toBe(
      "o que os de remarcar encontro"
    );
  });

  it("não mexe em palavra que só contém a moldura", () => {
    expect(perguntaFts("guiar o jovem na fala em público")).toBe(
      "guiar o jovem na fala em público"
    );
  });

  it("devolve a original quando não sobra termo", () => {
    expect(perguntaFts("guia")).toBe("guia");
    expect(perguntaFts("o guia diz")).toBe("o guia diz");
  });
});

describe("topSecoes", () => {
  it("fica com a primeira ocorrência de cada guia|seção, na ordem do ranking", () => {
    const f = (guia: string, secao: string | null, n: number) => ({ guia, secao, n });
    const top = topSecoes([
      f("guia-mentor-dpp", "10 · Os 16 encontros", 1),
      f("guia-mentor-dpp", "10 · Os 16 encontros", 2),
      f("roteiro-encontro-12", "12º encontro · Durante o encontro", 3),
      f("guia-mentor-dpp", "10 · Os 16 encontros › 1º encontro", 4),
      f("instrumento-roda-da-vida", null, 5),
      f("instrumento-roda-da-vida", null, 6),
      f("mensagem-preparacao", "Modelo", 7),
    ]);
    expect(top.map((x) => x.n)).toEqual([1, 3, 4, 5]);
  });
});
