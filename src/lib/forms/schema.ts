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
  | "data"
  | "checkbox"
  | "sim_nao";

export type FormularioCampo = {
  id: string;
  tipo: FormularioCampoTipo;
  label: string;
  obrigatorio: boolean;
  /** só select/multi_select — 2+ opções */
  opcoes?: string[];
};

/** Instrumento oficial do programa (0042) — vocabulário fechado espelhando
 *  o CHECK da coluna. null = form criado pela coordenação. */
export type FormularioSistema =
  | "anamnese"
  | "avaliacao_360"
  | "autoavaliacao_mentor";

export const SISTEMA_LABEL: Record<FormularioSistema, string> = {
  anamnese: "Anamnese",
  avaliacao_360: "360º",
  autoavaliacao_mentor: "Autoavaliação",
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
  created_by: string | null;
  created_at: string;
};

export type FormularioResposta = {
  id: string;
  link_id: string;
  /** {campo_id: valor} — só chaves declaradas; a RPC saneou no envio */
  respostas: Record<string, RespostaValor>;
  respondido_em: string;
};

/** Valor de uma resposta conforme o tipo do campo — a RPC
 *  formularios_limpa_respostas garante o formato. */
export type RespostaValor = string | number | boolean | string[];

// ---------- labels & constantes ----------

export const CAMPO_TIPO_LABEL: Record<FormularioCampoTipo, string> = {
  texto: "Texto curto",
  texto_longo: "Texto longo",
  select: "Lista de opções",
  multi_select: "Múltipla escolha",
  escala_1_5: "Escala de 1 a 5",
  data: "Data",
  checkbox: "Caixa de confirmação",
  sim_nao: "Sim ou não",
};

/** Tipos que usam `opcoes` no builder e validam contra a lista no envio. */
export const TIPOS_COM_OPCOES: readonly FormularioCampoTipo[] = [
  "select",
  "multi_select",
];

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
  "data",
  "checkbox",
  "sim_nao",
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
    if (!label) return { error: `Escreva o texto da pergunta ${n}.` };
    if (label.length > 200)
      return { error: `O texto da pergunta ${n} passa de 200 caracteres.` };
    const obrigatorio = c?.obrigatorio === true;

    const campo: FormularioCampo = {
      id,
      tipo: tipo as FormularioCampoTipo,
      label,
      obrigatorio,
    };
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
    }
    ids.add(id);
    campos.push(campo);
  }
  return campos;
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
  if (tipo === "data") {
    const d = new Date(`${valor}T12:00:00-03:00`);
    return isNaN(d.getTime())
      ? String(valor)
      : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  if (Array.isArray(valor)) return valor.join(", ");
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
    } else if (campo.tipo === "escala_1_5") {
      const nums = entradas
        .map((e) => e.valor)
        .filter((v): v is number => typeof v === "number");
      if (nums.length)
        ag.media =
          Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
      ag.contagens = [1, 2, 3, 4, 5].map((n) => ({
        rotulo: String(n),
        n: nums.filter((v) => v === n).length,
      }));
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
