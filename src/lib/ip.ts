import { headers } from "next/headers";

// IP do cliente pra evidência/auditoria. `x-forwarded-for[0]` é forjável:
// qualquer cliente manda o header que quiser e o primeiro elemento é o que
// o próprio cliente declarou. Na Vercel o confiável é
// `x-vercel-forwarded-for` — a edge reescreve a cadeia e remove os trechos
// spoofados. Fora da Vercel (preview local, outro proxy), o único elemento
// que o proxy acrescentou é o ÚLTIMO do x-forwarded-for — os anteriores
// são o que o cliente mandou.
export async function ipCliente(): Promise<string | null> {
  const h = await headers();
  const vercel = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const xff = h.get("x-forwarded-for")?.split(",");
  const last = xff?.[xff.length - 1]?.trim();
  return last || h.get("x-real-ip") || null;
}
