// Fontes citáveis do RAG (guia → link interno) — compartilhado entre a
// rota (que emite `fontes` no evento done) e o componente (que renderiza
// a fileira "Fontes" sob a resposta). `guia` é o id do frontmatter dos
// docs/rag/*.md (coluna ia_chunks.guia); onde não há destino útil, a
// fonte sai como texto sem link.

export type FonteIa = {
  guia: string;
  secao?: string | null;
};

/** O `pagina` do ia_chunks é o id sintético do chunk (seção×100+ordem,
 *  ingerir-guias.mjs), não a página do documento — citá-lo lia como
 *  "pág. 200" num guia que não tem essa paginação. Fica no banco como
 *  identidade do chunk e NUNCA sai pro modelo nem pro card. */

/** Limpa o trecho da RPC (ts_headline ou fatia do chunk) pra citação:
 *  tira as marcas <b> do headline, a sintaxe markdown que vazou do chunk
 *  (**negrito**, ## título, | de tabela, - de lista, --- separador),
 *  normaliza espaços e corta no fim de frase — nunca no meio de uma. O
 *  travessão vira vírgula (regra de copy da interface). */
export function limparTrecho(bruto: string | null | undefined, max: number): string {
  if (!bruto) return "";
  let t = bruto
    .replace(/<\/?[^>]+>/g, "") // <b> do ts_headline (e qualquer tag)
    .replace(/^#{1,6}\s+/gm, "") // títulos markdown
    .replace(/^\s*>\s?/gm, "") // blockquote dos templates
    .replace(/\*\*|__/g, "") // negrito/itálico
    .replace(/^\s*[-•*]\s+/gm, "") // marcador de lista no início de linha
    .replace(/\|/g, " · ") // tabela pipe vira lista separada
    .replace(/-{2,}/g, " ") // --- de tabela/hr (antes do colapso de "·")
    .replace(/ - /g, " · ") // hífen separador de item achatado
    .replace(/(\s*·\s*){2,}/g, " · ") // "· ·" de células vazias/separador
    .replace(/\s+—\s+/g, ", ") // travessão fora da copy da interface
    .replace(/\s+/g, " ")
    .trim();
  // pontas de corte de chunk/headline: reticências e pontuação órfã
  t = t.replace(/^[….\s,;:·-]+/, "").replace(/[\s,;:|-·]+$/, "");
  if (t.length <= max) return t;
  // janela max-1: quando o corte cai em palavra, a "…" final mantém o
  // trecho dentro do limite
  const janela = t.slice(0, max - 1);
  // última pontuação de fim de frase depois de ~40% do limite (senão o
  // trecho sairia curto demais — "Oi. Texto longo sem ponto…")
  const fim = Math.max(
    janela.lastIndexOf(". "),
    janela.lastIndexOf("! "),
    janela.lastIndexOf("? "),
    janela.lastIndexOf(".\n"),
    janela.lastIndexOf("!\n"),
    janela.lastIndexOf("?\n")
  );
  if (fim >= max * 0.4) return janela.slice(0, fim + 1);
  const espaco = janela.lastIndexOf(" ");
  return `${(espaco > max * 0.4 ? janela.slice(0, espaco) : janela).trimEnd()}…`;
}

// um rótulo + destino por guia do corpus (docs/rag/fontes.json). Guias,
// roteiros e termos são PDFs do catálogo → biblioteca; os instrumentos
// vivem na aba Instrumentos; os 5 documentos nativos têm página própria em
// /materiais/documento/<slug>; o cronograma é a própria agenda. Sem
// `href` (conteúdo só do corpus, sem material no catálogo) a fonte sai
// com o rótulo e sem link; sem entrada aqui, sai o slug como texto.
const BIB = "/materiais?aba=biblioteca";
const INSTR = "/materiais?aba=instrumentos";
const DOC = "/materiais/documento";
// um roteiro por encontro (roteiro-encontro-01 … 16)
const ROTEIROS = Object.fromEntries(
  Array.from({ length: 16 }, (_, i) => [
    `roteiro-encontro-${String(i + 1).padStart(2, "0")}`,
    { rotulo: `Roteiro do ${i + 1}º encontro`, href: BIB },
  ])
);
const META_FONTE: Record<string, { rotulo: string; href?: string }> = {
  "guia-mentor-dpp": { rotulo: "Guia do Mentor DPP", href: BIB },
  "guia-mentor-especialista": {
    rotulo: "Guia do Mentor Especialista",
    href: BIB,
  },
  "ciclo-cronograma": { rotulo: "Cronograma do ciclo, Turma 1", href: "/agenda" },
  "ciclo-turma2-cronograma": {
    rotulo: "Cronograma do ciclo, Turma 2",
    href: "/agenda",
  },
  ...ROTEIROS,
  "plataforma-e-operacao": { rotulo: "Plataforma e operação", href: BIB },
  "perguntas-eficazes": { rotulo: "Perguntas Eficazes", href: BIB },
  "escuta-ativa-e-comunicacao": { rotulo: "Escuta ativa e comunicação" },
  "codigo-etica-conduta": { rotulo: "Código de ética e conduta" },
  "instrumento-roda-da-vida": { rotulo: "Roda da Vida", href: INSTR },
  "instrumento-pdm": {
    rotulo: "PDM (Plano de Desenvolvimento do Mentorado)",
    href: INSTR,
  },
  "instrumento-construindo-visao": {
    rotulo: "Construindo a sua Visão",
    href: INSTR,
  },
  "instrumento-definindo-minhas-metas": {
    rotulo: "Definindo Minhas Metas",
    href: INSTR,
  },
  "checklist-competencias": {
    rotulo: "Checklist de competências do mentor",
    href: `${DOC}/checklist-competencias`,
  },
  "feedback-construtivo": {
    rotulo: "Feedback Construtivo",
    href: `${DOC}/feedback-construtivo`,
  },
  "mensagem-preparacao": {
    rotulo: "Mensagem de preparação",
    href: `${DOC}/mensagem-preparacao`,
  },
  "mensagem-indicadas": {
    rotulo: "Mensagem às pessoas indicadas",
    href: `${DOC}/mensagem-indicadas`,
  },
  "mensagem-encaminhamento": {
    rotulo: "Mensagem de encaminhamento",
    href: `${DOC}/mensagem-encaminhamento`,
  },
  "autorizacao-responsavel": {
    rotulo: "Autorização do responsável legal",
    href: BIB,
  },
  "termo-adesao-voluntario": { rotulo: "Termo de adesão", href: BIB },
  "termo-mentorando": { rotulo: "Termo do mentorando", href: BIB },
  // ajuda_faq cita a FAQ pelo nome dela (ui.ts), não por slug de guia — o
  // destino já é a rota do jovem, que metaFonte devolve intacta abaixo
  "Ajuda do Realiza": { rotulo: "Ajuda do Realiza", href: "/jovem/ajuda" },
};

/** Rótulo legível + destino real da fonte. `jovem` troca os caminhos do
 *  (app) pelos do mentorado: ele vive em /jovem — o documento nativo tem
 *  página própria lá e o resto vai pro hub de materiais dele. */
export function metaFonte(
  guia: string,
  jovem?: boolean
): { rotulo: string; href?: string } {
  const meta = META_FONTE[guia];
  if (!meta) return { rotulo: guia };
  if (!jovem || !meta.href) return meta;
  // destino que já é do jovem (Ajuda do Realiza) não passa pelo remap
  if (meta.href.startsWith("/jovem")) return meta;
  if (meta.href.startsWith(DOC)) return { ...meta, href: `/jovem${meta.href}` };
  if (meta.href === "/agenda") return { ...meta, href: "/jovem/agenda" };
  return { ...meta, href: "/jovem/materiais" };
}

// Nome interno da tool → rótulo que o usuário entende (a meta "fontes:"
// sob a resposta não pode vazar vocabulário técnico — REALIZA-333)
const ROTULO_TOOL: Record<string, string> = {
  resumo_semana: "resumo da semana",
  ficha_dupla: "ficha da dupla",
  registros_da_dupla: "registros da dupla",
  aguardando_par: "fila de pareamento",
  capacidade_mentores: "ocupação de mentores",
  duplas_do_usuario: "suas duplas",
  agenda_do_periodo: "agenda do período",
  guia_consulta: "guias do programa",
  chamados_resumo: "chamados",
  pessoas_busca: "pessoas",
  instrumentos_da_dupla: "instrumentos da dupla",
  minha_dupla: "sua dupla",
  minha_agenda: "sua agenda",
  meus_combinados: "seus combinados",
  meu_progresso: "sua jornada",
  meus_pedidos: "seus pedidos",
  ajuda_faq: "ajuda do Realiza",
};

export function rotuloTool(nome: string): string {
  return ROTULO_TOOL[nome] ?? nome;
}
