// Núcleo das leituras determinísticas dos relatórios (REALIZA-455 / US4):
// o achado é explicável por construção — carrega a métrica COM denominador
// que o gerou, o porquê da regra e a intervenção proposta. Regras em
// leituras-*.ts são puras e testadas; nada de score opaco.

export type TomAchado = "risco" | "atencao" | "info" | "ok";

export type Achado = {
  tom: TomAchado;
  /** manchete curta — "3 duplas atrás do calendário". */
  titulo: string;
  /** a métrica que gerou o achado, com denominador — "3 de 12 duplas ativas". */
  metrica: string;
  /** a regra explicada — por que isso virou achado. */
  porque: string;
  /** a intervenção proposta — o que a coordenação faz com isso. */
  intervencao: string;
  /** link opcional pra onde a intervenção acontece. */
  acao?: { rotulo: string; href: string };
};

/** Prioridade de exibição: urgência primeiro, boa notícia por último.
 *  Ordenação estável — achados do mesmo tom mantêm a ordem de emissão. */
const ORDEM_TOM: Record<TomAchado, number> = {
  risco: 0,
  atencao: 1,
  info: 2,
  ok: 3,
};

export function ordenaAchados(achados: Achado[]): Achado[] {
  return [...achados].sort((a, b) => ORDEM_TOM[a.tom] - ORDEM_TOM[b.tom]);
}

/** O vazio honesto: sem dado pra régua, a leitura diz isso em vez de
 *  inventar urgência. */
export function nadaADeclarar(motivo: string): Achado[] {
  return [
    {
      tom: "ok",
      titulo: "Nada a declarar",
      metrica: motivo,
      porque: "os agregados do recorte estão dentro do esperado",
      intervencao: "siga a rotina: a seção avisa quando algo sair do lugar",
    },
  ];
}
