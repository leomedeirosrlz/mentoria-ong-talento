// PDM nativo (REALIZA-181): domínio puro do documento vivo — tipos do
// contrato da RPC pdm_da_dupla, montagem da árvore recursiva, progresso,
// resumo pro encerramento e o parser das linhas de submetas (espelho da
// função SQL pdm_parse_submetas — mexer nos dois juntos).

export type PdmItemStatus = "ativa" | "atingida" | "descartada";

/** Autor de uma escrita no documento (0211): id + nome de exibição já
 *  resolvidos na RPC (nome_social ?? nome). Null = veio do instrumento
 *  (projeção) ou é escrita pré-autoria — nunca é parâmetro do cliente. */
export type PdmAutor = { id: string; nome: string };

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
  /** Quem criou o item à mão — null nas linhas projetadas de instrumento. */
  criadoPor: PdmAutor | null;
  /** Quem escreveu/editou o item por último — null = nunca tocado à mão. */
  atualizadoPor: PdmAutor | null;
  atualizadoEm: string | null;
};

/** Contrato camelCase da RPC pdm_da_dupla — a árvore se monta na lib. */
export type PdmDoc = {
  duplaId: string;
  visao: string | null;
  visaoEm: string | null;
  /** Quem escreveu a visão atual à mão — null quando veio do instrumento. */
  visaoPor: PdmAutor | null;
  itens: PdmItem[];
};

export type PdmNo = PdmItem & { filhos: PdmNo[] };

// ---------- dedupe por título ----------

/** Título comparável do documento: sem acento, caixa e pontuação/símbolos,
 *  com espaços dobrados colapsados. A forma exibida nunca muda — ela só
 *  serve pra reconhecer "Estudar!" e "estudar" como a mesma linha. */
export function normalizaTituloPdm(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type PdmDedupe = {
  /** Documento de leitura sem a segunda linha da duplicata. Filhos de uma
   *  linha escondida são religados à linha principal — nada some da árvore. */
  itens: PdmItem[];
  /** id da linha principal → ids escondidos no merge. A reordenação usa
   *  esse mapa pra satisfazer a validação da RPC, que exige o conjunto
   *  completo de irmãos ativos no banco. */
  ocultosPorPrincipal: Map<string, string[]>;
};

function primarioDoGrupo(grupo: PdmItem[]): PdmItem {
  return [...grupo].sort((a, b) => {
    // a linha projetada vence: ela é a ponte viva com a resposta de origem
    const pa = a.origem === "manual" ? 1 : 0;
    const pb = b.origem === "manual" ? 1 : 0;
    return pa - pb || a.ordem - b.ordem || a.titulo.localeCompare(b.titulo);
  })[0];
}

function mesclaDuplicado(principal: PdmItem, outros: PdmItem[]): PdmItem {
  const primeiroValor = <K extends keyof PdmItem>(campo: K): PdmItem[K] => {
    if (principal[campo] != null) return principal[campo];
    for (const item of outros) if (item[campo] != null) return item[campo];
    return principal[campo];
  };
  const atingidaEm = [principal, ...outros]
    .map((i) => i.atingidaEm)
    .filter((v): v is string => v != null)
    .sort()[0] ?? null;
  const atualizadoEm = [principal, ...outros]
    .map((i) => i.atualizadoEm)
    .filter((v): v is string => v != null)
    .sort()
    .at(-1) ?? null;
  const temAtingida = [principal, ...outros].some(
    (i) => i.status === "atingida"
  );
  return {
    ...principal,
    titulo: principal.titulo,
    porque: primeiroValor("porque"),
    indicador: primeiroValor("indicador"),
    areaVida: primeiroValor("areaVida"),
    prazoAlvo: primeiroValor("prazoAlvo"),
    status: temAtingida ? "atingida" : principal.status,
    atingidaEm: temAtingida ? atingidaEm : primeiroValor("atingidaEm"),
    ordem: Math.min(principal.ordem, ...outros.map((i) => i.ordem)),
    criadoPor: principal.criadoPor ?? outros.find((i) => i.criadoPor)?.criadoPor ?? null,
    atualizadoPor:
      principal.atualizadoPor ?? outros.find((i) => i.atualizadoPor)?.atualizadoPor ?? null,
    atualizadoEm,
  };
}

/** Merge de leitura, sem escrita: colapsa linhas ativas com o mesmo título
 *  normalizado dentro do mesmo nível (raiz com raiz, filhas do mesmo pai).
 *  A linha principal é preferencialmente a projetada — assim a origem do
 *  instrumento continua visível — e recebe campos/status/filhos da linha
 *  escondida. A operação é idempotente: rodar de novo sobre o resultado
 *  não cria nem remove mais nada. */
export function dedupePdmItens(itens: PdmItem[]): PdmDedupe {
  let trabalho = itens.map((i) => ({ ...i }));
  const ocultosPorPrincipal = new Map<string, string[]>();
  const RAIZ = "__raiz__";

  for (let passo = 0; passo <= itens.length; passo += 1) {
    const grupos = new Map<string, PdmItem[]>();
    for (const item of trabalho) {
      if (item.status === "descartada") continue;
      const titulo = normalizaTituloPdm(item.titulo);
      if (!titulo) continue;
      const chave = `${item.parentId ?? RAIZ}::${titulo}`;
      grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
    }

    let mesclou = false;
    for (const grupo of grupos.values()) {
      if (grupo.length < 2) continue;
      const principal = primarioDoGrupo(grupo);
      const secundarios = grupo.filter((i) => i.id !== principal.id);
      const secundarioIds = new Set(secundarios.map((i) => i.id));

      const ocultosCarregados = secundarios.flatMap((i) => [
        i.id,
        ...(ocultosPorPrincipal.get(i.id) ?? []),
      ]);
      ocultosPorPrincipal.set(principal.id, [
        ...(ocultosPorPrincipal.get(principal.id) ?? []),
        ...ocultosCarregados.filter((id) => id !== principal.id),
      ]);
      for (const id of secundarioIds) ocultosPorPrincipal.delete(id);

      const mesclado = mesclaDuplicado(principal, secundarios);
      trabalho = trabalho
        .filter((i) => !secundarioIds.has(i.id))
        .map((i) => {
          if (i.id === principal.id) return mesclado;
          if (i.parentId != null && secundarioIds.has(i.parentId)) {
            return { ...i, parentId: principal.id };
          }
          return i;
        });
      mesclou = true;
    }
    if (!mesclou) break;
  }

  return { itens: trabalho, ocultosPorPrincipal };
}

/** Expande a ordem visível com as linhas escondidas do dedupe. A RPC exige
 *  todos os ids ativos do nível; as escondidas ficam adjacentes à principal,
 *  então a ordem relativa das linhas visíveis é a ordem pedida pela pessoa. */
export function expandeOrdemComOcultos(
  idsVisiveis: string[],
  ocultosPorPrincipal: Map<string, string[]>
): string[] {
  return idsVisiveis.flatMap((id) => [
    id,
    ...(ocultosPorPrincipal.get(id) ?? []),
  ]);
}

/** Linha ativa do mesmo nível com o mesmo título normalizado — usada pela
 *  action para transformar "criar duplicado" em merge/edição da linha que
 *  já existe. O resultado vem do documento deduplicado, então colisões
 *  anteriores convergem para a mesma linha principal. */
export function itemMesmoTitulo(
  itens: PdmItem[],
  parentId: string | null,
  titulo: string
): PdmItem | null {
  const normal = normalizaTituloPdm(titulo);
  if (!normal) return null;
  return (
    dedupePdmItens(itens).itens.find(
      (i) =>
        i.status !== "descartada" &&
        i.parentId === parentId &&
        normalizaTituloPdm(i.titulo) === normal
    ) ?? null
  );
}

// ---------- constantes ----------

export const PDM_MAX_METAS = 10;
export const PDM_MAX_SUBITENS = 40;
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
  const itensUnicos = dedupePdmItens(itens).itens;
  const porId = new Map<string, PdmNo>();
  const raizes: PdmNo[] = [];
  // ordem estável da RPC (ordem, created_at) preservada pra desempates
  const ordenados = [...itensUnicos].sort(
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
  return dedupePdmItens(itens).itens.filter(
    (i) => i.parentId != null && i.status !== "descartada"
  ).length;
}

/** Metas não-descartadas — o que a vista "ativas" mostra e o que conta no
 *  teto de 10 e na régua de progresso. */
export function metasAtivas(itens: PdmItem[]): PdmItem[] {
  return dedupePdmItens(itens).itens.filter(
    (i) => i.parentId == null && i.status !== "descartada"
  );
}

// ---------- autoria (0211 · REALIZA-450) ----------

/** Quem assina a marca "editado por" do item: a última escrita humana
 *  quando ela mudou de mãos. Criar e depois ajustar o próprio texto não
 *  marca (atualizado_por == created_by); item só projetado e nunca
 *  tocado também não. O jovem vê a mesma marca que a ficha — a
 *  co-autoria do doc é pública entre os dois, não auditoria secreta. */
export function autorEdicaoItem(item: PdmItem): PdmAutor | null {
  if (!item.atualizadoPor) return null;
  if (item.criadoPor && item.atualizadoPor.id === item.criadoPor.id)
    return null;
  return item.atualizadoPor;
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
