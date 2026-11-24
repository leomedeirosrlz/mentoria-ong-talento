import { z } from "zod";
import type { DocBloco } from "./materiais-documentos";

/** Validação do conteúdo `DocBloco[]` persistido (roteiros do plano, 020;
 *  a 021 reutiliza). As regras reproduzem o contrato do corpus: html já
 *  escapado com a whitelist `<b> <i> <a href class> <br>` — qualquer tag
 *  fora dela, `<` solto ou href fora de "./ # / http(s)" derruba o
 *  documento inteiro (a tela cai no roteiro do corpus). */

const TAG_RE = /<[^>]*>/g;
const TAG_OK = /^<\/?(?:b|i|br)\s*\/?>$|^<a\s+[^>]*>$|^<\/a>$/i;
const HREF_RE = /^<a\s+href="([^"]*)"(?:\s+class="[^"]*")?\s*\/?>$/i;
const HREF_OK = /^(?:\.\/|#|\/|https?:\/\/)/i;

function htmlSeguro(html: string): boolean {
  const tags = html.match(TAG_RE) ?? [];
  for (const t of tags) {
    if (!TAG_OK.test(t)) return false;
    if (/^<a\s/i.test(t)) {
      const m = HREF_RE.exec(t);
      if (!m || !HREF_OK.test(m[1])) return false;
    }
  }
  // `<` ou `>` fora de tag reconhecida: deve vir escapado como entidade
  return !/[<>]/.test(html.replace(TAG_RE, ""));
}

const htmlDoc = z
  .string()
  .min(1)
  .refine(htmlSeguro, "html fora da whitelist do documento");

const blocoBase = {
  par: z.object({ kind: z.literal("par"), html: htmlDoc }),
  subtitulo: z.object({
    kind: z.literal("subtitulo"),
    texto: z.string().min(1),
    nivel: z.union([z.literal(2), z.literal(3)]).optional(),
  }),
  lista: z.object({
    kind: z.literal("lista"),
    itens: z.array(htmlDoc).min(1),
    ordenada: z.boolean().optional(),
    check: z.boolean().optional(),
  }),
  pergunta: z.object({ kind: z.literal("pergunta"), texto: z.string().min(1) }),
  subj: z.object({ kind: z.literal("subj"), texto: z.string().min(1) }),
  callout: z.object({
    kind: z.literal("callout"),
    tom: z.enum(["info", "tip", "alerta", "check"]),
    html: htmlDoc,
  }),
  numero: z.object({
    kind: z.literal("numero"),
    numero: z.string().min(1),
    titulo: z.string().min(1),
    html: htmlDoc,
  }),
  quote: z.object({
    kind: z.literal("quote"),
    html: htmlDoc,
    fonte: z.string().optional(),
  }),
  tabela: z.object({
    kind: z.literal("tabela"),
    cabecalho: z.array(htmlDoc).min(1),
    linhas: z.array(z.array(htmlDoc)).min(1),
    marcacao: z.string().optional(),
  }),
} as const;

const docBlocoSchemaInterno: z.ZodType<DocBloco> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    blocoBase.par,
    blocoBase.subtitulo,
    blocoBase.lista,
    blocoBase.pergunta,
    blocoBase.subj,
    blocoBase.callout,
    blocoBase.numero,
    blocoBase.quote,
    blocoBase.tabela,
    z.object({
      kind: z.literal("encontro"),
      numero: z.number().int().positive(),
      titulo: z.string().min(1),
      anchor: z.string().optional(),
      corpo: z.array(docBlocoSchemaInterno).max(80),
      tarefa: htmlDoc.optional(),
      roteiro: z
        .object({ slug: z.string().min(1), rotulo: z.string().optional() })
        .optional(),
    }),
  ])
) as z.ZodType<DocBloco>;

export const docBlocoSchema = docBlocoSchemaInterno;

/** Documento inteiro: array de blocos com teto anti-flood. */
export const docBlocosSchema = z.array(docBlocoSchema).max(400);

/** Conteúdo persistido → DocBloco[] tipado. Null quando inválido: o
 *  render caí no roteiro do corpus em vez de quebrar a página. */
export function parseDocBlocos(data: unknown): DocBloco[] | null {
  const r = docBlocosSchema.safeParse(data);
  return r.success ? (r.data as DocBloco[]) : null;
}

/** Escapa texto puro pros campos html do documento (gerado ou editado). */
export function escapeDocHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** html do documento → texto puro (edição nos textareas do rascunho):
 *  tira as tags da whitelist, vira <br> em quebra de linha e desescapa. */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}
