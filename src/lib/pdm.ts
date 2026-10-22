// PDM nativo (REALIZA-181): domínio puro do documento vivo — tipos do
// contrato da RPC pdm_da_dupla, montagem da árvore recursiva, progresso,
// resumo pro encerramento e o parser das linhas de submetas (espelho da
// função SQL pdm_parse_submetas — mexer nos dois juntos).

export type PdmItemStatus = "ativa" | "atingida" | "descartada";

export type PdmItem = {
  id: string;
  parentId: string | null;
  titulo: string;
  porque: string | null;
  indicador: string | null;
  areaVida: string | null;
  /** "YYYY-MM-DD" ou null. */
  prazoAlvo: string | null;
  status: PdmItemStatus;
  atingidaEm: string | null;
  ordem: number;
  origem: "manual" | "metas" | "pdm" | "visao";
  origemCampo: string | null;
};

/** Contrato camelCase da RPC pdm_da_dupla — a árvore se monta na lib. */
export type PdmDoc = {
  duplaId: string;
  visao: string | null;
  visaoEm: string | null;
  itens: PdmItem[];
};

export type PdmNo = PdmItem & { filhos: PdmNo[] };

// ---------- constantes ----------

export const PDM_MAX_METAS = 10;
export const PDM_MAX_SUBITENS = 20;
export const PDM_MAX_VISAO = 2000;

export const PDM_STATUS_LABEL: Record<PdmItemStatus, string> = {
  ativa: "Em andamento",
  atingida: "Atingida",
  descartada: "Descartada",
};

/** Áreas da vida da Roda (guia DPP §8) — as 16 áreas dos 4 quadrantes, no
 *  rótulo curto que cabe no badge do item. */
export const PDM_AREAS_VIDA = [
  "Saúde e disposição",
  "Intelecto e cultura",
  "Equilíbrio emocional",
  "Independência",
  "Carreira e trabalho",
  "Finanças",
  "Escola / universidade",
  "Contribuição social",
  "Família",
  "Amigos",
  "Relacionamento amoroso",
  "Vida social",
  "Hobbies e diversão",
  "Atividade física",
  "Realização e felicidade",
  "Espiritualidade",
] as const;

// ---------- árvore ----------

/** Monta a árvore a partir da lista plana da RPC: raízes primeiro, filhos
 *  recursivos, tudo ordenado por `ordem` (depois por título, estável).
 *  Órfãos (pai apagado entre fetch e render, ou dado quebrado) viram
 *  raízes — nunca somem da tela. `status` filtra por nível de vista. */
export function montaArvorePdm(itens: PdmItem[]): PdmNo[] {
  const porId = new Map<string, PdmNo>();
  const raizes: PdmNo[] = [];
  // ordem estável da RPC (ordem, created_at) preservada pra desempates
  const ordenados = [...itens].sort(
    (a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo)
  );
  for (const i of ordenados) porId.set(i.id, { ...i, filhos: [] });
  for (const no of porId.values()) {
    const pai = no.parentId != null ? porId.get(no.parentId) : undefined;
    if (pai) pai.filhos.push(no);
    else raizes.push(no);
  }
  const ordena = (ns: PdmNo[]) => {
    ns.sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo));
    for (const n of ns) ordena(n.filhos);
  };
  ordena(raizes);
  return raizes;
}

/** Conta subitens não-descartados do doc inteiro (o teto de 20 é por
 *  documento, não por meta — o SQL trava o mesmo escopo). */
export function subitensAtivos(itens: PdmItem[]): number {
  return itens.filter(
    (i) => i.parentId != null && i.status !== "descartada"
  ).length;
}

/** Metas não-descartadas — o que a vista "ativas" mostra e o que conta no
 *  teto de 10 e na régua de progresso. */
export function metasAtivas(itens: PdmItem[]): PdmItem[] {
  return itens.filter(
    (i) => i.parentId == null && i.status !== "descartada"
  );
}

// ---------- progresso ----------

export type PdmProgresso = {
  total: number;
  atingidas: number;
  /** 0–100; 0 quando não há meta ativa (barra vazia, não NaN). */
  pct: number;
};

/** Régua do doc: só metas (raiz), descartadas fora da conta — uma meta
 *  descartada depois de cumprida não infla nem derruba o progresso. */
export function progressoPdm(itens: PdmItem[]): PdmProgresso {
  const metas = metasAtivas(itens);
  const atingidas = metas.filter((m) => m.status === "atingida").length;
  return {
    total: metas.length,
    atingidas,
    pct: metas.length ? Math.round((atingidas / metas.length) * 100) : 0,
  };
}

// ---------- resumo pro encerramento ----------

export type PdmResumo = {
  total: number;
  atingidas: number;
  /** Metas cumpridas com data — retro alimentada sozinha. */
  atingidasLista: { titulo: string; atingidaEm: string | null }[];
};

/** O recorte do PDM pro resumo da jornada/relatório final: metas totais
 *  (ativas + atingidas — descartada não conta), quantas saíram do papel e
 *  a lista delas na ordem de prioridade. Null quando nem PDM existe. */
export function resumoPdm(doc: PdmDoc | null): PdmResumo | null {
  if (!doc || !doc.itens.length) return null;
  const metas = metasAtivas(doc.itens);
  const atingidas = metas
    .filter((m) => m.status === "atingida")
    .sort((a, b) => a.ordem - b.ordem)
    .map((m) => ({ titulo: m.titulo, atingidaEm: m.atingidaEm }));
  return { total: metas.length, atingidas: atingidas.length, atingidasLista: atingidas };
}

// ---------- parser do mapa de submetas (espelho de pdm_parse_submetas) ----------

/** Quebra o texto_longo do campo submetas_N em linhas de item: uma por
 *  linha; marcadores "2.", "3)" no meio da linha também separam (texto
 *  colado de uma linha só). Remove "1.", "2)", "-" do início, ignora
 *  vazias e corta em 20 — a mesma régua da função SQL. */
export function parseSubmetasLinhas(texto: string | null | undefined): string[] {
  if (!texto?.trim()) return [];
  const out: string[] = [];
  for (const linha of texto.split(/\r?\n+/)) {
    for (const pedaco of linha.split(/\s+\d+[.)]\s+/)) {
      const limpo = pedaco.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim();
      if (limpo) out.push(limpo.slice(0, 500));
      if (out.length >= PDM_MAX_SUBITENS) return out;
    }
  }
  return out;
}
