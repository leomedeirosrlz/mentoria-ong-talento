import { DEMO_MSG, demoRoleClient } from "./shared";
import { getDemoData } from "./data";
import {
  demoAssinaturaCompletaPorToken,
  demoAssinaturaPorToken,
  demoFormularioPorToken,
} from "./queries";
import { getDemoFormularios } from "./forms-data";
import { normaliza } from "../utils";
import type { AppRole } from "../types";

// Client Supabase falso pro modo demo — roda no browser. Componentes chamam
// createClient() de @/lib/supabase/client e, com o cookie demo_role ativo,
// recebem este objeto: leituras resolvem sobre o dataset fixo de ./data e
// TODA escrita (insert/update/delete/upsert, storage, rpc) falha com
// DEMO_MSG — a demo é navegável de verdade sem gravar nada.
//
// Escopo: aplica eq/in/is/order/limit de verdade; o recorte por papel do
// servidor não se repete aqui (quem já tem o cookie vê o dataset local —
// não é fronteira de segurança, é demonstração).

type Linha = Record<string, unknown>;
type ErroDemo = { message: string; code: string };
type Resultado = { data: unknown; error: ErroDemo | null; count: number | null };

const ERRO_DEMO: ErroDemo = { message: DEMO_MSG, code: "DEMO" };

function campo(l: Linha, col: string): unknown {
  return col
    .split(".")
    .reduce<unknown>(
      (acc, k) =>
        acc != null && typeof acc === "object"
          ? (acc as Linha)[k]
          : undefined,
      l
    );
}

/** Split por vírgula fora de parênteses — embeds `tabela(col, sub)` têm
 *  vírgula dentro do parêntese e não podem quebrar a lista. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

const EMBED_RE =
  /^(?:(\w+)\s*:\s*)?(\w+)(?:!(\w+))?(?:!(?:inner|left))?\s*\(([^)]*)\)$/;

type EmbedSpec = {
  /** chave que entra na linha (alias ou nome da tabela) */
  alias: string;
  /** tabela referenciada (profiles, mentorados...) */
  tabela: string;
  /** nome da constraint `origem_coluna_fkey`, quando informada */
  fkey: string | null;
  /** subselect dentro do parêntese ("id, nome" ou "*") */
  sub: string;
};

function parseEmbed(parte: string): EmbedSpec | null {
  const m = parte.match(EMBED_RE);
  if (!m) return null;
  return {
    alias: m[1] ?? m[2],
    tabela: m[2],
    fkey: m[3] ?? null,
    sub: m[4],
  };
}

/** Linhas de cada "tabela" derivadas do dataset fixo. A árvore de duplas é
 *  achatada pra encontros/registros/encaminhamentos/notas — os dialogs leem
 *  essas tabelas como se fosse PostgREST. */
function linhas(tabela: string, papel: AppRole | null): Linha[] {
  const d = getDemoData();
  switch (tabela) {
    case "profiles":
      return d.profiles as unknown as Linha[];
    case "profiles_contato":
      // a view de contato sem escopo — demo: serve tudo (ver comentário no topo)
      return d.profiles.map((p) => ({
        id: p.id,
        email: p.email,
        whatsapp: p.whatsapp,
        documento_path: p.documento_path ?? null,
      }));
    case "profiles_pessoal":
      // view coord-only dos sensíveis (0034) — no real só a coordenação
      // recebe linhas; aqui o dataset serve direto (mesma linha do contato)
      return d.profiles.map((p) => ({
        id: p.id,
        data_nascimento: p.data_nascimento ?? null,
        genero: p.genero ?? null,
        pref_genero_par: p.pref_genero_par ?? null,
        motivacao: p.motivacao ?? null,
      }));
    case "mentorados_pessoal":
      return d.mentorados.map((m) => ({
        id: m.id,
        data_nascimento: m.data_nascimento ?? null,
        genero: m.genero ?? null,
        pref_genero_par: m.pref_genero_par ?? null,
        motivacao: m.motivacao ?? null,
      }));
    case "mentorados":
      return d.mentorados as unknown as Linha[];
    case "mentor_profiles":
      return d.mentorProfiles as unknown as Linha[];
    case "duplas":
      // os dialogs leem as colunas cruas de FK (mentor_id etc.) — o tipo Dupla
      // só declara os embeds, então deriva quando a coluna não veio no dataset
      return d.duplas.map((x) => {
        const l = x as unknown as Linha;
        return {
          ...l,
          mentor_id: l.mentor_id ?? x.mentor?.id ?? null,
          mentorado_id: l.mentorado_id ?? x.mentorado?.id ?? null,
          supervisor_id: l.supervisor_id ?? x.supervisor?.id ?? null,
        };
      });
    case "encontros":
      return d.duplas.flatMap((x) =>
        (x.encontros ?? []).map((e) => ({
          ...(e as unknown as Linha),
          dupla_id: e.dupla_id ?? x.id,
        }))
      );
    case "registros":
      return d.duplas.flatMap((x) =>
        (x.encontros ?? []).flatMap((e) =>
          e.registro
            ? [
                {
                  ...(e.registro as unknown as Linha),
                  encontro_id: e.registro.encontro_id ?? e.id,
                },
              ]
            : []
        )
      );
    case "encaminhamentos":
      return d.duplas.flatMap(
        (x) => (x.encaminhamentos ?? []) as unknown as Linha[]
      );
    case "encontro_notas":
      return d.duplas.flatMap((x) => (x.notas ?? []) as unknown as Linha[]);
    case "registro_anexos":
      return d.anexos as unknown as Linha[];
    case "materiais":
      return d.materiais as unknown as Linha[];
    case "comunicados":
      return d.comunicados as unknown as Linha[];
    case "notificacoes":
      return papel ? ((d.notificacoes[papel] ?? []) as unknown as Linha[]) : [];
    case "cronogramas":
      return d.cronogramas as unknown as Linha[];
    case "ciclo_eventos":
      return d.cicloEventos as unknown as Linha[];
    case "especialista_eventos":
      return d.especialistaEventos as unknown as Linha[];
    case "interacoes":
      return d.interacoes as unknown as Linha[];
    case "pessoa_notas":
      return d.pessoaNotas as unknown as Linha[];
    case "solicitacoes_especialista":
    case "solicitacoes_mural":
      // a view 0030 adiciona mentorado_nome plano — resolve do cadastro
      return d.solicitacoes.map((s) => ({
        ...(s as unknown as Linha),
        mentorado_nome:
          d.mentorados.find((m) => m.id === s.mentorado_id)?.nome ?? null,
      }));
    case "documento_templates":
      return d.documentoTemplates as unknown as Linha[];
    case "assinaturas":
      // o embed `template` já vem montado nas linhas; quando um select pede
      // `template:documento_templates(...)` e a linha não o tem, o fallback
      // por `template_id` (alias_id) resolve contra a tabela acima
      return d.assinaturas as unknown as Linha[];
    case "presencas":
      return d.presencas as unknown as Linha[];
    case "supervisoes":
      // supervisor/mentor/dupla já vêm embutidos nas linhas da fixture —
      // o resolveEmbed devolve `jaTem` ou resolve pela coluna _id
      return d.supervisoes as unknown as Linha[];
    case "formularios":
      return getDemoFormularios().formularios as unknown as Linha[];
    case "formulario_links":
      // `resposta` não resolve por FK nem por <origem>_id — a resposta
      // aponta pro link (link_id). Já sai embutida, como o embed do select
      // real devolveria (to-one por unique(link_id)).
      return getDemoFormularios().links.map((l) => ({
        ...(l as unknown as Linha),
        resposta:
          (getDemoFormularios().respostas.find(
            (r) => r.link_id === l.id
          ) as unknown as Linha | undefined) ?? null,
      }));
    case "formulario_respostas":
      return getDemoFormularios().respostas as unknown as Linha[];
    default:
      return [];
  }
}

/** Projeta o subselect do embed ("id, nome" / "*") sobre a linha achada;
 *  embeds aninhados já vêm prontos no dataset — copia o que existir. */
function projetaAlvo(linha: Linha, sub: string): Linha {
  if (sub.trim() === "*") return linha;
  const out: Linha = {};
  for (const parte of splitTop(sub)) {
    const emb = parseEmbed(parte);
    if (emb) {
      out[emb.alias] = linha[emb.alias] ?? null;
      continue;
    }
    const m = parte.match(/^(?:(\w+)\s*:\s*)?(\w+)$/);
    if (m) out[m[1] ?? m[2]] = linha[m[2]];
  }
  return out;
}

/** Resolve `alias:tabela!fk(cols)` — o dataset já embute os relacionamentos
 *  usados pela UI (autor, mentor...); quando falta, tenta a coluna FK pelo
 *  nome da constraint e por heurística, e por fim o lado to-many. */
function resolveEmbed(
  linha: Linha,
  spec: EmbedSpec,
  tabelaOrigem: string,
  papel: AppRole | null
): unknown {
  const jaTem = linha[spec.alias];
  if (jaTem != null) return jaTem;
  const deFkey = spec.fkey
    ? spec.fkey
        .replace(new RegExp(`^${tabelaOrigem}_`), "")
        .replace(/_fkey$/, "")
    : null;
  const candidatos = [
    deFkey,
    `${spec.alias}_id`,
    `${spec.tabela.replace(/s$/, "")}_id`,
    "created_by",
    "autor_id",
    "profile_id",
    "user_id",
  ].filter((c): c is string => Boolean(c));
  for (const c of candidatos) {
    const v = linha[c];
    if (typeof v === "string" && v) {
      const alvo = linhas(spec.tabela, papel).find((r) => r.id === v);
      // FK preenchida sem linha correspondente -> embed to-one vira null,
      // como no PostgREST
      return alvo ? projetaAlvo(alvo as Linha, spec.sub) : null;
    }
  }
  // to-many: filhas que apontam pra origem ("duplas" -> "dupla_id")
  const chavePai = `${tabelaOrigem.replace(/s$/, "")}_id`;
  return linhas(spec.tabela, papel)
    .filter((r) => r[chavePai] === linha.id)
    .map((f) => projetaAlvo(f, spec.sub));
}

/** A linha volta inteira (select do app é subset de colunas já presentes);
 *  só os embeds pedidos e ausentes são resolvidos. */
function projeta(linha: Linha, cols: string | undefined, tabela: string, papel: AppRole | null): Linha {
  if (!cols) return linha;
  const out = { ...linha };
  for (const parte of splitTop(cols)) {
    const spec = parseEmbed(parte);
    if (!spec) continue;
    out[spec.alias] = resolveEmbed(linha, spec, tabela, papel);
  }
  return out;
}

function valorTermo(raw: string): unknown {
  const v = raw.trim();
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return v.replace(/^"|"$/g, "");
}

/** Um termo de `.or()` no formato PostgREST `col.op.valor`. */
function termo(t: string): ((l: Linha) => boolean) | null {
  const m = t.trim().match(/^([\w.]+)\.(\w+)\.(.+)$/);
  if (!m) return null;
  const [, col, op, raw] = m;
  const val = valorTermo(raw);
  switch (op) {
    case "eq":
      return (l) => campo(l, col) === val;
    case "neq":
      return (l) => campo(l, col) != null && campo(l, col) !== val;
    case "is":
      return (l) =>
        val == null ? campo(l, col) == null : campo(l, col) === val;
    case "in": {
      const set = new Set(
        raw.replace(/^\(|\)$/g, "").split(",").map((s) => String(valorTermo(s)))
      );
      return (l) => set.has(String(campo(l, col)));
    }
    case "like":
    case "ilike": {
      const needle = String(raw).replace(/%/g, "");
      return (l) => {
        const v = campo(l, col);
        if (typeof v !== "string") return false;
        return op === "ilike"
          ? normaliza(v).includes(normaliza(needle))
          : v.includes(needle);
      };
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return (l) => compara(campo(l, col), val, op);
    default:
      return null;
  }
}

function compara(c: unknown, v: unknown, op: "gt" | "gte" | "lt" | "lte"): boolean {
  if ((typeof c !== "string" && typeof c !== "number") || typeof c !== typeof v)
    return false;
  const a = c as number;
  const b = v as number;
  return op === "gt" ? a > b : op === "gte" ? a >= b : op === "lt" ? a < b : a <= b;
}

/** Builder thenable — `await supabase.from(t).select(...)` e
 *  `.then(({ data }) => ...)` resolvem `{ data, error }` como o PostgREST. */
class ConsultaDemo implements PromiseLike<Resultado> {
  private linhasAtuais: Linha[];
  private erro: ErroDemo | null = null;
  private unico: "single" | "maybe" | null = null;

  constructor(
    linhasIniciais: Linha[],
    private tabela: string,
    private papel: AppRole | null
  ) {
    this.linhasAtuais = linhasIniciais;
  }

  private filtra(f: (l: Linha) => boolean): this {
    if (this.erro) return this;
    this.linhasAtuais = this.linhasAtuais.filter(f);
    return this;
  }

  select(cols?: string): this {
    if (this.erro) return this;
    this.linhasAtuais = this.linhasAtuais.map((l) =>
      projeta(l, cols, this.tabela, this.papel)
    );
    return this;
  }

  eq(col: string, v: unknown): this {
    return this.filtra((l) => campo(l, col) === v);
  }

  neq(col: string, v: unknown): this {
    // Postgres exclui NULL de <> — registro sem o campo não passa no neq
    return this.filtra((l) => campo(l, col) != null && campo(l, col) !== v);
  }

  in(col: string, vals: unknown[]): this {
    const set = new Set(vals);
    return this.filtra((l) => set.has(campo(l, col)));
  }

  is(col: string, v: unknown): this {
    return this.filtra((l) =>
      v == null ? campo(l, col) == null : campo(l, col) === v
    );
  }

  gt(col: string, v: unknown): this {
    return this.filtra((l) => compara(campo(l, col), v, "gt"));
  }

  gte(col: string, v: unknown): this {
    return this.filtra((l) => compara(campo(l, col), v, "gte"));
  }

  lt(col: string, v: unknown): this {
    return this.filtra((l) => compara(campo(l, col), v, "lt"));
  }

  lte(col: string, v: unknown): this {
    return this.filtra((l) => compara(campo(l, col), v, "lte"));
  }

  or(expr: string): this {
    const termos = splitTop(expr)
      .map(termo)
      .filter((t): t is (l: Linha) => boolean => t != null);
    return termos.length === 0
      ? this
      : this.filtra((l) => termos.some((t) => t(l)));
  }

  order(
    col: string,
    opts?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string }
  ): this {
    if (this.erro) return this;
    const asc = opts?.ascending !== false;
    // "encontro(realizado_em)" ordena por coluna do embed to-one
    const emb = col.match(/^(\w+)\((\w+)\)$/);
    const get = emb
      ? (l: Linha) => campo(l, `${emb[1]}.${emb[2]}`)
      : (l: Linha) => campo(l, col);
    this.linhasAtuais = [...this.linhasAtuais].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      // null sempre por último, asc ou desc
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return asc ? cmp : -cmp;
    });
    return this;
  }

  limit(n: number): this {
    if (this.erro) return this;
    this.linhasAtuais = this.linhasAtuais.slice(0, n);
    return this;
  }

  range(from: number, to: number): this {
    if (this.erro) return this;
    // range do PostgREST é inclusivo nas duas pontas
    this.linhasAtuais = this.linhasAtuais.slice(from, to + 1);
    return this;
  }

  maybeSingle(): this {
    this.unico = "maybe";
    return this;
  }

  single(): this {
    this.unico = "single";
    return this;
  }

  // ---------- escrita: tudo bloqueado com a msg do modo demo ----------

  private mutacao(): this {
    this.erro = ERRO_DEMO;
    this.linhasAtuais = [];
    return this;
  }

  insert(): this {
    return this.mutacao();
  }

  update(): this {
    return this.mutacao();
  }

  upsert(): this {
    return this.mutacao();
  }

  delete(): this {
    return this.mutacao();
  }

  then<TResult1 = Resultado, TResult2 = never>(
    onFulfilled?:
      | ((r: Resultado) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((e: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    let r: Resultado;
    if (this.erro) {
      // mutation falha como PostgREST: data null, error preenchido —
      // mesmo depois de .select().single() encadeado
      r = { data: null, error: this.erro, count: null };
    } else if (this.unico) {
      const primeira = this.linhasAtuais[0] ?? null;
      const erroUnico =
        this.unico === "single" && this.linhasAtuais.length !== 1
          ? {
              message:
                "JSON object requested, multiple (or no) rows returned",
              code: "PGRST116",
            }
          : null;
      r = { data: primeira, error: erroUnico, count: null };
    } else {
      r = { data: this.linhasAtuais, error: null, count: this.linhasAtuais.length };
    }
    return Promise.resolve(r).then(onFulfilled, onRejected);
  }

  catch<TResult = never>(
    onRejected?: ((e: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<Resultado | TResult> {
    return this.then(null, onRejected);
  }

  finally(onFinally?: (() => void) | null): Promise<Resultado> {
    return this.then().finally(onFinally ?? undefined);
  }
}

/** Bucket falso — todo upload/remoção falha com DEMO_MSG; as listagens e
 *  URLs voltam vazias pra não quebrar render de quem só lê. */
function bucketDemo() {
  const falha = async () => ({ data: null, error: { message: DEMO_MSG } });
  return {
    upload: falha,
    update: falha,
    remove: falha,
    move: falha,
    copy: falha,
    download: falha,
    createSignedUrl: falha,
    createSignedUrls: async () => ({ data: [], error: null }),
    createSignedUploadUrl: falha,
    list: async () => ({ data: [], error: null }),
    exists: async () => ({ data: false, error: null }),
    info: falha,
    getPublicUrl: () => ({ data: { publicUrl: "" } }),
  };
}

/** Auth falso — a persona do cookie é "a sessão": getSession/getUser voltam
 *  logados (o login-form redireciona pro app), signOut é no-op e toda
 *  escrita de credencial falha com DEMO_MSG. */
function authDemo(papel: AppRole | null) {
  const persona = papel ? getDemoData().personas[papel] : null;
  const user = persona
    ? {
        id: persona.user_id ?? persona.id,
        email: persona.email,
        aud: "authenticated",
        role: "authenticated",
        // senha_em presente = pula o onboarding de senha do login — personas
        // são contas estabelecidas, não primeiro acesso
        user_metadata: { senha_em: "demo" },
      }
    : null;
  const session = user
    ? { access_token: "demo", token_type: "bearer", user }
    : null;
  const falha = async () => ({
    data: { user: null, session: null },
    error: { message: DEMO_MSG },
  });
  return {
    getClaims: async () => ({
      data: { claims: user ? { sub: user.id } : null },
      error: null,
    }),
    getUser: async () => ({ data: { user }, error: null }),
    getSession: async () => ({ data: { session }, error: null }),
    signOut: async () => ({ error: null }),
    updateUser: falha,
    signInWithOtp: falha,
    signInWithPassword: falha,
    signInWithOAuth: falha,
    verifyOtp: falha,
    setSession: falha,
    exchangeCodeForSession: falha,
    resetPasswordForEmail: falha,
    onAuthStateChange: (cb: (event: string, s: unknown) => void) => {
      // supabase-js dispara SIGNED_IN ao assinar com sessão viva — replica pra
      // quem espera o evento (login-form) reagir igual
      if (session) queueMicrotask(() => cb("SIGNED_IN", session));
      return { data: { subscription: { unsubscribe() {} } } };
    },
  };
}

function canalDemo() {
  const canal = {
    on: () => canal,
    subscribe: () => ({ unsubscribe() {} }),
    unsubscribe: async () => "ok" as const,
  };
  return canal;
}

/** RPCs do stub: só as leituras públicas por token resolvem de verdade
 *  (as páginas /assinar/<token> e /f/<token> as usam sem sessão — mesmo
 *  contrato das funções security definer do 0033/0042). Toda RPC de escrita
 *  — assinar_termo, assinar_com_token, revogar_assinatura,
 *  regenerar_token_assinatura, submeter_resposta_formulario e as demais
 *  (aceitar_solicitacao...) — cai no default: a demo não grava. */
async function rpcDemo(
  fn: string,
  params?: Record<string, unknown>
): Promise<Resultado> {
  const token = String(params?.p_token ?? "");
  switch (fn) {
    // jsonb ou null — null quando o token não existe
    case "assinatura_por_token":
      return { data: demoAssinaturaPorToken(token), error: null, count: null };
    // objeto único ou null (0051+0053): o recorte AssinaturaVia só existe
    // depois de assinada; pendente/revogada/expirada devolve null
    case "assinatura_completa_por_token": {
      const row = demoAssinaturaCompletaPorToken(token);
      return { data: row, error: null, count: null };
    }
    // jsonb ou null — a definição pública do form + status do link (0042)
    case "formulario_por_token":
      return { data: demoFormularioPorToken(token), error: null, count: null };
    // escrita explícita: a RPC real gravaria resposta + carimbo do
    // checklist + notificação — na demo é só a mensagem, nada persiste
    case "submeter_resposta_formulario":
      return { data: null, error: ERRO_DEMO, count: null };
    default:
      return { data: null, error: ERRO_DEMO, count: null };
  }
}

/** createClient() do browser quando demo_role está ativo — o cast pra
 *  SupabaseClient acontece no caller (supabase/client.ts). */
export function createDemoClient() {
  const papel = demoRoleClient();
  const client = {
    from: (tabela: string) =>
      new ConsultaDemo(linhas(tabela, papel), tabela, papel),
    storage: { from: bucketDemo },
    auth: authDemo(papel),
    rpc: rpcDemo,
    channel: canalDemo,
    removeChannel: async () => "ok" as const,
    getChannels: () => [] as unknown[],
    schema: () => client,
  };
  return client;
}
