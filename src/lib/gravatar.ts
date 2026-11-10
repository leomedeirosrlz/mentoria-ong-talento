import { unstable_cache } from "next/cache";
import { gravatarHash, gravatarUrl } from "@/lib/avatar";

// Gravatar existe? — check server-side com cache de 24h por hash de e-mail.
// Sem ele, todo perfil sem foto disparava um /_next/image?…&d=404 condenado
// (a cascata do <Avatar> só descia pras iniciais DEPOIS do 404 voltar).
// A URL só viaja pro cliente quando a conta existe de verdade.
//
// HEAD, não GET: basta o status — d=404 faz o Gravatar responder 404 quando
// a conta não tem imagem (verificado: hash desconhecido → 404, sem 405).
// Falha de rede/5xx resolve false: iniciais na hora e nada quebra — o preço
// é a resposta ruim ficar cacheada até 24h, trade-off aceito (e desejável:
// durante uma queda do Gravatar ninguém queima request atrás de foto).

const gravatarExiste = unstable_cache(
  async (hash: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `https://www.gravatar.com/avatar/${hash}?d=404&s=64`,
        { method: "HEAD", signal: AbortSignal.timeout(5000) }
      );
      return res.ok;
    } catch {
      return false;
    }
  },
  ["gravatar-existe"],
  { revalidate: 86_400 }
);

const emailChave = (email: string) => email.trim().toLowerCase();

/** URL do Gravatar quando a conta existe — null manda o <Avatar> direto
 *  pras iniciais. Pra um e-mail só (perfil próprio, ficha de pessoa). */
export async function gravatarUrlSeExiste(
  email: string | null | undefined,
  size = 128
): Promise<string | null> {
  if (!email?.trim()) return null;
  const chave = emailChave(email);
  return (await gravatarExiste(gravatarHash(chave)))
    ? gravatarUrl(chave, size)
    : null;
}

/** Mapa e-mail→URL pra um lote (listas de duplas/pessoas): deduplica pelo
 *  e-mail normalizado e resolve tudo em paralelo — cada checagem é
 *  unstable_cache, então e-mails repetidos entre requests saem de graça e
 *  o custo real é 1 HEAD por e-mail distinto por dia. Chave do mapa =
 *  e-mail normalizado (trim + lowercase), consultar via gravatarUrlDo. */
export async function gravatarMapa(
  emails: Iterable<string | null | undefined>,
  size = 128
): Promise<Map<string, string>> {
  const chaves = [
    ...new Set(
      [...emails]
        .filter((e): e is string => !!e?.trim())
        .map(emailChave)
    ),
  ];
  const urls = await Promise.all(
    chaves.map(async (chave) => {
      const existe = await gravatarExiste(gravatarHash(chave));
      return [chave, existe ? gravatarUrl(chave, size) : null] as const;
    })
  );
  return new Map(
    urls.filter((e): e is readonly [string, string] => e[1] != null)
  );
}

/** Lookup no mapa de gravatarMapa — normaliza a chave do mesmo jeito. */
export function gravatarUrlDo(
  mapa: ReadonlyMap<string, string>,
  email: string | null | undefined
): string | null {
  return email ? (mapa.get(emailChave(email)) ?? null) : null;
}
