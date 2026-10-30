// Fontes citáveis do RAG (guia → link interno) — compartilhado entre a
// rota (que emite `fontes` no evento done) e o componente (que renderiza
// a fileira "Fontes" sob a resposta). `guia` é o id do frontmatter dos
// docs/rag/*.md (coluna ia_chunks.guia); onde não há destino útil, a
// fonte sai como texto sem link.

export type FonteIa = {
  guia: string;
  secao?: string | null;
  pagina?: number | null;
};

const META_FONTE: Record<string, { rotulo: string; href: string }> = {
  "guia-mentor-dpp": {
    rotulo: "Guia do Mentor DPP",
    href: "/materiais?aba=biblioteca",
  },
  "guia-mentor-especialista": {
    rotulo: "Guia do Mentor Especialista",
    href: "/materiais?aba=biblioteca",
  },
  "ciclo-cronograma": {
    rotulo: "Cronograma do ciclo",
    href: "/agenda",
  },
  "instrumento-definindo-minhas-metas": {
    rotulo: "Instrumento — Definindo Minhas Metas",
    href: "/materiais?aba=instrumentos",
  },
  "plataforma-e-operacao": {
    rotulo: "Plataforma e operação",
    href: "/materiais?aba=biblioteca",
  },
  "termo-adesao-voluntario": {
    rotulo: "Termo de adesão",
    href: "/materiais?aba=biblioteca",
  },
};

export function metaFonte(guia: string): { rotulo: string; href?: string } {
  return META_FONTE[guia] ?? { rotulo: guia };
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
};

export function rotuloTool(nome: string): string {
  return ROTULO_TOOL[nome] ?? nome;
}
