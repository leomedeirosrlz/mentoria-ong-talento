// Guarda de fonte da "superfície única por viewport" (spec 022 — US5/US6,
// FR-009/010): form denso (3+ campos ou select com 8+ itens) nunca abre
// no `md` de 448px — desktop recebe Dialog `lg`+ e o celular recebe
// Sheet de rodapé com a ação presa no pé. O invariante é de código (o
// padrão proibido é o `<DialogContent>` curto no form denso), então a
// guarda lê a fonte em vez de montar a árvore — roda em node puro.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (p: string) => readFileSync(resolve(RAIZ, p), "utf8");

/** Fatia de `function Nome(` até a próxima função em coluna 0 — delimita
 *  o corpo de um dialog sem contar chaves. Função aninhada é indentada,
 *  então `\nfunction` só aparece na fronteira top-level. */
function bloco(fonte: string, nome: string): string {
  const inicio = fonte.indexOf(`function ${nome}(`);
  if (inicio < 0) throw new Error(`função ${nome} não achada na fonte`);
  const resto = fonte.slice(inicio);
  const prox = resto.search(/\n(?:export )?function /);
  return prox < 0 ? resto : resto.slice(0, prox);
}

const DENSA_NUNCA_MD = /DialogContent[^>]*size="(md|sm)"/;

describe("superfície única por viewport (spec 022)", () => {
  it("FormSurface decide Dialog-vs-Sheet e só aceita largura lg+", () => {
    const src = ler("src/components/form-surface.tsx");
    expect(src).toContain("useDesktop");
    expect(src).toContain("<DialogContent");
    expect(src).toContain('side="bottom"');
    // a união de tamanhos exclui sm/md de propósito — o respiro do form
    // denso é obrigatório, não opcional (Dialog sm/md literal não existe
    // na superfície: confirmação e campo único não passam por ela)
    expect(src).not.toMatch(/"(sm|md)"/);
    // no mobile a ação fica presa no pé da área rolante — não some na
    // dobra nem atrás do teclado
    expect(src).toContain("sticky bottom-0");
  });

  it("pdm-dupla: meta/submeta abre em FormSurface; visão e exclusão seguem Dialog puro", () => {
    const src = ler("src/components/pdm-dupla.tsx");
    const item = bloco(src, "ItemDialog");
    expect(item).toContain("<FormSurface");
    expect(item).not.toContain("<DialogContent");
    // o <form> mora no corpo e o submit do rodapé associa via `form`
    expect(item).toContain('id="pdm-item-form"');
    // 16 áreas de vida (FR-011): o popup ancora junto ao trigger em vez
    // de alinhar o item marcado por cima da superfície
    expect(item).toContain("alignItemWithTrigger={false}");
    // os 3 DialogContent que sobram são os permitidos: visão (1
    // textarea), confirmação de exclusão e leitura da resposta de origem —
    // nenhum form denso, nenhum size proibido
    expect(src.match(/<DialogContent/g)).toHaveLength(3);
    expect(bloco(src, "VisaoDialog")).toContain("<DialogContent>");
    expect(bloco(src, "ExcluirDialog")).toContain("<DialogContent>");
    expect(src).not.toMatch(DENSA_NUNCA_MD);
  });

  it("cronograma-editor: dados do cronograma abrem em FormSurface; só a confirmação usa DialogContent", () => {
    const src = ler("src/components/cronograma-editor.tsx");
    const acoes = bloco(src, "CronogramaAcoes");
    expect(acoes).toContain("<FormSurface");
    expect(acoes).toContain('id="cg-dados-form"');
    expect(acoes).not.toContain("<DialogContent");
    // a única DialogContent do arquivo é a confirmação destrutiva — `sm`
    // é largura de aviso com 1–2 linhas, não de form (permitido)
    expect(src.match(/<DialogContent/g)).toHaveLength(1);
    expect(src).toContain('<DialogContent size="sm">');
  });

  it("terceiros-dupla: os 3 dialogs viraram FormSurface — resposta é o único xl", () => {
    const src = ler("src/app/(app)/duplas/[id]/terceiros-dupla.tsx");
    for (const fn of [
      "EditarContatoDialog",
      "RegistrarRespostaDialog",
      "NovoContatoDialog",
    ]) {
      const b = bloco(src, fn);
      expect(b, fn).toContain("<FormSurface");
      expect(b, fn).not.toContain("<DialogContent");
    }
    // nenhum DialogContent direto sobrou no arquivo
    expect(src.match(/<DialogContent/g)).toBeNull();
    // xl justificado: 2 textareas + 2 selects + consentimento
    expect(bloco(src, "RegistrarRespostaDialog")).toContain('size="xl"');
    expect(src).not.toMatch(DENSA_NUNCA_MD);
  });

  it("painéis de filtro (registros e duplas) abrem em FormSurface", () => {
    for (const p of [
      "src/components/registros-filtros.tsx",
      "src/components/duplas-lista.tsx",
    ]) {
      const src = ler(p);
      expect(src, p).toContain("<FormSurface");
      expect(src.match(/<DialogContent/g), p).toBeNull();
      expect(src, p).not.toMatch(DENSA_NUNCA_MD);
    }
  });
});
