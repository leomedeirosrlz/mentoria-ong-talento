// Fontes citáveis do RAG (guia → link interno) — compartilhado entre a
// rota (que emite `fontes` no evento done) e o componente (que renderiza
// a fileira "Fontes" sob a resposta). `guia` é o id do frontmatter dos
// docs/rag/*.md (coluna ia_chunks.guia); onde não há destino útil, a
// fonte sai como texto sem link.

export type FonteIa = {
  guia: string;
  secao?: string | null;
  /** slug do documento nativo citado (ia_chunks.material, 0165) — base do
   *  href quando o guia tem página em /materiais/documento */
  material?: string | null;
  /** âncora da seção no documento nativo — a metaFonte pendura no href
   *  como #<ancora> quando o destino é uma página /documento/ */
  ancora?: string | null;
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

// um rótulo + destino por guia do corpus (docs/rag/fontes.json). Todo doc
// do corpus renderiza nativo em /materiais/documento/<slug> — `doc` marca
// isso e guarda o slug (o `material` do chunk cobre o caso de divergência).
// `docJovem` marca o doc cuja audiência do frontmatter serve o mentorado
// (corpusServeJovem, materiais/corpus-doc.ts): doc sem a flag remapa pro
// hub /jovem/materiais em vez de linkar página que daria 404. Destino que
// não é corpus (agenda, ajuda) segue em `href`; sem `href` nem `doc` a
// fonte sai como texto, e guia sem entrada sai o slug como texto.
const DOC = "/materiais/documento";
const HUB_JOVEM = "/jovem/materiais";
// um roteiro por encontro (roteiro-encontro-01 … 16) — cada um tem
// documento nativo próprio, âncora por seção
const ROTEIROS = Object.fromEntries(
  Array.from({ length: 16 }, (_, i) => {
    const slug = `roteiro-encontro-${String(i + 1).padStart(2, "0")}`;
    return [slug, { rotulo: `Roteiro do ${i + 1}º encontro`, doc: slug }];
  })
);
const META_FONTE: Record<
  string,
  { rotulo: string; href?: string; doc?: string; docJovem?: boolean }
> = {
  "guia-mentor-dpp": { rotulo: "Guia do Mentor DPP", doc: "guia-mentor-dpp" },
  "guia-mentor-especialista": {
    rotulo: "Guia do Mentor Especialista",
    doc: "guia-mentor-especialista",
  },
  "ciclo-cronograma": { rotulo: "Cronograma do ciclo, Turma 1", href: "/agenda" },
  "ciclo-turma2-cronograma": {
    rotulo: "Cronograma do ciclo, Turma 2",
    href: "/agenda",
  },
  ...ROTEIROS,
  "plataforma-e-operacao": {
    rotulo: "Plataforma e operação",
    doc: "plataforma-e-operacao",
  },
  "perguntas-eficazes": { rotulo: "Perguntas Eficazes", doc: "perguntas-eficazes" },
  "escuta-ativa-e-comunicacao": {
    rotulo: "Escuta ativa e comunicação",
    doc: "escuta-ativa-e-comunicacao",
  },
  "codigo-etica-conduta": {
    rotulo: "Código de ética e conduta",
    doc: "codigo-etica-conduta",
    docJovem: true,
  },
  "instrumento-roda-da-vida": {
    rotulo: "Roda da Vida",
    doc: "instrumento-roda-da-vida",
  },
  "instrumento-pdm": {
    rotulo: "PDM (Plano de Desenvolvimento do Mentorado)",
    doc: "instrumento-pdm",
  },
  "instrumento-construindo-visao": {
    rotulo: "Construindo a sua Visão",
    doc: "instrumento-construindo-visao",
  },
  "instrumento-definindo-minhas-metas": {
    rotulo: "Definindo Minhas Metas",
    doc: "instrumento-definindo-minhas-metas",
  },
  "checklist-competencias": {
    rotulo: "Checklist de competências do mentor",
    doc: "checklist-competencias",
  },
  "feedback-construtivo": {
    rotulo: "Feedback Construtivo",
    doc: "feedback-construtivo",
    docJovem: true,
  },
  "mensagem-preparacao": {
    rotulo: "Mensagem de preparação",
    doc: "mensagem-preparacao",
  },
  "mensagem-indicadas": {
    rotulo: "Mensagem às pessoas indicadas",
    doc: "mensagem-indicadas",
  },
  "mensagem-encaminhamento": {
    rotulo: "Mensagem de encaminhamento",
    doc: "mensagem-encaminhamento",
  },
  "autorizacao-responsavel": {
    rotulo: "Autorização do responsável legal",
    doc: "autorizacao-responsavel",
  },
  "termo-adesao-voluntario": {
    rotulo: "Termo de adesão",
    doc: "termo-adesao-voluntario",
  },
  "termo-mentorando": {
    rotulo: "Termo do mentorando",
    doc: "termo-mentorando",
  },
  // ajuda_faq cita a FAQ pelo nome dela (ui.ts), não por slug de guia — o
  // destino já é a rota do jovem, que metaFonte devolve intacta abaixo
  "Ajuda do Realiza": { rotulo: "Ajuda do Realiza", href: "/jovem/ajuda" },
};

/** Rótulo legível + destino real da fonte. `jovem` troca os caminhos do
 *  (app) pelos do mentorado: ele vive em /jovem — o documento nativo tem
 *  página própria lá e o resto vai pro hub de materiais dele. `ref` traz
 *  os metadados do chunk citado (0165): `material` refina o slug do
 *  documento nativo (o mapa `doc` cobre o chunk antigo sem a coluna) e
 *  `ancora` vira o sufixo # do link quando o destino é página /documento/
 *  — o ##/### lá tem o id que a âncora nomeia. */
export function metaFonte(
  guia: string,
  jovem?: boolean,
  ref?: { material?: string | null; ancora?: string | null }
): { rotulo: string; href?: string } {
  const meta = META_FONTE[guia];
  if (!meta) return { rotulo: guia };
  let href = meta.doc ? `${DOC}/${ref?.material || meta.doc}` : meta.href;
  if (jovem && href) {
    // destino que já é do jovem (Ajuda do Realiza) não passa pelo remap
    if (href.startsWith("/jovem")) href = href;
    else if (href.startsWith(DOC))
      // doc que a audiência do frontmatter não libera pro mentorado
      // cairia em 404 (corpusServeJovem) — vai pro hub, como o resto
      href = meta.docJovem ? `/jovem${href}` : HUB_JOVEM;
    else if (href === "/agenda") href = "/jovem/agenda";
    else href = HUB_JOVEM;
  }
  // fora de /documento/ a âncora não resolve nada (não tem ##/### com id
  // esperando) — cai no href base
  if (href && ref?.ancora && href.includes("/documento/")) {
    href = `${href}#${ref.ancora}`;
  }
  return { rotulo: meta.rotulo, href };
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
