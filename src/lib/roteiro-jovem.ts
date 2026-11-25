import type { DocBloco } from "./materiais-documentos";

// ---------- versão do jovem do roteiro (QA 25/11) ----------
// O doc do encontro é único (mesmo `conteudo` para os dois lados). O que
// é do(a) mentor(a) — preparação e nota ao mentor — não pode aparecer na
// tela do jovem, e checklist que não persiste vira ruído. O corte é de
// leitura, no render; nada muda no documento.
//
// Módulo client-safe de propósito: `roteiro-semana.tsx` importa daqui em
// vez de `plano-roteiros.ts`, que puxa `materiais/corpus-doc` (node:fs) e
// quebrava o bundle do servidor no Turbopack.

/** Mesma normalização do corpus (sem acento, minúsculo) — duplicada aqui
 *  para não arrastar `corpus-doc` (node:fs) para o render. */
const normTitulo = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const CORTA_L2 = /^(depois do encontro|nota ao mentor)\b/;
const CORTA_L3 = /^(preparacao|antes de finalizar)\b/;

export function blocosParaJovem(blocos: readonly DocBloco[]): DocBloco[] {
  const out: DocBloco[] = [];
  let cortaL2 = false;
  let cortaL3 = false;
  // título de L2 viva segura o lugar até algo sobreviver embaixo — uma
  // seção cujos filhos caem todos some junto com o título
  let l2Pendente: DocBloco | null = null;
  const empurra = (b: DocBloco) => {
    if (l2Pendente) {
      out.push(l2Pendente);
      l2Pendente = null;
    }
    out.push(b.kind === "lista" && b.check ? { ...b, check: false } : b);
  };
  for (const b of blocos) {
    if (b.kind === "subtitulo") {
      if (b.nivel === 3) {
        cortaL3 = CORTA_L3.test(normTitulo(b.texto));
      } else {
        cortaL2 = CORTA_L2.test(normTitulo(b.texto));
        cortaL3 = false;
        l2Pendente = cortaL2 ? null : b;
        continue;
      }
    }
    if (cortaL2 || cortaL3) continue;
    empurra(b);
  }
  return out;
}
