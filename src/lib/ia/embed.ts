// Embeddings via OpenAI — provider separado do chat porque o Zen Go não
// expõe /embeddings (REALIZA-324/vetor). Escopo mínimo: só recebe a
// PERGUNTA do usuário em query-time (o corpus é embedado offline no
// script de ingest). Nunca lança e nunca bloqueia a tool: qualquer
// falha → null e a RPC segue só com o braço FTS (p_embedding null).
//
// Envs server-only: IA_EMBED_API_KEY (sem ela tudo desliga sozinho),
// IA_EMBED_MODEL (default text-embedding-3-small), IA_EMBED_DIM (default
// 512 — Matryoshka trunca sem perda relevante e casa com a coluna
// vector(512) da 0150).

const EMBED_TIMEOUT_MS = 2_500;

export function embedConfigurado(): boolean {
  return Boolean(process.env.IA_EMBED_API_KEY);
}

/** Vetor da pergunta (query-time). Null em qualquer falha — chamador
 *  segue pro FTS sem retry: a busca vetorial é bônus, não dependência. */
export async function embedQuery(texto: string): Promise<number[] | null> {
  const key = process.env.IA_EMBED_API_KEY;
  if (!key || !texto.trim()) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.IA_EMBED_MODEL ?? "text-embedding-3-small",
        input: texto,
        dimensions: Number(process.env.IA_EMBED_DIM ?? 512),
      }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(
        `embedQuery: HTTP ${res.status}`,
        (await res.text().catch(() => "")).slice(0, 200)
      );
      return null;
    }
    const emb = (await res.json())?.data?.[0]?.embedding;
    return Array.isArray(emb) ? (emb as number[]) : null;
  } catch (e) {
    console.error("embedQuery:", e);
    return null;
  }
}
