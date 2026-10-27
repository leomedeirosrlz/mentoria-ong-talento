// Domínio da engine de formulários (migração 0034) — tipos row locais,
// labels pt-BR e helpers puros (validação de campos, status de link,
// agregação de respostas). Sem imports de next/* nem supabase: o módulo é
// compartilhado por server (queries/actions), client (builder/form público)
// e o dataset da demo — igual src/lib/ciclo.ts.

export type FormularioCampoTipo =
  | "texto"
  | "texto_longo"
  | "select"
  | "multi_select"
  | "escala_1_5"
  | "escala_1_10"
  | "data"
  | "checkbox"
  | "sim_nao"
  | "secao"
  | "arquivo"
  | "grid_disponibilidade";

/** Semântica de formato de um campo 'texto' (REALIZA-118) — o hint que
 *  liga a normalização da resposta na coleta pública (e-mail/WhatsApp/link
 *  chegam sujos do teclado e da planilha) e os atributos de teclado do
 *  input. E-mail de contato, WhatsApp e LinkedIn hoje são 'texto' puro:
 *  o builder marca o formato e o /f/<token> limpa na entrada. */
export type FormularioCampoFormato = "email" | "telefone" | "url";

export const FORMATO_VALIDOS: readonly FormularioCampoFormato[] = [
  "email",
  "telefone",
  "url",
];

export const CAMPO_FORMATO_LABEL: Record<FormularioCampoFormato, string> = {
  email: "E-mail",
  telefone: "Telefone/WhatsApp",
  url: "Link (URL)",
};

/** Erro amigável quando a resposta não vira o formato declarado — marcado
 *  no campo só quando ele é obrigatório (opcional irreconhecível simples-
 *  mente não é gravado: a submissão só morre por vazio de obrigatório). */
export const CAMPO_FORMATO_ERRO: Record<FormularioCampoFormato, string> = {
  email: "Confira o e-mail — parece que faltou um pedaço (ex.: nome@dominio.com).",
  telefone: "Confira o telefone — use DDD + número (ex.: 11 99999-8888).",
  url: "Confira o link — escreva o endereço (ex.: linkedin.com/in/seu-nome).",
};

/** Condição de exibição (REALIZA-70): o campo só aparece quando a
 *  resposta do campo `campo` — obrigatoriamente ANTERIOR na definição —
 *  casa com um dos valores de `em`. Fora da condição a pergunta não é
 *  enviada nem validada; o sanitizer da 0115 replica a regra no banco. */
export type VisibleIf = {
  campo: string;
  em: (string | number | boolean)[];
};

export type FormularioCampo = {
  id: string;
  tipo: FormularioCampoTipo;
  label: string;
  obrigatorio: boolean;
  /** só select/multi_select — 2+ opções */
  opcoes?: string[];
  /** em secao: texto de apoio sob o título (0080). Nos demais tipos:
   *  dica curta sob o rótulo da pergunta ("Até 3 hobbies") */
  descricao?: string;
  /** só texto (REALIZA-118) — semântica de formato da resposta */
  formato?: FormularioCampoFormato;
  /** só perguntas — renderiza/valida só com a condição satisfeita */
  visible_if?: VisibleIf;
  /** só select/multi_select — agrega a opção "Outro" com texto livre;
   *  a resposta serializa como "Outro: <texto>" (máx. 120 chars) */
  permite_outro?: boolean;
  /** só arquivo — mimes aceitos (default ARQUIVO_MIMES) */
  accept?: string[];
  /** só arquivo — teto em MB: 5, 10 ou 20 (default 10) */
  max_mb?: number;
};

/** Instrumento oficial do programa (0042, 0080) — vocabulário fechado
 *  espelhando o CHECK da coluna. null = form criado pela coordenação. */
export type FormularioSistema =
  | "avaliacao_360"
  | "avaliacao_especialista"
  | "visao"
  | "metas"
  | "pdm"
  | "roda_vida"
  | "intake_mentor"
  | "intake_mentorado"
  | "desfecho";

export const SISTEMA_LABEL: Record<FormularioSistema, string> = {
  avaliacao_360: "360º",
  avaliacao_especialista: "Avaliação da trilha",
  visao: "Visão",
  metas: "Metas",
  pdm: "PDM",
  roda_vida: "Roda da Vida",
  intake_mentor: "Inscrição de mentores",
  intake_mentorado: "Inscrição de mentorados",
  desfecho: "Depois da mentoria",
};

/** Instrumentos de trabalho da dupla (0080) — os 4 que o mentor "entrega"
 *  e o mentorado responde pelo link. Ordem de jornada (visão → metas →
 *  pdm → roda) é a da RPC instrumentos_da_dupla e da ficha da dupla. */
export const INSTRUMENTOS_SISTEMA = [
  "visao",
  "metas",
  "pdm",
  "roda_vida",
] as const satisfies readonly FormularioSistema[];

export type InstrumentoSistema = (typeof INSTRUMENTOS_SISTEMA)[number];

/** Sistemas da régua de instrumentos do programa (REALIZA-199): os 5 cujos
 *  cards moram na seção "Instrumentos do programa" de /materiais (194) —
 *  saíram da listagem de /formularios. As respostas/links seguem no
 *  /formularios/<id> de cada um (o card da régua faz deep-link). */
export const SISTEMAS_REGUA: readonly FormularioSistema[] = [
  "visao",
  "metas",
  "pdm",
  "roda_vida",
  "avaliacao_360",
];

/** Sistemas "de bordo" — oficiais que NÃO são a régua DPP: seguem
 *  acessíveis de /formularios na seção "Instrumentos do sistema"
 *  (read-only — catálogo imutável, sem builder). A ordem de exibição é a
 *  do ciclo de vida: inscrição → fechamentos da jornada. Um sistema novo
 *  que não estiver aqui nem na régua aparece no fim da seção (complemento
 *  defensivo — nunca fica órfão).
 *
 *  Anamnese Social e Autoavaliação saíram do programa (REALIZA-236): a
 *  leitura do ciclo é da 360º, que já pergunta disponibilidade pro próximo
 *  ciclo. As linhas ficaram no banco como histórico morto? Não — foram
 *  apagadas (0128); o vocabulário do CHECK segue com elas porque enum de
 *  texto não se encolhe sem recriar a constraint. */
export const SISTEMAS_BORDO: readonly FormularioSistema[] = [
  "intake_mentor",
  "intake_mentorado",
  "avaliacao_especialista",
  "desfecho",
];

/** Resumo de uma linha da ficha da dupla — o que o instrumento é e quando
 *  entra na jornada (guias DPP). */
export const INSTRUMENTO_INFO: Record<
  InstrumentoSistema,
  { titulo: string; resumo: string }
> = {
  visao: {
    titulo: "Construindo a sua Visão",
    resumo: "O exercício do 1º encontro — o filme da vida ideal vira a Declaração de Visão.",
  },
  metas: {
    titulo: "Definindo Minhas Metas",
    resumo: "Da visão pra 3–5 metas com o porquê de cada uma — a dupla revisa com o modelo SMART.",
  },
  pdm: {
    titulo: "PDM",
    resumo: "O documento central: visão, metas com indicador de sucesso e prazo, mapa de submetas.",
  },
  roda_vida: {
    titulo: "Roda da Vida",
    resumo: "Satisfação 1–10 nas 16 áreas da vida, a partir do 5º mês — o desenho vira a roda.",
  },
};

export type Formulario = {
  id: string;
  titulo: string;
  descricao: string | null;
  campos: FormularioCampo[];
  ativo: boolean;
  versao: number;
  /** Opcional no tipo: o dataset demo (src/lib/demo) ainda não carrega a
   *  coluna — forms de sistema chegam null/undefined lá. */
  sistema?: FormularioSistema | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FormularioLink = {
  id: string;
  formulario_id: string;
  token: string;
  dest_profile_id: string | null;
  dest_mentorado_id: string | null;
  dupla_id: string | null;
  contexto: Record<string, unknown>;
  usado_em: string | null;
  expira_em: string | null;
  /** link de campanha (0115): aceita N respostas anônimas, sem usado_em */
  multi_uso?: boolean;
  /** manual = destinatário específico; intake = divulgação pública */
  origem?: "manual" | "intake";
  created_by: string | null;
  created_at: string;
};

export type FormularioResposta = {
  id: string;
  link_id: string;
  /** {campo_id: valor} — só chaves declaradas; a RPC saneou no envio */
  respostas: Record<string, RespostaValor>;
  respondido_em: string;
  /** carimbo da promoção (0115): a resposta de intake virou cadastro */
  promovido_profile_id?: string | null;
};

/** upload resolvido por form_anexo_put + storage — path é o nome do
 *  objeto no bucket form-anexos ("<link_id>/<uuid>.<ext>") */
export type RespostaArquivo = {
  path: string;
  nome: string;
  tamanho: number;
};

/** grade de disponibilidade: `celulas` é o canônico {dia, periodo} da
 *  0100 (o que matching/perfil consomem sem adaptador); `horas` preserva
 *  a marcação verbatim seg–sex × 09h–19h pra leitura da coordenação */
export type RespostaGrid = {
  celulas: { dia: string; periodo: string }[];
  horas?: { dia: string; hora: number }[];
};

/** Valor de uma resposta conforme o tipo do campo — a RPC
 *  formularios_limpa_respostas garante o formato. */
export type RespostaValor =
  | string
  | number
  | boolean
  | string[]
  | RespostaArquivo
  | RespostaGrid;

// ---------- labels & constantes ----------

export const CAMPO_TIPO_LABEL: Record<FormularioCampoTipo, string> = {
  texto: "Texto curto",
  texto_longo: "Texto longo",
  select: "Lista de opções",
  multi_select: "Múltipla escolha",
  escala_1_5: "Escala de 1 a 5",
  escala_1_10: "Escala de 1 a 10",
  data: "Data",
  checkbox: "Caixa de confirmação",
  sim_nao: "Sim ou não",
  secao: "Seção (rótulo de estrutura)",
  arquivo: "Arquivo (upload)",
  grid_disponibilidade: "Grade de disponibilidade",
};

/** Allowlist de upload do campo 'arquivo' (0115) — PDF + imagens de
 *  documento. Executáveis e svg ficam fora por construção (o mime
 *  precisa estar na lista pra o RPC form_anexo_put aceitar). */
export const ARQUIVO_MIMES: readonly string[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
export const ARQUIVO_EXT_PROIBIDAS: readonly string[] = ["exe", "svg"];
export const ARQUIVO_MAX_MB_OPCOES = [5, 10, 20] as const;
export const ARQUIVO_MAX_MB = 10;

/** Tipos que usam `opcoes` no builder e validam contra a lista no envio. */
export const TIPOS_COM_OPCOES: readonly FormularioCampoTipo[] = [
  "select",
  "multi_select",
];

/** Tipos que não esperam resposta (0080) — 'secao' é rótulo de estrutura
 *  (título + descrição). Fora da contagem de perguntas, do progresso, da
 *  validação e da agregação; a RPC de envio ignora o id por completo. */
export const TIPOS_SEM_RESPOSTA: readonly FormularioCampoTipo[] = ["secao"];

/** Só os campos que são pergunta de verdade — numeração, contagem e
 *  progresso do /f/<token> ignoram seções. */
export function camposPerguntas(campos: FormularioCampo[]): FormularioCampo[] {
  return campos.filter((c) => !TIPOS_SEM_RESPOSTA.includes(c.tipo));
}

/** Formato declarado de um campo 'texto' — null nos demais tipos e em
 *  texto livre (a normalização só roda com hint explícito: inferir de
 *  rótulo classificaria errado perguntas de prosa). */
export function campoFormato(
  c: FormularioCampo
): FormularioCampoFormato | null {
  return c.tipo === "texto" ? (c.formato ?? null) : null;
}

export const MAX_CAMPOS = 40;
export const MAX_OPCOES = 30;

// ---------- status do link ----------

export type LinkStatus = "pendente" | "respondido" | "expirado";

export function linkStatus(
  link: Pick<FormularioLink, "usado_em" | "expira_em">,
  agora = new Date()
): LinkStatus {
  if (link.usado_em) return "respondido";
  if (link.expira_em && new Date(link.expira_em).getTime() < agora.getTime())
    return "expirado";
  return "pendente";
}

export const LINK_STATUS_LABEL: Record<LinkStatus, string> = {
  pendente: "Pendente",
  respondido: "Respondido",
  expirado: "Expirado",
};

// ---------- validação da definição (builder → action) ----------

const TIPOS_VALIDOS = new Set<string>([
  "texto",
  "texto_longo",
  "select",
  "multi_select",
  "escala_1_5",
  "escala_1_10",
  "data",
  "checkbox",
  "sim_nao",
  "secao",
  "arquivo",
  "grid_disponibilidade",
]);

/** Valida a lista de campos vinda do builder. Devolve a definição limpa
 *  (labels com trim, ids dedupados, opcoes saneadas) ou { error } — a action
 *  confia só nisto, nunca no JSON cru do client. */
export function validaCampos(input: unknown): FormularioCampo[] | { error: string } {
  if (!Array.isArray(input)) return { error: "Formato de perguntas inválido." };
  if (input.length === 0)
    return { error: "Adicione pelo menos uma pergunta." };
  if (input.length > MAX_CAMPOS)
    return { error: `Um formulário pode ter até ${MAX_CAMPOS} perguntas.` };

  const ids = new Set<string>();
  const campos: FormularioCampo[] = [];
  for (let i = 0; i < input.length; i++) {
    const c = input[i] as Record<string, unknown> | null;
    const n = i + 1;
    const id = typeof c?.id === "string" ? c.id.trim() : "";
    if (!id || id.length > 60 || ids.has(id))
      return { error: `Identificador da pergunta ${n} é inválido ou repetido.` };
    const tipo = typeof c?.tipo === "string" ? c.tipo : "";
    if (!TIPOS_VALIDOS.has(tipo))
      return { error: `Tipo inválido na pergunta ${n}.` };
    const label = typeof c?.label === "string" ? c.label.trim() : "";
    if (!label)
      return {
        error:
          tipo === "secao"
            ? `Escreva o título da seção ${n}.`
            : `Escreva o texto da pergunta ${n}.`,
      };
    if (label.length > 200)
      return { error: `O texto da pergunta ${n} passa de 200 caracteres.` };
    // secao não espera resposta — "obrigatória" num rótulo de estrutura
    // criaria um form impossível de enviar (a RPC ignora o campo)
    const obrigatorio = tipo === "secao" ? false : c?.obrigatorio === true;

    const campo: FormularioCampo = {
      id,
      tipo: tipo as FormularioCampoTipo,
      label,
      obrigatorio,
    };
    // formato só existe no tipo 'texto' — valor fora do vocabulário é
    // erro de definição; em outro tipo é ignorado (não tem efeito)
    if (tipo === "texto" && typeof c?.formato === "string" && c.formato.trim()) {
      const f = c.formato.trim();
      if (!(FORMATO_VALIDOS as readonly string[]).includes(f))
        return { error: `Formato inválido na pergunta ${n}.` };
      campo.formato = f as FormularioCampoFormato;
    }
    if (tipo === "secao") {
      const desc = typeof c?.descricao === "string" ? c.descricao.trim() : "";
      if (desc.length > 1000)
        return { error: `O texto da seção ${n} passa de 1.000 caracteres.` };
      if (desc) campo.descricao = desc;
    } else if (typeof c?.descricao === "string" && c.descricao.trim()) {
      // dica curta sob o rótulo (intake) — fora de secao fica em 200
      const desc = c.descricao.trim();
      if (desc.length > 200)
        return { error: `A dica da pergunta ${n} passa de 200 caracteres.` };
      campo.descricao = desc;
    }
    if (TIPOS_COM_OPCOES.includes(campo.tipo)) {
      const brutas = Array.isArray(c?.opcoes) ? c.opcoes : [];
      const vistas = new Set<string>();
      const opcoes: string[] = [];
      for (const o of brutas) {
        const t = String(o).trim();
        if (!t || t.length > 120) continue;
        const k = t.toLocaleLowerCase("pt-BR");
        if (vistas.has(k)) continue;
        vistas.add(k);
        opcoes.push(t);
      }
      if (opcoes.length < 2)
        return { error: `A pergunta "${label}" precisa de pelo menos 2 opções.` };
      if (opcoes.length > MAX_OPCOES)
        return { error: `A pergunta "${label}" passa de ${MAX_OPCOES} opções.` };
      campo.opcoes = opcoes;
      // "Outro" com texto livre só faz sentido onde há lista de opções
      if (c?.permite_outro === true) campo.permite_outro = true;
    }
    // arquivo: allowlist de mimes e teto de tamanho — fora do vocabulário
    // fecha por construção (a definição é a whitelist do upload anônimo)
    if (campo.tipo === "arquivo") {
      const mimes = Array.isArray(c?.accept) ? c.accept : [];
      const limpos = mimes
        .map((m) => String(m).trim())
        .filter((m) => ARQUIVO_MIMES.includes(m));
      if (mimes.length && limpos.length !== mimes.length)
        return { error: `Tipo de arquivo não aceito na pergunta ${n}.` };
      if (limpos.length) campo.accept = limpos;
      const mb = c?.max_mb;
      if (mb != null) {
        const n2 = typeof mb === "string" ? Number(mb) : mb;
        if (
          typeof n2 !== "number" ||
          !(ARQUIVO_MAX_MB_OPCOES as readonly number[]).includes(n2)
        )
          return { error: `Tamanho máximo inválido na pergunta ${n}.` };
        campo.max_mb = n2;
      }
    }
    // pergunta condicional: o gatilho é um campo já definido (referência
    // sempre pra trás) de tipo com resposta discreta — texto livre ou o
    // próprio campo como gatilho seriam condição impossível de cumprir
    if (c?.visible_if != null) {
      const vi = c.visible_if as Record<string, unknown> | null;
      const ref = typeof vi?.campo === "string" ? vi.campo.trim() : "";
      const em = Array.isArray(vi?.em) ? vi.em : [];
      const alvo = campos.find((x) => x.id === ref);
      const TIPOS_GATILHO = new Set([
        "select",
        "multi_select",
        "sim_nao",
        "checkbox",
        "escala_1_5",
        "escala_1_10",
      ]);
      if (
        !ref ||
        !alvo ||
        !TIPOS_GATILHO.has(alvo.tipo) ||
        !em.length ||
        em.some(
          (v) => !["string", "number", "boolean"].includes(typeof v)
        )
      )
        return { error: `Condição inválida na pergunta ${n}.` };
      campo.visible_if = { campo: ref, em: em as VisibleIf["em"] };
    }
    ids.add(id);
    campos.push(campo);
  }
  return campos;
}

/** O campo aparece com as respostas atuais? Sem visible_if, sempre. A
 *  regra espelha o sanitizer da 0115: a resposta do gatilho casa com um
 *  dos valores de `em` (array de resposta em multi_select vale se
 *  CONTÉM algum valor da condição). */
export function visivel(
  campo: FormularioCampo,
  respostas: Record<string, RespostaValor | undefined>
): boolean {
  const vi = campo.visible_if;
  if (!vi) return true;
  const v = respostas[vi.campo];
  if (v == null) return false;
  return vi.em.some((e) =>
    Array.isArray(v) ? v.some((x) => x === e) : v === e
  );
}

// ---------- leitura de respostas ----------

/** Valor formatado pra exibição (aba Respostas e expansão do link). */
export function respostaFormatada(
  campo: FormularioCampo | undefined,
  valor: RespostaValor | undefined
): string {
  if (valor == null) return "—";
  const tipo = campo?.tipo;
  if (tipo === "sim_nao")
    return valor === "sim" ? "Sim" : valor === "nao" ? "Não" : String(valor);
  if (tipo === "checkbox") return valor === true ? "Confirmado" : "Não marcado";
  if (tipo === "escala_1_5") return `${valor}/5`;
  if (tipo === "escala_1_10") return `${valor}/10`;
  if (tipo === "data") {
    const d = new Date(`${valor}T12:00:00-03:00`);
    return isNaN(d.getTime())
      ? String(valor)
      : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  if (tipo === "arquivo") {
    // {path, nome, tamanho} — exibe o nome do arquivo; o download sai
    // por /api/form-anexo/<id> na UI (aqui só o texto, que vai pro CSV)
    const a = valor as RespostaArquivo;
    return a?.nome ? a.nome : "—";
  }
  if (tipo === "grid_disponibilidade") {
    const g = valor as RespostaGrid;
    const horas = g?.horas ?? [];
    if (horas.length) {
      const lista = horas
        .map((h) => `${h.dia} ${String(h.hora).padStart(2, "0")}h`)
        .join("; ");
      return `${horas.length} horário${horas.length === 1 ? "" : "s"} · ${lista}`;
    }
    const cel = g?.celulas ?? [];
    return cel.length
      ? `${cel.length} faixa${cel.length === 1 ? "" : "s"} · ` +
          cel.map((c) => `${c.dia} ${c.periodo}`).join("; ")
      : "—";
  }
  if (Array.isArray(valor)) return valor.join(", ");
  if (valor != null && typeof valor === "object") return "—";
  return String(valor);
}

// ---------- agregação por campo ----------

export type AgregadoCampo = {
  campo: FormularioCampo;
  /** quantas das respostas recebidas cobrem este campo (opcionais podem
   *  ter menos que o total — o resumo exibe "N de M responderam") */
  respondidas: number;
  /** escala_1_5: média com 1 casa; demais: null */
  media: number | null;
  /** escala_1_5: notas 1–5 · sim_nao: {Sim, Não} · checkbox: {Sim, Não
   *  marcado} · select/multi_select: contagem por opção. Vazio nos tipos
   *  de leitura individual (itens carrega a resposta). */
  contagens: { rotulo: string; n: number }[];
  /** texto/texto_longo/data: cada resposta formatada com a autoria — a
   *  vista "por pergunta" dentro do resumo (o domínio precisa de quem
   *  escreveu, ex.: pedido de apoio). Vazio nos tipos agregados. */
  itens: { autor: string; valor: string }[];
};

/** Tipos cujo resumo é a lista de respostas individuais, não contagem. */
export const TIPOS_LISTA_RESPOSTA: readonly FormularioCampoTipo[] = [
  "texto",
  "texto_longo",
  "data",
  "arquivo",
  "grid_disponibilidade",
];

/** Entrada da agregação: o mapa de respostas + quem respondeu (o resumo
 *  por pergunta mostra a autoria ao lado de cada texto). */
export type RespostaComAutor = {
  autor: string;
  respostas: Record<string, RespostaValor>;
};

/** Agrega as respostas de um form por campo — todos os tipos entram:
 *  escala vira média + distribuição, sim_nao/checkbox/opções viram
 *  contagens, texto/data viram lista com autor (na ordem recebida). */
export function agregaRespostas(
  campos: FormularioCampo[],
  respostas: RespostaComAutor[]
): AgregadoCampo[] {
  const agregados: AgregadoCampo[] = [];
  for (const campo of campos) {
    // rótulo de estrutura não tem resposta — nem entra na agregação
    if (TIPOS_SEM_RESPOSTA.includes(campo.tipo)) continue;
    const entradas = respostas
      .filter((r) => r.respostas[campo.id] != null)
      .map((r) => ({ autor: r.autor, valor: r.respostas[campo.id] }));
    const ag: AgregadoCampo = {
      campo,
      respondidas: entradas.length,
      media: null,
      contagens: [],
      itens: [],
    };
    if (TIPOS_LISTA_RESPOSTA.includes(campo.tipo)) {
      // lista individual: data sai dd/mm/aaaa via respostaFormatada;
      // resposta em branco (opcional) não entra na lista nem na contagem
      ag.itens = entradas
        .map((e) => ({
          autor: e.autor,
          valor: respostaFormatada(campo, e.valor),
        }))
        .filter((e) => e.valor.trim().length > 0);
      ag.respondidas = ag.itens.length;
    } else if (campo.tipo === "escala_1_5" || campo.tipo === "escala_1_10") {
      const teto = campo.tipo === "escala_1_5" ? 5 : 10;
      const nums = entradas
        .map((e) => e.valor)
        .filter((v): v is number => typeof v === "number");
      if (nums.length)
        ag.media =
          Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
      ag.contagens = Array.from({ length: teto }, (_, i) => i + 1).map(
        (n) => ({
          rotulo: String(n),
          n: nums.filter((v) => v === n).length,
        })
      );
    } else if (campo.tipo === "sim_nao") {
      const valores = entradas.map((e) => e.valor);
      ag.contagens = [
        { rotulo: "Sim", n: valores.filter((v) => v === "sim").length },
        { rotulo: "Não", n: valores.filter((v) => v === "nao").length },
      ];
    } else if (campo.tipo === "checkbox") {
      const valores = entradas.map((e) => e.valor);
      ag.contagens = [
        { rotulo: "Sim", n: valores.filter((v) => v === true).length },
        // qualquer valor presente que não seja `true` conta como não
        // marcado (a RPC saneia pra boolean — `false` cai aqui)
        { rotulo: "Não marcado", n: valores.filter((v) => v !== true).length },
      ];
    } else {
      // select / multi_select: conta cada opção declarada (+ exóticas de
      // respostas a versões antigas, agrupadas como "outros")
      const cont = new Map<string, number>();
      let outros = 0;
      for (const e of entradas) {
        const v = e.valor;
        const itens = Array.isArray(v) ? v : [v];
        for (const item of itens) {
          const s = String(item);
          if (campo.opcoes?.includes(s))
            cont.set(s, (cont.get(s) ?? 0) + 1);
          else outros++;
        }
      }
      ag.contagens = (campo.opcoes ?? []).map((o) => ({
        rotulo: o,
        n: cont.get(o) ?? 0,
      }));
      if (outros) ag.contagens.push({ rotulo: "Outros", n: outros });
    }
    agregados.push(ag);
  }
  return agregados;
}

// ---------- leitura estruturada dos instrumentos (0080) ----------
// Os instrumentos oficiais usam convenções de id/tipo em vez de tipos de
// campo dedicados: a 'secao' que precede um grupo de escala_1_10 é o
// quadrante da Roda da Vida; metas são meta_N + is_N + prazo_N (PDM) ou
// meta_N + porque_N (Definindo Metas). Os extratores abaixo transformam
// respostas cruas ({campo_id: valor}) no dado aproveitável da ficha.

export type RodaArea = {
  id: string;
  label: string;
  /** null quando a área ficou sem nota (resposta parcial) */
  nota: number | null;
};

export type RodaQuadrante = {
  /** label da 'secao' que abre o grupo; "Geral" se a escala vier órfã */
  nome: string;
  areas: RodaArea[];
};

export type RodaDaVida = {
  quadrantes: RodaQuadrante[];
  /** média das áreas respondidas, 1 casa — null sem nenhuma nota */
  media: number | null;
  respondidas: number;
  total: number;
};

/** Monta a roda a partir dos campos escala_1_10 na ordem do instrumento.
 *  Devolve null quando o form não tem nenhuma escala 1–10 — ou seja, não
 *  é uma roda (chamador decide o fallback). */
export function extraiRodaDaVida(
  campos: FormularioCampo[],
  respostas: Record<string, RespostaValor>
): RodaDaVida | null {
  const quadrantes: RodaQuadrante[] = [];
  let atual: RodaQuadrante | null = null;
  for (const c of campos) {
    if (c.tipo === "secao") {
      atual = { nome: c.label, areas: [] };
      quadrantes.push(atual);
      continue;
    }
    if (c.tipo !== "escala_1_10") continue;
    // escala antes de qualquer seção cai num grupo sem nome — a roda
    // oficial sempre abre quadrante com 'secao'
    if (!atual) {
      atual = { nome: "", areas: [] };
      quadrantes.push(atual);
    }
    const v = respostas[c.id];
    atual.areas.push({
      id: c.id,
      label: c.label,
      nota: typeof v === "number" ? v : null,
    });
  }
  const areas = quadrantes.flatMap((q) => q.areas);
  if (!areas.length) return null;
  const notas = areas
    .map((a) => a.nota)
    .filter((n): n is number => typeof n === "number");
  return {
    quadrantes: quadrantes.filter((q) => q.areas.length > 0),
    media: notas.length
      ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10
      : null,
    respondidas: notas.length,
    total: areas.length,
  };
}

export type MetaExtraida = {
  n: number;
  meta: string;
  /** indicador de sucesso (PDM) — "" sem resposta */
  indicador: string;
  /** ISO date (PDM) — null sem resposta */
  prazo: string | null;
  /** porquê (Definindo Metas) — "" sem resposta */
  porque: string;
};

const META_RE = /^meta_(\d+)$/;

/** Agrupa os campos meta_N/is_N/prazo_N/porque_N em metas respondidas —
 *  meta vazia não entra (os opcionais 4–5 do Definindo Metas ficam fora
 *  até serem usados). Ordenada pelo número da meta. */
export function extraiMetas(
  campos: FormularioCampo[],
  respostas: Record<string, RespostaValor>
): MetaExtraida[] {
  const porN = new Map<number, MetaExtraida>();
  for (const c of campos) {
    const m = META_RE.exec(c.id);
    if (!m) continue;
    const v = respostas[c.id];
    if (typeof v !== "string" || !v.trim()) continue;
    const n = Number(m[1]);
    const atual = porN.get(n) ?? {
      n,
      meta: "",
      indicador: "",
      prazo: null,
      porque: "",
    };
    atual.meta = v.trim();
    porN.set(n, atual);
  }
  // subcampos da meta: is_N, prazo_N, porque_N (e submetas_N do PDM não
  // entra aqui — desdobramento é leitura textual, não meta acompanhável)
  for (const c of campos) {
    const g = /^(is|prazo|porque)_(\d+)$/.exec(c.id);
    if (!g) continue;
    const n = Number(g[2]);
    const atual = porN.get(n);
    if (!atual) continue;
    const v = respostas[c.id];
    if (typeof v !== "string" || !v.trim()) continue;
    if (g[1] === "is") atual.indicador = v.trim();
    else if (g[1] === "prazo") atual.prazo = v.trim();
    else atual.porque = v.trim();
  }
  return [...porN.values()].sort((a, b) => a.n - b.n);
}
