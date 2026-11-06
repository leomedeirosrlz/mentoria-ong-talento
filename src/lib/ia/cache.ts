// Cache em memória da camada de IA: o que é igual pra todo mundo e muda
// raramente (config viva, catálogo dos guias, resultado da busca nos
// guias, vetor da pergunta) não precisa custar query nem chamada de
// embedding a cada mensagem. Por instância: no Fluid Compute a instância
// atende muitas requests seguidas, então o acerto é alto sem infra nova;
// instância fria só refaz a leitura uma vez.
//
// Só entra aqui dado sem recorte por pessoa — nada que a RLS filtre por
// usuário (duplas, encontros, eventos) passa por este cache.

type Entrada<V> = { valor: V; expiraEm: number };

export class CacheTtl<V> {
  private mapa = new Map<string, Entrada<V>>();
  // chamadas simultâneas da mesma chave dividem a mesma promessa: um
  // burst de perguntas iguais (chip de sugestão) vira uma leitura só
  private emVoo = new Map<string, Promise<V>>();

  constructor(
    private ttlMs: number,
    private max: number
  ) {}

  get(chave: string): V | undefined {
    const e = this.mapa.get(chave);
    if (!e) return undefined;
    if (e.expiraEm <= Date.now()) {
      this.mapa.delete(chave);
      return undefined;
    }
    // reinsere pra ordem de inserção do Map virar ordem de uso (LRU)
    this.mapa.delete(chave);
    this.mapa.set(chave, e);
    return e.valor;
  }

  set(chave: string, valor: V): void {
    this.mapa.delete(chave);
    this.mapa.set(chave, { valor, expiraEm: Date.now() + this.ttlMs });
    while (this.mapa.size > this.max) {
      const maisAntiga = this.mapa.keys().next().value;
      if (maisAntiga === undefined) break;
      this.mapa.delete(maisAntiga);
    }
  }

  /** Valor da chave ou `carregar()` — falha não fica guardada (a próxima
   *  chamada tenta de novo) e `guardar` decide se o resultado vale cache. */
  async obter(
    chave: string,
    carregar: () => Promise<V>,
    guardar: (v: V) => boolean = () => true
  ): Promise<V> {
    const hit = this.get(chave);
    if (hit !== undefined) return hit;
    const voo = this.emVoo.get(chave);
    if (voo) return voo;
    const p = carregar()
      .then((v) => {
        if (guardar(v)) this.set(chave, v);
        return v;
      })
      .finally(() => this.emVoo.delete(chave));
    this.emVoo.set(chave, p);
    return p;
  }

  limpar(): void {
    this.mapa.clear();
    this.emVoo.clear();
  }
}

/** Chave de pergunta: caixa, acento, pontuação e espaço não mudam a
 *  busca — "Roda da Vida?" e "roda da vida" são a mesma consulta. */
export function chavePergunta(pergunta: string): string {
  return pergunta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
