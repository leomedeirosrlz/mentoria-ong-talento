// Texto dos templates de mensagem do guia (cap. 14) pra personalização
// pela Liza (REALIZA-388). Os documentos continuam verbatim em
// materiais-documentos.ts — aqui só a projeção em texto puro que a tool
// mensagem_template devolve ao modelo: os [colchetes] do guia ficam
// visíveis pra ele preencher com o que a dupla trouxe. Callouts são
// instrução de uso ("Dica: adapte…"), não corpo da mensagem — saem em
// `dicas`, nunca dentro do `corpo`.

import {
  linhasDoc,
  materialDocumento,
} from "@/lib/materiais-documentos";
import type { DocBloco, DocItem } from "@/lib/materiais-documentos";

export const MENSAGEM_TEMPLATE_SLUGS = [
  "mensagem-preparacao",
  "mensagem-indicadas",
  "mensagem-encaminhamento",
] as const;

export type MensagemTemplateSlug = (typeof MENSAGEM_TEMPLATE_SLUGS)[number];

export type MensagemTemplate = {
  slug: MensagemTemplateSlug;
  titulo: string;
  /** linha de assunto do guia (o ```rascunho reusa em `assunto`/`texto`) */
  assunto: string | null;
  /** corpo em texto puro, [colchetes] preservados */
  corpo: string;
  /** instruções de uso do guia (callouts) — contexto pra escrever, não
   *  parte da mensagem */
  dicas: string[];
  /** orientação de preenchimento por template — quem recebe, o que cada
   *  colchete vira com os dados que a tool devolve */
  nota: string;
};

const NOTA: Record<MensagemTemplateSlug, string> = {
  "mensagem-preparacao":
    "Destinatária: a pessoa mentorada da dupla (numero = o whatsapp dela, quando devolvido). [Nome] vira o primeiro nome dela e [seu nome] o nome do mentor — quem pergunta.",
  "mensagem-indicadas":
    "Cada pessoa indicada recebe uma mensagem própria com o link dela — monte um rascunho por contato em `indicadas` com status pendente: [nome] vira o primeiro nome do contato, [nome do(a) jovem] o primeiro nome do mentorado, [seu nome] o do mentor e [link] a URL individual (campo `link`). Contato sem whatsapp sai só com Copiar. Status expirado/respondido não recebe rascunho — avise que o link expirado precisa ser reemitido na ficha.",
  "mensagem-encaminhamento":
    "Destinatária: a pessoa mentorada (numero = o whatsapp dela, quando devolvido). [Nome] vira o primeiro nome dela; 'Próxima tarefa' e 'Prazo' saem de `combinados_pendentes` (o mais próximo de vencer primeiro — sem pendente, escreva o lembrete genérico do guia); 'data e horário' sai de `proximo_encontro`. Sem encontro agendado, diga que falta agendar e aponte a ficha.",
};

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, "");

function itemTexto(b: DocBloco): string {
  switch (b.kind) {
    case "par":
      return stripHtml(b.html);
    case "lista":
      return b.itens.map((i) => `- ${stripHtml(i)}`).join("\n");
    case "pergunta":
      return b.texto;
    case "numero":
      return `${b.numero}. ${b.titulo}: ${stripHtml(b.html)}`;
    case "quote":
      return `“${stripHtml(b.html)}”${b.fonte ? ` (${b.fonte})` : ""}`;
    case "tabela":
      return [b.cabecalho, ...b.linhas]
        .map((l) => l.map(stripHtml).join(" | "))
        .join("\n");
    case "encontro":
      return `${b.numero}º encontro — ${b.titulo}`;
    case "subj":
    case "callout":
      return "";
  }
}

function itemDica(b: DocBloco): string {
  return b.kind === "callout" ? stripHtml(b.html) : "";
}

const itemCorpo = (item: DocItem): string =>
  item.kind === "nums"
    ? item.itens.map(itemTexto).filter(Boolean).join("\n")
    : itemTexto(item);

/** O template do guia em texto puro pra personalização — null pra slug
 *  que não é template de mensagem (o enum do schema já fecha a lista). */
export function mensagemTemplateTexto(
  slug: MensagemTemplateSlug
): MensagemTemplate | null {
  const doc = materialDocumento(slug);
  if (!doc) return null;
  let assunto: string | null = null;
  const corpo: string[] = [];
  const dicas: string[] = [];
  for (const linha of linhasDoc(doc.blocos)) {
    if (linha.kind === "email") {
      assunto = assunto ?? linha.assunto;
      for (const item of linha.corpo) {
        const t = itemCorpo(item).trim();
        if (t) corpo.push(t);
      }
    } else {
      // o que vem antes do cartão de e-mail é moldura do guia: callout vira
      // dica de preenchimento; outro bloco entra no corpo (defesa — hoje
      // só callout existe fora do e-mail nos 3 templates)
      const item = linha.item;
      const texto =
        item.kind === "nums" ? "" : itemDica(item).trim();
      if (texto) dicas.push(texto);
      else {
        const t = itemCorpo(item).trim();
        if (t) corpo.push(t);
      }
    }
  }
  return {
    slug,
    titulo: doc.titulo,
    assunto,
    corpo: corpo.join("\n\n"),
    dicas,
    nota: NOTA[slug],
  };
}

/** The request the doc-page CTA sends to the mounted assistant — carries
 *  the slug so the model fills the tool's enum without fuzzy matching. */
export function mensagemTemplatePedido(slug: MensagemTemplateSlug): string {
  const t = mensagemTemplateTexto(slug);
  return `Quero personalizar o template ${slug} ("${t?.titulo ?? slug}") com os dados reais. Monta a mensagem pronta pra enviar.`;
}
