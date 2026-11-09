// Thumbs-up/down gate for Liza answers (assistente-conversa.tsx): thumbs
// only on "complex" answers (tool use OR long text OR a markdown link) and
// only on ~1/3 of those, sampled deterministically by request_id so the
// choice survives re-renders/remounts — same answer, same decision.
// No request_id (demo, error, interrupted or pre-feature stored msgs) →
// never shows.

// FNV-1a over the uuid string: cheap, no deps and uniform enough for
// mod-3 bucketing (~33.3% per bucket measured over 30k random uuids)
export function hashRequestId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** ~500 chars separates a substantive answer from a one-liner */
export const FEEDBACK_MIN_CHARS = 500;

const LINK_MARKDOWN = /\[[^\]]*\]\([^)\s]+\)/;

export function temLinkMarkdown(content: string): boolean {
  return LINK_MARKDOWN.test(content);
}

/** Eligible = used ≥1 tool, wrote >500 chars or cited a link; sampled =
 *  hash(request_id) % 3 === 0 (stable per answer by construction). */
export function deveMostrarFeedback(
  requestId: string | null | undefined,
  resposta: { tools?: number; contentLen: number; hasLink: boolean }
): boolean {
  if (!requestId) return false;
  const complexa =
    (resposta.tools ?? 0) >= 1 ||
    resposta.contentLen > FEEDBACK_MIN_CHARS ||
    resposta.hasLink;
  return complexa && hashRequestId(requestId) % 3 === 0;
}
