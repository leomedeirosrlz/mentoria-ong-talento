import { formatDate } from "./ciclo";
import type {
  Conquista,
  ConquistaGlifo,
  NiveisJornada,
  NivelJornada,
} from "./conquistas";

// Os selos que o jovem escolhe mostrar no perfil (REALIZA-529): até 3,
// entre o que ele já ganhou. Núcleo puro e isomórfico — o cookie é lido
// no server (page) e escrito pela action; a UI só recebe a lista pronta.

export const MAX_SELOS = 3;
export const SELOS_COOKIE = "selos_perfil";

/** Uma peça que pode ir pro perfil: a faixa de nível ou uma conquista da
 *  estante. Guarda o objeto original — o detalhe reaproveita o mesmo
 *  conteúdo do card (nada de segunda versão do texto). */
export type PecaSelo =
  | { chave: string; origem: "nivel"; faixa: NivelJornada }
  | { chave: string; origem: "conquista"; conquista: Conquista };

/** O mínimo que o seletor precisa saber de uma peça — serializável e leve,
 *  pra não repetir o detalhe inteiro em cada lugar que escolhe. */
export type OpcaoSelo = {
  chave: string;
  titulo: string;
  linha: string;
  glifo: ConquistaGlifo;
  tom: { cor: string; tinta: string };
};

export function opcaoDoSelo(p: PecaSelo): OpcaoSelo {
  if (p.origem === "nivel")
    return {
      chave: p.chave,
      titulo: p.faixa.titulo,
      linha: "Nível",
      glifo: p.faixa.glifo,
      tom: p.faixa.tom,
    };
  const c = p.conquista;
  return {
    chave: p.chave,
    titulo: c.titulo,
    linha: c.data ? formatDate(c.data) : "Conquistada",
    glifo: c.glifo,
    tom: c.tom,
  };
}

const CHAVE_RE = /^[a-z]+:[a-z0-9-]+$/;

/** A chave estável da escolha. A de família carrega o degrau
 *  (`conta:combinados-2`) e o degrau sobe com o tempo: guardar só a
 *  família faz o selo do perfil acompanhar a evolução da peça. */
export function chaveDoSelo(c: Conquista): string {
  return c.familia ? c.chave.replace(/-\d+$/, "") : c.chave;
}

/** Tudo o que o jovem pode escolher: as faixas já ganhas (a atual e as
 *  anteriores) e a estante inteira. Faixa "superada" não entra — foi
 *  pulada, não conquistada. */
export function pecasEscolhiveis(
  nivel: NiveisJornada | null,
  conquistas: Conquista[]
): PecaSelo[] {
  const faixas: PecaSelo[] = (nivel?.faixas ?? [])
    .filter((f) => f.estado === "ganho")
    .reverse()
    .map((faixa) => ({ chave: `nivel:${faixa.chave}`, origem: "nivel", faixa }));
  const estante: PecaSelo[] = conquistas.map((conquista) => ({
    chave: chaveDoSelo(conquista),
    origem: "conquista",
    conquista,
  }));
  return [...faixas, ...estante];
}

/** O que o perfil mostra. Sem escolha salva: a faixa atual e as duas
 *  conquistas mais recentes — a vitrine nunca nasce vazia. Com escolha
 *  (mesmo vazia): só ela, na ordem dela, sem chave que a pessoa já não
 *  tem mais. */
export function selosDoPerfil(
  pecas: PecaSelo[],
  escolha: string[] | null
): PecaSelo[] {
  if (escolha) {
    const porChave = new Map(pecas.map((p) => [p.chave, p]));
    return escolha
      .map((k) => porChave.get(k))
      .filter((p): p is PecaSelo => !!p)
      .slice(0, MAX_SELOS);
  }
  const atual = nivelAtual(pecas);
  const recentes = pecas
    .filter((p) => p.origem === "conquista")
    .map((p) => p as Extract<PecaSelo, { origem: "conquista" }>)
    .sort(
      (a, b) =>
        (b.conquista.data ? Date.parse(b.conquista.data) : 0) -
        (a.conquista.data ? Date.parse(a.conquista.data) : 0)
    );
  return [...(atual ? [atual] : []), ...recentes].slice(0, MAX_SELOS);
}

// as faixas entram em pecasEscolhiveis da mais alta pra mais baixa, então
// a primeira de origem "nivel" é a atual
function nivelAtual(pecas: PecaSelo[]): PecaSelo | null {
  return pecas.find((p) => p.origem === "nivel") ?? null;
}

/** Valida a escolha vinda do cliente: no máximo MAX_SELOS chaves únicas
 *  e bem formadas. Null = inválida. */
export function escolhaValida(chaves: unknown): string[] | null {
  if (!Array.isArray(chaves) || chaves.length > MAX_SELOS) return null;
  const vistas = new Set<string>();
  for (const k of chaves) {
    if (typeof k !== "string" || k.length > 60 || !CHAVE_RE.test(k)) return null;
    if (vistas.has(k)) return null;
    vistas.add(k);
  }
  return [...vistas];
}

/** Cookie: `<dono>|chave|chave`. O dono é o id da ficha — outra pessoa
 *  no mesmo navegador não herda a vitrine. Sem as chaves = escolheu
 *  mostrar nenhum. */
export function serializaEscolha(dono: string, chaves: string[]): string {
  return [dono, ...chaves].join("|");
}

/** Lê o cookie; null quando não existe, é de outro dono ou está torto. */
export function lerEscolha(
  raw: string | undefined | null,
  dono: string
): string[] | null {
  if (!raw) return null;
  const [d, ...chaves] = raw.split("|");
  if (d !== dono) return null;
  return escolhaValida(chaves);
}
