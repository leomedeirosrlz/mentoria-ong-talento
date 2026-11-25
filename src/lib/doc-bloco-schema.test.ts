import { describe, expect, it } from "vitest";
import {
  docBlocosSchema,
  escapeDocHtml,
  htmlParaTexto,
  parseDocBlocos,
} from "./doc-bloco-schema";

/** A whitelist do documento persistido (020): o que o renderer solta no
 *  dangerouslySetInnerHTML passa antes pelo schema — tag fora da lista ou
 *  href fora dos prefixos derruba o documento inteiro. */

const par = (html: string) => ({ kind: "par", html });

describe("docBlocosSchema — html da whitelist", () => {
  it("aceita os kinds e as tags permitidas", () => {
    const doc = [
      par("Texto com <b>negrito</b>, <i>itálico</i> e <br>quebra."),
      par('<a href="./guia-fichas" class="doc">link interno do corpus</a>'),
      par('<a href="https://realiza.vc">link externo</a>'),
      { kind: "subtitulo", texto: "Ficha do encontro", nivel: 2 },
      { kind: "lista", itens: ["um", "<b>dois</b>"] },
      {
        kind: "callout",
        tom: "tip",
        html: "Do plano de vocês: sugestão seg.",
      },
      { kind: "pergunta", texto: "O que você notou?" },
      {
        kind: "encontro",
        numero: 7,
        titulo: "Sétimo",
        corpo: [par("corpo")],
        tarefa: "tarefa",
        roteiro: { slug: "roteiro-encontro-07" },
      },
    ];
    const r = docBlocosSchema.safeParse(doc);
    expect(r.success).toBe(true);
  });

  it("rejeita tag fora da whitelist (script, img, div)", () => {
    expect(docBlocosSchema.safeParse([par('<script>alert(1)</script>')]).success).toBe(false);
    expect(docBlocosSchema.safeParse([par('<img src=x onerror=y>')]).success).toBe(false);
    expect(docBlocosSchema.safeParse([par('<div>oi</div>')]).success).toBe(false);
  });

  it("rejeita href fora dos prefixos (javascript:, data:)", () => {
    expect(
      docBlocosSchema.safeParse([par('<a href="javascript:alert(1)">x</a>')]).success
    ).toBe(false);
    expect(
      docBlocosSchema.safeParse([par('<a href="data:text/html,x">x</a>')]).success
    ).toBe(false);
  });

  it("rejeita < solto no texto (entidade é o caminho)", () => {
    expect(docBlocosSchema.safeParse([par("a < b")]).success).toBe(false);
    expect(docBlocosSchema.safeParse([par("a &lt; b")]).success).toBe(true);
  });

  it("rejeita kind desconhecido e campos faltando", () => {
    expect(docBlocosSchema.safeParse([{ kind: "video", src: "x" }]).success).toBe(false);
    expect(docBlocosSchema.safeParse([{ kind: "lista", itens: [] }]).success).toBe(false);
  });
});

describe("parseDocBlocos — a fronteira do render", () => {
  it("devolve os blocos válidos e null no documento inválido", () => {
    expect(parseDocBlocos([par("ok")])).toHaveLength(1);
    expect(parseDocBlocos([par('<script>x</script>')])).toBeNull();
    expect(parseDocBlocos("não é array")).toBeNull();
    expect(parseDocBlocos(null)).toBeNull();
  });
});

describe("escapeDocHtml / htmlParaTexto — a ida e volta do editor", () => {
  it("escapa o que viraria tag", () => {
    expect(escapeDocHtml('a <b> & "c"')).toBe("a &lt;b&gt; &amp; &quot;c&quot;");
  });
  it("tira a whitelist e desescapa pro textarea", () => {
    expect(
      htmlParaTexto('<b>oi</b> <a href="./x">link</a><br>linha &lt;2&gt;')
    ).toBe("oi link\nlinha <2>");
  });
});
