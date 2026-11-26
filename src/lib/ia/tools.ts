// Registry tipado da camada de IA (fase 0 — docs/planos/ia-chatbot-mcp.md).
// O modelo nunca gera SQL e nunca toca tabela diretamente: chama estas
// tools, que delegam pras mesmas leituras e funções de domínio do app. Um
// registry só, dois transportes — o chat interno passa o client da sessão,
// o MCP externo (fase 2) passa o client do JWT validado; a RLS decide o
// que volta, igual na tela.
//
// Cada tool declara: nome, descrição em pt-BR (é o que o modelo lê pra
// escolher), schema zod dos args, `roles` (gate ANTES de rodar — a tool não
// existe pro papel que não deveria chamá-la) e `run` — que só recebe o
// client do próprio usuário, nunca service role. A exceção é a superfície
// do plano "ficar em dia" (527): dupla e grade dos dois lados são
// referência cruzada que a RLS não entrega — leitura idêntica à da
// action do combinado (contextoPlano, 518), DEPOIS das RPCs de sessão
// provarem o acesso; escrita segue só por RPC definer.
//
// Toda chamada grava ia_eventos (0083): canal, tool, args canônicos, ok/erro
// e latência — inclusive as rejeitadas, porque "o que a IA tentou" também é
// auditoria.

import { createHash } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  comparaNome,
  encontroTemConteudo,
  formatDiaHora,
  parseDisponibilidade,
  recessosAlterados,
  saudadeDaDupla,
  toDateStr,
} from "@/lib/ciclo";
import {
  escopoDaProposta,
  fusaoPedeAvisoPratica,
  gruposDeSessao,
  montarPlanoEmDia,
  rotuloRitmo,
} from "@/lib/plano-em-dia";
import { montarDocCombinado } from "@/lib/plano-roteiros";
import { aceitesDoPlano } from "@/lib/plano-combinado";
import {
  comDecisoesRecesso,
  contextoPlanoCom,
  getCicloEventosPlano,
} from "@/lib/plano-servico";
import { filaMentorados, filaMentores, tetoMentor } from "@/lib/fila";
import { saudeDoRecorte } from "@/lib/agenda-coordenacao";
import type { Achado } from "@/lib/relatorios/leituras";
import { leituraAderencia } from "@/lib/relatorios/leituras-aderencia";
import { leituraAdocao } from "@/lib/relatorios/leituras-adocao";
import { leituraSaude } from "@/lib/relatorios/leituras-saude";
import { resumoAderencia } from "@/lib/relatorios/operacional";
import { dadosTendenciaSaude } from "@/lib/relatorios/dados";
import { temPapel } from "@/lib/types";
import type {
  AppRole,
  CicloEvento,
  Disponibilidade,
  Dupla,
  DuplaPlanoEscopo,
  Mentorado,
  Profile,
} from "@/lib/types";
import {
  getAdocaoResumoIa,
  getAdocaoSuperficiesIa,
  getAgendaPeriodoIa,
  getCapacidadeInsumos,
  getChamadoIa,
  getChamadosIa,
  getCicloEventosIa,
  getDuplaIa,
  getDuplasResumoIa,
  getDuplasVivasIa,
  getDuplasInsightsIa,
  getCronogramasIa,
  getCombinadoJovemIa,
  getEncaminhamentosIa,
  getEncontroIa,
  getFechadasIa,
  getFilaInsumos,
  getHistoricoEncontrosIa,
  getInstrumentosDaDuplaIa,
  getJovemAgendaIa,
  getJovemCombinadosIa,
  getJovemContatoIa,
  getJovemDuplaIa,
  getJovemPedidosIa,
  getJovemProgressoIa,
  getJovemRetroativoIa,
  getMinhaDuplaIa,
  getSolicitacaoMuralIa,
  getPessoasBuscaIa,
  getPessoaNomeIa,
  getPlanoDuplaIa,
  getRegistrosDaDuplaIa,
  getTerceirosIa,
  papeisDoUsuario,
  type DuplaIa,
} from "./queries";
import {
  dadosAdocaoCaminhos,
  dadosAdocaoCoorte,
  dadosAdocaoMatriz,
  dadosAdocaoResumo,
  dadosAdocaoSerieDia,
  dadosFunilInstrumentos,
  FUNIL_JANELA_DIAS,
} from "@/lib/relatorios/adocao";
import {
  MENSAGEM_TEMPLATE_SLUGS,
  mensagemTemplateTexto,
} from "./mensagem-templates";
import { SITE_URL } from "@/lib/site";
import { PERGUNTAS } from "@/lib/ajuda/conteudo";
import { normaliza } from "@/lib/utils";
import {
  agendarEncontroCore,
  editarCampoPessoaCore,
  marcarSaidaMentoradoCore,
  registrarInteracaoCore,
  type AtorEscrita,
} from "@/lib/escritas";
import { getIaConfig } from "./config";
import { CacheTtl } from "./cache";
import { buscarNosGuias, catalogoGuias } from "./guias";
import { emitirProdutoEvento } from "../produto-eventos-server";
import { agregarPessoasBi, getPessoasBiIa } from "./pessoas-bi";

/** Canais registrados em ia_eventos — o CHECK do banco fecha o vocabulário
 *  ('importacao' entrou na 0193: match semântico/revisão NL do import CSV;
 *  'relatorio' na 0212: cards "Perguntar à Liza" dos relatórios). */
export type CanalIa = "chat" | "mcp" | "importacao" | "relatorio";

/** O `roles` do registry — vocabulário do banco (app_role). */
export type Papel = AppRole;

export type ResultadoTool =
  | { ok: true; dados: unknown }
  | { ok: false; erro: string };

type ContextoIa = {
  supabase: SupabaseClient;
  papel: Papel;
  /** papéis efetivos (my_papeis) — recorte de audiência dos guias */
  papeis: Papel[];
};

const TODOS_PAPEIS: readonly Papel[] = [
  "coordenacao",
  "supervisor",
  "mentor_dpp",
  "mentor_especialista",
  "mentorado",
];

/** Erro "de negócio" — mensagem segura pra devolver ao modelo/usuário.
 *  Erros inesperados (rede, PostgREST) viram mensagem genérica + log. */
class ErroTool extends Error {}

const semArgs = z.object({}).strict();

const duplaIdArgs = z
  .object({ dupla_id: z.uuid().describe("id da dupla (uuid)") })
  .strict();

const registrosArgs = z
  .object({
    dupla_id: z.uuid().describe("id da dupla (uuid)"),
    limite: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("máximo de registros, mais recentes primeiro (padrão 20)"),
  })
  .strict();

const agendaArgs = z
  .object({
    dias: z
      .number()
      .int()
      .min(1)
      .max(60)
      .optional()
      .describe("janela em dias a partir de hoje (padrão 14)"),
    incluir_recentes: z
      .boolean()
      .optional()
      .describe("inclui os encontros dos últimos 3 dias (padrão true)"),
  })
  .strict();

const historicoArgs = z
  .object({
    dias: z
      .number()
      .int()
      .min(7)
      .max(120)
      .optional()
      .describe("janela pra trás em dias (padrão 30, máx 120)"),
    dupla_id: z
      .uuid()
      .optional()
      .describe("restringe a uma dupla (padrão: todas no escopo)"),
  })
  .strict();

const guiaArgs = z
  .object({
    pergunta: z
      .string()
      .min(3)
      .max(300)
      .describe("a pergunta em linguagem natural, como o usuário fez"),
  })
  .strict();

const combinadosArgs = z
  .object({
    dupla_id: z
      .uuid()
      .optional()
      .describe("restringe a uma dupla (padrão: todas no escopo)"),
    status: z
      .enum(["pendente", "feito", "todos"])
      .optional()
      .describe(
        "recorte por status (padrão pendente; 'todos' inclui os feitos)"
      ),
    limite: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("máximo de combinados, vencidos primeiro (padrão 40)"),
  })
  .strict();

const mensagemTemplateArgs = z
  .object({
    slug: z
      .enum(MENSAGEM_TEMPLATE_SLUGS)
      .describe("slug do template de mensagem do guia"),
    dupla_id: z
      .uuid()
      .optional()
      .describe(
        "dupla destino — ausente na 1ª chamada, quando a pessoa ainda não escolheu"
      ),
  })
  .strict();

const adocaoArgs = z
  .object({
    dias: z
      .number()
      .int()
      .min(1)
      .max(90)
      .optional()
      .describe("janela pra trás em dias — típico 7/30/90 (padrão 30)"),
    papel: z
      .enum([
        "coordenacao",
        "supervisor",
        "mentor_dpp",
        "mentor_especialista",
        "mentorado",
      ])
      .optional()
      .describe(
        "recorta só os gestos emitidos com esse papel efetivo (padrão: todos)"
      ),
  })
  .strict();

const adocaoJanelaArgs = z
  .object({
    dias: z
      .number()
      .int()
      .min(1)
      .max(90)
      .optional()
      .describe("janela pra trás em dias — típico 7/30/90 (padrão 30)"),
  })
  .strict();

const adocaoCaminhosArgs = z
  .object({
    dias: z
      .number()
      .int()
      .min(1)
      .max(90)
      .optional()
      .describe("janela pra trás em dias — típico 7/30/90 (padrão 30)"),
    papel: z
      .enum([
        "coordenacao",
        "supervisor",
        "mentor_dpp",
        "mentor_especialista",
        "mentorado",
      ])
      .optional()
      .describe(
        "recorta só os gestos emitidos com esse papel efetivo (padrão: todos)"
      ),
    top: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("quantas sequências devolver (padrão 8, máx 20)"),
  })
  .strict();

const adocaoCoorteArgs = z
  .object({
    semanas: z
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .describe(
        "quantas coortes semanais recentes (padrão 8 — no máx 12)"
      ),
  })
  .strict();

const insightsArgs = z
  .object({
    secao: z
      .enum(["todas", "aderencia", "saude", "adocao"])
      .optional()
      .describe(
        "qual leitura responder (padrão todas; 'aderencia' quando a pergunta é sobre calendário, registro, apoio ou remarcação)"
      ),
    dias: z
      .union([z.literal(7), z.literal(30), z.literal(90)])
      .optional()
      .describe(
        "janela das leituras de saúde e adoção em dias: 7, 30 ou 90 (padrão 30)"
      ),
  })
  .strict();

const semaforoOrd = { risco: 0, atencao: 1, ok: 2 } as const;

// ---------- tools de escrita ----------

/** As 5 escritas do domínio (REALIZA-126): o conjunto que o kill-switch
 *  IA_ESCRITAS=0 desliga nos dois canais e o único que o payload do chat
 *  anuncia. As escritas de chamados/jovem já eram live via MCP antes da
 *  flag existir — desligar tudo quebraria quem depende delas. */
export const ESCRITAS_DOMINIO = new Set([
  "registrar_interacao",
  "marcar_situacao_mentorado",
  "emitir_link_instrumento",
  "agendar_encontro",
  "editar_campo_pessoa",
]);

/** Sufixo de descrição das tools `escreve` — ensina o client o protocolo de
 *  2 passos (prévia → confirmação). Fica na descrição porque é o texto que
 *  o modelo lê pra usar a tool. */
const ESCRITA_DOC =
  " AÇÃO EM 2 PASSOS: a primeira chamada devolve {pendente_confirmacao} com a prévia e o confirmacao_id — nada é alterado ainda. Mostre a prévia à pessoa; só depois do 'sim' chame de novo com os MESMOS argumentos mais o campo confirmacao_id. A confirmação expira em 10 minutos e vale uma única vez.";

/** Traduz o retorno das RPCs de escrita (definer): `raise exception` vira
 *  erro PostgREST com a mensagem em pt-BR; várias devolvem {error:"…"} em
 *  jsonb. Ambos viram ErroTool — mensagem segura pra devolver ao usuário. */
async function rpcEscreve(
  ctx: ContextoIa,
  fn: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await ctx.supabase.rpc(fn, params);
  if (error) throw new ErroTool(error.message || "A ação não foi aceita.");
  const d = data as { error?: string } | null;
  if (d && typeof d === "object" && typeof d.error === "string")
    throw new ErroTool(d.error);
  return data ?? { ok: true };
}

/** O "eu" que os cores de escrita (lib/escritas) esperam — resolve pelas
 *  mesmas RPCs de sempre (my_profile_id/my_role funcionam no JWT do chat
 *  e no impersonado do MCP). */
async function atorDoCanal(ctx: ContextoIa): Promise<AtorEscrita> {
  const [pid, role] = await Promise.all([
    ctx.supabase.rpc("my_profile_id"),
    ctx.supabase.rpc("my_role"),
  ]);
  const id = (pid.data as string | null) ?? null;
  if (!id) throw new ErroTool("Sessão expirada. Entre de novo.");
  return { id, role: (role.data as AppRole | null) ?? null };
}

/** Converte o contrato dos cores ({error}|{ok}) no das tools (ErroTool) —
 *  a mensagem pt-BR do domínio sobe intacta pro modelo/card. */
async function rodarCore<T>(p: Promise<T | { error: string }>): Promise<T> {
  const r = await p;
  if (r && typeof r === "object" && "error" in r) {
    throw new ErroTool(String((r as { error: string }).error));
  }
  return r as T;
}

/** JSON estável pra casar args na confirmação — chaves ordenadas em
 *  profundidade, porque a RPC faz digest do texto do jsonb. */
function canonico(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.keys(x)
          .sort()
          .reduce((o: Record<string, unknown>, k) => {
            o[k] = (x as Record<string, unknown>)[k];
            return o;
          }, {})
      : x
  );
}

// ---------- rótulos dos resumos de confirmação (026/FR-010) ----------
// O card de confirmação nomeia por nomes e número de encontro ("o 5º
// encontro de Ana e Ricardo") — nunca uuid. Lookup que falha ou que a
// RLS esconde cai no rótulo genérico SEM id: o que não pode acontecer é
// o identificador cru vazar pro texto visível.

const nomeExibicao = (
  p: { nome: string; nome_social: string | null } | null | undefined
): string | null => p?.nome_social ?? p?.nome ?? null;

const juntaNomes = (
  ...pessoas: ({ nome: string; nome_social: string | null } | null | undefined)[]
): string | null => {
  const nomes = pessoas
    .map(nomeExibicao)
    .filter((n): n is string => Boolean(n));
  return nomes.length ? nomes.join(" e ") : null;
};

/** "Ana e Ricardo" — mentorado e mentor da dupla, ou null quando a dupla
 *  não é visível. */
async function rotuloDupla(
  supabase: SupabaseClient,
  duplaId: string | null | undefined
): Promise<string | null> {
  if (!duplaId) return null;
  const d = await getDuplaIa(supabase, duplaId).catch(() => null);
  return juntaNomes(d?.mentorado, d?.mentor);
}

/** Dupla dona do plano "ficar em dia", pelo plano_id. */
async function rotuloPlano(
  supabase: SupabaseClient,
  planoId: string
): Promise<string | null> {
  const p = await getPlanoDuplaIa(supabase, planoId).catch(() => null);
  return p ? rotuloDupla(supabase, p.dupla_id) : null;
}

/** "5º encontro de Ana e Ricardo" — sem o artigo, pra compor "o/do". */
async function rotuloEncontro(
  supabase: SupabaseClient,
  encontroId: string
): Promise<string> {
  const e = await getEncontroIa(supabase, encontroId).catch(() => null);
  if (!e) return "encontro";
  const nomes = juntaNomes(e.dupla?.mentorado, e.dupla?.mentor);
  return `${e.numero}º encontro${nomes ? ` de ${nomes}` : ""}`;
}

/** "chamado #7 (app não abre)" — ou só "chamado". */
async function rotuloChamado(
  supabase: SupabaseClient,
  chamadoId: string
): Promise<string> {
  const c = await getChamadoIa(supabase, chamadoId).catch(() => null);
  if (!c) return "chamado";
  return `chamado #${c.numero}${c.assunto ? ` (${c.assunto.slice(0, 60)})` : ""}`;
}

/** Nome do mentorado do pedido de especialista (visão da equipe). */
async function rotuloSolicitacao(
  supabase: SupabaseClient,
  solicitacaoId: string
): Promise<string | null> {
  const s = await getSolicitacaoMuralIa(supabase, solicitacaoId).catch(
    () => null
  );
  return s?.mentorado_nome_social ?? s?.mentorado_nome ?? null;
}

/** Args do plano_em_dia (527 — a tool espelha o planner do combinado):
 *  simulações sem escrita — ritmo pedido, "combinar sem a grade", sessão
 *  fusa e decisões de recesso hipotéticas. */
type PlanoEmDiaArgs = {
  dupla_id: string;
  ritmo?: number;
  sem_grade?: boolean;
  fusao?: number[][];
  decisoes_recesso?: { ciclo_evento_id: string; usa: boolean }[];
};

/** Args do plano_propor — o escopo sai do mesmo planner; as decisões de
 *  recesso são gravadas pela dupla na mesma proposta (snapshot no
 *  escopo.decisoes, como o wizard da aba Agora). */
type PlanoProporArgs = PlanoEmDiaArgs;

/** Saída do resumo_semana a partir das duplas vivas — pura, pra a demo
 *  (/demo, dataset em memória) responder pelo MESMO caminho da tool. */
export function projetarResumo(
  duplas: DuplaIa[],
  eventos: CicloEvento[],
  fechadas: DuplaIa[] = []
) {
  const itens = duplas.map((d) => {
    // a projeção de IA_SAUDE_SELECT é exatamente o que saudadeDaDupla
    // lê — o contrato é a constante compartilhada, não a linha solta
    const s = saudadeDaDupla(d as unknown as Dupla, eventos);
    return {
      dupla_id: d.id,
      mentor: d.mentor?.nome_social ?? d.mentor?.nome ?? null,
      mentorado: d.mentorado?.nome_social ?? d.mentorado?.nome ?? null,
      trilha: d.trilha,
      status: d.status,
      desfecho: d.desfecho ?? null,
      semaforo: s.semaforo,
      motivo: s.motivo,
      // todos os critérios acesos — o semáforo resume, a lista explica
      motivos: s.motivos,
      sinais: s.sinais,
      // apoio é eixo separado: chamado aberto, não falha da jornada
      apoio: s.apoio,
      esperado: s.esperado,
      feitos: s.feitos,
      registro_pendente: s.registroPendente,
      proximo_encontro: s.proximo
        ? { numero: s.proximo.numero, data_hora: s.proximo.data_hora }
        : null,
    };
  });
  // apoio aberto primeiro (trabalho a fazer), depois risco → atenção →
  // ok — o radar da equipe ordena pelo que pede ação
  itens.sort(
    (a, b) =>
      Number(b.apoio.aberto) - Number(a.apoio.aberto) ||
      semaforoOrd[a.semaforo] - semaforoOrd[b.semaforo] ||
      comparaNome(a.mentor ?? "", b.mentor ?? "")
  );
  // contagem pela regra única das telas (saudeDoRecorte) — o card do
  // chat e o texto do modelo leem o mesmo número da home e de /duplas.
  // As fechadas entram só na partição (projeção mínima, sem encontros:
  // arrays vazios pro saudadeDaDupla não tropeçar), nunca no `itens`.
  const saude = saudeDoRecorte(
    [
      ...duplas,
      ...fechadas.map((d) => ({ ...d, encontros: [], encaminhamentos: [] })),
    ] as unknown as Dupla[],
    eventos,
    new Date()
  );
  return {
    gerado_em: new Date().toISOString(),
    total: itens.length,
    saude: {
      em_andamento: saude.emAndamento,
      risco: saude.risco,
      atencao: saude.atencao,
      em_dia: saude.emDia,
      apoio: saude.apoio,
      pausadas: saude.pausadas,
      concluidas: saude.concluidas,
      encerradas: saude.encerradas,
    },
    duplas: itens,
  };
}

/** Saída do duplas_panorama (026): o recorte "como estão?" das duplas
 *  vivas — os mesmos itens do resumo_semana na mesma ordem (apoio →
 *  risco → atenção → ok), capados em `limite` linhas com `total` do
 *  escopo e `truncado` honestos. Pura, pra a demo responder pelo mesmo
 *  caminho da tool. */
export function projetarPanorama(
  duplas: DuplaIa[],
  eventos: CicloEvento[],
  limite = 6
) {
  const itens = projetarResumo(duplas, eventos).duplas;
  return {
    total: itens.length,
    truncado: itens.length > limite,
    duplas: itens.slice(0, limite),
  };
}

/** Saída do ficha_dupla (visão da equipe) — pura, idem projetarResumo. */
export function projetarFicha(d: DuplaIa, eventos: CicloEvento[]) {
  const s = saudadeDaDupla(d as unknown as Dupla, eventos);
  return {
    dupla_id: d.id,
    trilha: d.trilha,
    status: d.status,
    desfecho: d.desfecho ?? null,
    turma: d.turma,
    iniciada_em: d.iniciada_em,
    demanda: d.demanda,
    mentor: d.mentor?.nome_social ?? d.mentor?.nome ?? null,
    mentorado: d.mentorado?.nome_social ?? d.mentorado?.nome ?? null,
    supervisor: d.supervisor?.nome_social ?? d.supervisor?.nome ?? null,
    // per-person contact: only leaves on the ficha (single, RLS-scoped
    // slice) — the rascunho block copies whatsapp into `numero` for the
    // direct wa.me link
    contatos: {
      mentor: d.mentor
        ? { nome: d.mentor.nome_social ?? d.mentor.nome, whatsapp: d.mentor.whatsapp ?? null }
        : null,
      mentorado: d.mentorado
        ? { nome: d.mentorado.nome_social ?? d.mentorado.nome, whatsapp: d.mentorado.whatsapp ?? null }
        : null,
      supervisor: d.supervisor
        ? { nome: d.supervisor.nome_social ?? d.supervisor.nome, whatsapp: d.supervisor.whatsapp ?? null }
        : null,
    },
    semaforo: s.semaforo,
    motivo: s.motivo,
    motivos: s.motivos,
    sinais: s.sinais,
    apoio: s.apoio,
    esperado: s.esperado,
    feitos: s.feitos,
    registro_pendente: s.registroPendente,
    proximo_encontro: s.proximo
      ? { numero: s.proximo.numero, data_hora: s.proximo.data_hora }
      : null,
    encaminhamentos_pendentes: d.encaminhamentos.filter(
      (t) => t.status === "pendente"
    ).length,
    // recessos do cronograma dela com a decisão vigente (462) — o modelo
    // lê o ciclo_evento_id daqui pra declarar_recesso
    recessos: eventos
      .filter(
        (e) =>
          e.cronograma_id === d.cronograma_id &&
          e.tipo === "recesso" &&
          e.data != null
      )
      .map((e) => {
        const dec = (d.recessos ?? []).find(
          (r) => r.ciclo_evento_id === e.id
        );
        return {
          ciclo_evento_id: e.id,
          titulo: e.titulo,
          data: e.data,
          data_fim: e.data_fim,
          usa: dec?.usa ?? true,
          declarado_em: dec?.declarado_em ?? null,
        };
      }),
    encontros: d.encontros
      .map((e) => ({
        numero: e.numero,
        status: e.status,
        data_hora: e.data_hora,
        realizado_em: e.realizado_em,
        // sessão combinada (018): o coberto tem conteúdo via âncora —
        // tem_registro na régua do domínio, não no row nulo
        tem_registro: encontroTemConteudo(e, d.encontros),
      }))
      .sort((a, b) => a.numero - b.numero),
  };
}

/** Achado da leitura operacional com a seção de origem (REALIZA-465): o
 *  modelo cita o número e diz de onde veio. A leitura não tem card, então o
 *  texto da resposta é a superfície dos achados. */
export type FonteInsight = "Aderência" | "Saúde" | "Adoção";
export type AchadoInsight = Achado & { fonte: FonteInsight };

/** O link de ação de cada leitura: o achado pode trazer o dele (a dupla que
 *  pede apoio), e o resto cai na tela que opera a seção. */
const ACAO_INSIGHT: Record<FonteInsight, { rotulo: string; href: string }> = {
  Aderência: { rotulo: "Abrir a lista de duplas", href: "/duplas" },
  Saúde: {
    rotulo: "Abrir a leitura de saúde",
    href: "/relatorios/operacionais?aba=visao",
  },
  Adoção: {
    rotulo: "Abrir a adoção",
    href: "/relatorios/operacionais?aba=adocao",
  },
};

const comFonte = (achados: Achado[], fonte: FonteInsight): AchadoInsight[] =>
  achados.map((a) => ({ ...a, fonte, acao: a.acao ?? ACAO_INSIGHT[fonte] }));

export const IA_TOOLS = {
  resumo_semana: {
    nome: "resumo_semana",
    descricao:
      "Panorama das duplas vivas (ativas e pausadas): o semáforo de cada uma — ok, atenção ou risco — com todos os motivos/sinais acesos, pedidos de apoio abertos (eixo separado do semáforo: trabalho, não falha), quantos encontros eram esperados × realizados e o próximo encontro marcado. Use pra 'como estão as duplas?', 'quem tá em risco?', 'resumo da semana'.",
    schema: semArgs,
    roles: ["coordenacao", "supervisor"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const [duplas, fechadas, eventos] = await Promise.all([
        getDuplasVivasIa(ctx.supabase),
        getFechadasIa(ctx.supabase),
        getCicloEventosIa(ctx.supabase),
      ]);
      return projetarResumo(duplas, eventos, fechadas);
    },
  },

  operacional_insights: {
    nome: "operacional_insights",
    descricao:
      "Leitura operacional pronta das seções do hub de relatórios: aderência das duplas (pedido de apoio, atraso de calendário, registro pendente, atraso médio de registro, remarcações), saúde do programa (risco, atenção e a direção dos últimos 7 dias) e adoção (pessoas ativas, gestos, superfícies e papéis sem uso, resposta dos instrumentos, retenção). Cada achado vem com título, número com denominador, por que virou achado, o que fazer, a fonte (Aderência, Saúde ou Adoção) e o link da ação. Use quando a pergunta for sobre adesão, saúde, tendência, adoção, indicadores ou métricas do programa, inclusive follow-ups curtos como 'e a adesão?', 'e a saúde?' e 'o uso caiu?'. A coordenação recebe as três leituras; supervisor e mentor recebem a aderência das duplas do próprio escopo, e o mentor só as duplas dele.",
    schema: insightsArgs,
    roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"],
    run: async ({ secao, dias }: z.infer<typeof insightsArgs>, ctx) => {
      const janela = dias ?? 30;
      const papeis = ctx.papeis.length ? ctx.papeis : [ctx.papel];
      const coordenacao = papeis.includes("coordenacao");
      const pedidas = new Set<"aderencia" | "saude" | "adocao">(
        !secao || secao === "todas"
          ? ["aderencia", "saude", "adocao"]
          : [secao]
      );
      // saúde e adoção são leituras do programa inteiro: fora da coordenação
      // elas não têm recorte honesto. O papel de linha (supervisor, mentor)
      // recebe a aderência das duplas que a RLS entrega, nunca o agregado
      // geral. Pedir só saúde/adoção cai na aderência em vez de "sem acesso".
      if (!coordenacao) {
        pedidas.delete("saude");
        pedidas.delete("adocao");
        pedidas.add("aderencia");
      }

      const rodar = async (
        fonte: FonteInsight,
        ler: () => Promise<Achado[]>
      ): Promise<{ fonte: FonteInsight; achados: Achado[] | null }> => {
        try {
          return { fonte, achados: await ler() };
        } catch (e) {
          // uma seção fora não derruba as outras: a pergunta ainda tem
          // resposta com o que leu
          console.error(`operacional_insights(${fonte}):`, e);
          return { fonte, achados: null };
        }
      };

      const tarefas: Promise<{
        fonte: FonteInsight;
        achados: Achado[] | null;
      }>[] = [];

      if (pedidas.has("aderencia")) {
        tarefas.push(
          rodar("Aderência", async () => {
            const [duplas, eventos, crons] = await Promise.all([
              getDuplasInsightsIa(ctx.supabase),
              getCicloEventosIa(ctx.supabase),
              getCronogramasIa(ctx.supabase),
            ]);
            // a projeção do select é um superset do que resumoAderencia lê
            const resumo = resumoAderencia(
              duplas as unknown as Dupla[],
              eventos,
              crons,
              new Date()
            );
            return leituraAderencia(resumo);
          })
        );
      }

      if (pedidas.has("saude")) {
        tarefas.push(
          rodar("Saúde", async () => {
            const tendencia = await dadosTendenciaSaude(
              ctx.supabase,
              {},
              janela
            );
            return leituraSaude(tendencia);
          })
        );
      }

      if (pedidas.has("adocao")) {
        tarefas.push(
          rodar("Adoção", async () => {
            const desde = new Date(Date.now() - janela * 86400_000);
            const [resumo, celulas, coorte, funil] = await Promise.all([
              dadosAdocaoResumo(ctx.supabase, desde, null),
              dadosAdocaoMatriz(ctx.supabase, desde, null),
              dadosAdocaoCoorte(ctx.supabase, 10),
              dadosFunilInstrumentos(ctx.supabase, desde),
            ]);
            return leituraAdocao({
              resumo,
              celulas,
              coorte,
              funil,
              janela,
              papel: null,
              medida: "pessoas",
            });
          })
        );
      }

      const resultados = await Promise.all(tarefas);
      const achados: AchadoInsight[] = [];
      const secoes: FonteInsight[] = [];
      const indisponiveis: FonteInsight[] = [];
      for (const r of resultados) {
        if (r.achados) {
          secoes.push(r.fonte);
          achados.push(...comFonte(r.achados, r.fonte));
        } else {
          indisponiveis.push(r.fonte);
        }
      }
      return {
        gerado_em: new Date().toISOString(),
        janela_dias: janela,
        escopo: coordenacao ? "programa" : "duplas do seu escopo",
        secoes,
        indisponiveis,
        total: achados.length,
        achados,
      };
    },
  },

  ficha_dupla: {
    nome: "ficha_dupla",
    descricao:
      "Dados estruturados de uma dupla: trilha, status, nomes, demanda, link do PDM, o semáforo com motivo, todos os sinais acesos, o pedido de apoio aberto (eixo separado) e a lista de encontros (número, status, datas, se tem registro). Pro jovem, devolve a própria dupla sem o semáforo (instrumento da equipe). null quando a dupla não existe ou está fora do alcance do papel.",
    schema: duplaIdArgs,
    roles: TODOS_PAPEIS,
    run: async ({ dupla_id }: z.infer<typeof duplaIdArgs>, ctx) => {
      // o jovem não tem grant na tabela duplas — a ficha dele vem da view
      // escopada jovem_duplas + os encontros que ele mesmo lê
      if (ctx.papel === "mentorado") {
        const [r, contatos] = await Promise.all([
          getJovemDuplaIa(ctx.supabase, dupla_id),
          getJovemContatoIa(ctx.supabase, dupla_id),
        ]);
        if (!r) return null;
        // o jovem é o outro lado da própria dupla — "Você" como no
        // projetor minha_dupla; sem ele o card voltava a "a definir"
        const prox = r.encontros.find(
          (e) => e.status === "agendado" || e.status === "remarcado"
        );
        // especialista-trilha labels the adult 'especialista' in
        // jovem_contatos (0076) — the "mentor" figure for the jovem is
        // whichever adult the dupla has, not the literal papel
        const wa = (papeis: string[]) =>
          contatos.find((c) => papeis.includes(c.papel))?.whatsapp ?? null;
        return {
          dupla_id: r.dupla.id,
          trilha: r.dupla.trilha,
          status: r.dupla.status,
          turma: r.dupla.turma,
          iniciada_em: r.dupla.iniciada_em,
          demanda: r.dupla.demanda,
          mentor: r.dupla.mentor_nome_social ?? r.dupla.mentor_nome,
          mentorado: "Você",
          supervisor: r.dupla.supervisor_nome_social ?? r.dupla.supervisor_nome,
          contatos: {
            mentor: {
              nome: r.dupla.mentor_nome_social ?? r.dupla.mentor_nome,
              whatsapp: wa(["mentor", "especialista"]),
            },
            supervisor: {
              nome: r.dupla.supervisor_nome_social ?? r.dupla.supervisor_nome,
              whatsapp: wa(["supervisor"]),
            },
          },
          encontros: r.encontros,
          proximo_encontro: prox
            ? { numero: prox.numero, data_hora: prox.data_hora }
            : null,
        };
      }
      const [d, eventos] = await Promise.all([
        getDuplaIa(ctx.supabase, dupla_id),
        getCicloEventosIa(ctx.supabase),
      ]);
      return d ? projetarFicha(d, eventos) : null;
    },
  },

  plano_em_dia: {
    nome: "plano_em_dia",
    descricao:
      "Plano de recuperação de uma dupla DPP atrasada ('ficar em dia'): passo a passo determinístico com data sugerida por encontro, no ritmo mais leve que fecha antes do encerramento (1 por semana, até 2, até 3 ou até 1 por dia), respeitando os intervalos de prática/tarefa do guia, os recessos, os feriados nacionais, a grade de disponibilidade combinada da dupla (quando os dois lados já marcaram) e o encerramento do ciclo. Devolve o estado (em_dia, recuperacao ou conversa: nem 1 por dia fecha, o caminho é a coordenação), cada passo com a ação (agendar, remarcar ou já marcado; vence_no_caminho = oficial que vence enquanto a dupla recupera), pendências de registro que vêm antes de qualquer plano, os recessos ainda sem decisão que travam a proposta, o estado da grade dos dois lados, a data em que a dupla volta pro calendário oficial, quantos encontros cabem até o encerramento, o efeito de seguir no recesso e qual degrau da folga de prática 8→9 o plano usou (pratica_flex: oficial, 7 dias ou piso). Os argumentos simulam o combinado SEM GRAVAR: ritmo pedido, sem_grade (combinar sem a disponibilidade), fusao (encontros juntos na mesma sessão) e decisoes_recesso ('e se a dupla decidir X?'). Use pra 'como a dupla X fica em dia?', 'ela começou atrasada, o que fazer?', 'monta um plano de recuperação', 'dá pra adiantar encontro?'. null quando a dupla não existe ou está fora do alcance do papel.",
    schema: z
      .object({
        dupla_id: z.uuid().describe("id da dupla (uuid)"),
        ritmo: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("encontros por semana na simulação (sem teto; omita pro mais leve que fecha)"),
        sem_grade: z
          .boolean()
          .optional()
          .describe("true = simula combinando sem a grade de disponibilidade"),
        fusao: z
          .array(z.array(z.number().int().min(1)).min(2))
          .optional()
          .describe("sessões combinadas: grupos de números de encontro na mesma sessão"),
        decisoes_recesso: z
          .array(
            z.object({
              ciclo_evento_id: z.uuid(),
              usa: z.boolean(),
            })
          )
          .optional()
          .describe("simula 'e se a dupla decidir X sobre o recesso' sem gravar — recessos_pendentes lista os ids"),
      })
      .strict(),
    // DPP-only tool: especialista track has no official calendar to catch
    // up to (the planner itself returns aplicavel:false) and the youth
    // never sees scheduling machinery — that's the pair's gesture
    roles: ["coordenacao", "supervisor", "mentor_dpp"],
    run: async (a: PlanoEmDiaArgs, ctx) => {
      const [eventos, cx] = await Promise.all([
        // catálogo por serviço (527): a RLS deixa o jovem de fora de
        // ciclo_eventos e o dado é idêntico pra qualquer papel
        getCicloEventosPlano(),
        contextoPlanoCom(ctx.supabase, a.dupla_id, []),
      ]);
      if ("error" in cx) return null;
      const d = cx.dupla;
      const duplaSim = comDecisoesRecesso(
        d,
        (a.decisoes_recesso ?? []).map((x) => ({
          cicloEventoId: x.ciclo_evento_id,
          usa: x.usa,
        }))
      );
      const agora = new Date();
      const r = montarPlanoEmDia({
        dupla: duplaSim,
        eventos,
        ritmo: a.ritmo,
        disponibilidade: a.sem_grade === true ? null : cx.combinada,
        fusao: a.fusao,
        hoje: agora,
      });
      if (!r.aplicavel) {
        return { dupla_id: a.dupla_id, trilha: d.trilha, aplicavel: false, motivo: r.motivo };
      }
      // overlay persistido (0219): o plano vivo da dupla, quando existe —
      // o card conta que já é combinado, não só proposta
      const vivo =
        (d.planos ?? []).find((p) =>
          ["proposto", "aceito", "ativo"].includes(p.status)
        ) ?? null;
      // aceite ÚNICO (0225): quem falta aceitar, na régua canônica
      const aceites = vivo ? aceitesDoPlano(vivo) : null;
      const falta =
        vivo?.status === "proposto" && aceites
          ? !aceites.mentor && !aceites.mentorado
            ? "dupla"
            : !aceites.mentor
              ? "mentor"
              : !aceites.mentorado
                ? "mentorado"
                : null
          : null;
      // rascunho do combinado (527): a mesma montagem do "Ler o
      // documento" do wizard — o card deixa a dupla ler o que vai propor.
      // Recessos = pendente com a resposta simulada + decidido na janela
      // (o decidido já entra no dupla_sim e o planner o respeita)
      const e =
        r.estado === "recuperacao"
          ? escopoDaProposta(r, toDateStr(agora))
          : null;
      const evPorId = new Map(eventos.map((ev) => [ev.id, ev]));
      const pendenteIds = new Set(
        r.recessosPendentes.map((p) => p.cicloEventoId)
      );
      const usaSim = new Map(
        (a.decisoes_recesso ?? []).map((x) => [x.ciclo_evento_id, x.usa])
      );
      const hojeStr = toDateStr(agora);
      const doc =
        e && "escopo" in e
          ? montarDocCombinado({
              status: "proposto",
              versao: vivo ? vivo.versao + 1 : 1,
              quemPropos:
                cx.lado === "staff" ? "A equipe" : "Vocês",
              escopo: e.escopo as DuplaPlanoEscopo,
              recessos: [
                ...r.recessosPendentes.map((rec) => ({
                  titulo: rec.titulo,
                  inicio: rec.inicio,
                  fim: rec.fim,
                  usa: usaSim.get(rec.cicloEventoId) ?? null,
                })),
                ...(d.recessos ?? [])
                  .filter((rec) => {
                    if (pendenteIds.has(rec.ciclo_evento_id)) return false;
                    const ev = evPorId.get(rec.ciclo_evento_id);
                    return (
                      ev != null && (ev.data_fim ?? ev.data ?? "") >= hojeStr
                    );
                  })
                  .map((rec) => {
                    const ev = evPorId.get(rec.ciclo_evento_id)!;
                    return {
                      titulo: ev.titulo,
                      inicio: ev.data ?? "",
                      fim: ev.data_fim ?? ev.data ?? "",
                      usa: usaSim.get(rec.ciclo_evento_id) ?? rec.usa,
                    };
                  }),
              ],
            })
          : null;
      return {
        dupla_id: a.dupla_id,
        trilha: d.trilha,
        // a dupla já vem carregada — o card nomeia sem nova query (026)
        mentor: d.mentor?.nome_social ?? d.mentor?.nome ?? null,
        mentorado: d.mentorado?.nome_social ?? d.mentorado?.nome ?? null,
        aplicavel: true,
        em_dia: r.emDia,
        estado: r.estado,
        nivel: r.nivel,
        ritmo: r.ritmo,
        sugestao: r.sugestao,
        plano: vivo
          ? {
              id: vivo.id,
              status: vivo.status,
              versao: vivo.versao,
              aprovado_lado: vivo.aprovado_lado,
              aceito_mentor: aceites?.mentor === true,
              aceito_mentorado: aceites?.mentorado === true,
              falta,
              expira_em: vivo.expira_em,
              ritmo: vivo.escopo?.ritmo ?? null,
            }
          : null,
        // grade combinada (518): quem já marcou e os dias em comum —
        // dias_comuns 0 diz ao modelo pra pedir a grade antes de propor
        grade: {
          mentor: cx.gradeMentor != null,
          jovem: cx.gradeJovem != null,
          dias_comuns: cx.diasComuns,
          sem_grade: a.sem_grade === true,
        },
        recessos_pendentes: r.recessosPendentes.map((rec) => ({
          ciclo_evento_id: rec.cicloEventoId,
          titulo: rec.titulo,
          inicio: rec.inicio,
          fim: rec.fim,
        })),
        doc,
        pendencias_registro: r.pendenciasRegistro.map((p) => ({
          encontro_id: p.encontroId,
          numero: p.numero,
          estado: p.estado,
          data_hora: p.dataHora,
        })),
        passos: r.passos.map((p) => ({
          numero: p.numero,
          titulo: p.titulo,
          acao: p.acao,
          encontro_id: p.encontroId,
          data_sugerida: p.data,
          data_oficial: p.dataOficial,
          vence_no_caminho: p.venceNoCaminho === true,
          precondicao: p.precondicao ?? null,
          aviso: p.aviso ?? null,
        })),
        data_recuperacao: r.dataRecuperacao,
        data_projetada: r.dataProjetada,
        cabem_ate_encerramento: r.cabemAteEncerramento,
        alternativa_ritmo: r.alternativaRitmo,
        alternativa_recesso: r.alternativaRecesso,
        encerramento: r.encerramento,
        avisos: r.avisos,
      };
    },
  },

  plano_propor: {
    nome: "plano_propor",
    descricao:
      "Propõe e GRAVA o plano 'ficar em dia' de uma dupla DPP: o escopo sai do mesmo planner do plano_em_dia — encontros devidos e os que vencem no caminho, janela até o encerramento, ritmo combinado e o nível calculado — e a proposta fica persistida pra dupla aceitar ou contestar. O aceite é ÚNICO: o primeiro lado da dupla que aceita já põe o plano pra valer (mentor ou jovem que propõe já conta como o aceite desse lado) e o outro é avisado. Sem ritmo, usa o mais leve que fecha; o mínimo é 1 encontro por semana. As decisões do plano (recessos, grade, fusão) entram na proposta: decisoes_recesso declara cada recesso antes de propor (só a dupla declara — a equipe com recesso pendente é recusada), sem_grade combina sem a disponibilidade e fusao junta encontros na mesma sessão. Dupla em dia ou em 'conversa' (nem 1 por dia fecha) não tem proposta: aí o caminho é a coordenação. Só um plano aberto por dupla — contestado é terminal, acordo novo é versão nova. plano_em_dia mostra a prévia antes." +
      ESCRITA_DOC,
    schema: z
      .object({
        dupla_id: z.uuid().describe("id da dupla (uuid — plano_em_dia mostra a prévia)"),
        ritmo: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("encontros por semana, mínimo 1 e sem teto (a janela e a grade limitam na prática); omita pra usar o mais leve que fecha"),
        sem_grade: z
          .boolean()
          .optional()
          .describe("true = combina sem a grade de disponibilidade"),
        fusao: z
          .array(z.array(z.number().int().min(1)).min(2))
          .optional()
          .describe("sessões combinadas: grupos de números de encontro na mesma sessão de 2h"),
        decisoes_recesso: z
          .array(
            z.object({
              ciclo_evento_id: z.uuid(),
              usa: z.boolean(),
            })
          )
          .optional()
          .describe("decisão da dupla sobre cada recesso pendente — recessos_pendentes do plano_em_dia lista os ids; só a dupla declara"),
      })
      .strict(),
    // o jovem propõe pelo app (wizard da aba Agora) e pela RPC — paridade
    // no chat (527); equipe propõe sem poder declarar recesso
    roles: ["coordenacao", "supervisor", "mentor_dpp", "mentorado"],
    escreve: true,
    resumo: async (a: { dupla_id: string; ritmo?: number }, supabase) => {
      const dupla = await rotuloDupla(supabase, a.dupla_id);
      const base = `Propor o plano "ficar em dia"${dupla ? ` de ${dupla}` : " da dupla"}`;
      return a.ritmo
        ? `${base} com ${rotuloRitmo(a.ritmo)}`
        : `${base} no ritmo mais leve que fecha`;
    },
    run: async (a: PlanoProporArgs, ctx) => {
      const [eventos, cx] = await Promise.all([
        // idem plano_em_dia (527): o jovem propõe e a RLS o deixa sem
        // ciclo_eventos — catálogo de domínio via serviço
        getCicloEventosPlano(),
        contextoPlanoCom(ctx.supabase, a.dupla_id, []),
      ]);
      if ("error" in cx) throw new ErroTool(cx.error);
      const decisoes = (a.decisoes_recesso ?? []).map((x) => ({
        cicloEventoId: x.ciclo_evento_id,
        usa: x.usa,
      }));
      // a decisão de recesso é só da dupla — o mesmo gesto do combinarPlano
      // (518): só o que MUDOU viaja (a RPC é upsert cego e regravar a mesma
      // resposta roubaria a autoria) e staff que tenta declarar recebe a
      // recusa honesta do banco
      for (const dec of recessosAlterados(cx.dupla.recessos ?? [], decisoes)) {
        await rpcEscreve(ctx, "declarar_recesso", {
          p_dupla: a.dupla_id,
          p_evento: dec.cicloEventoId,
          p_usa: dec.usa,
        });
      }
      const dupla = comDecisoesRecesso(cx.dupla, decisoes);
      const agora = new Date();
      const r = montarPlanoEmDia({
        dupla,
        eventos,
        ritmo: a.ritmo,
        disponibilidade: a.sem_grade === true ? null : cx.combinada,
        fusao: a.fusao,
        hoje: agora,
      });
      if (!r.aplicavel) throw new ErroTool(r.motivo);
      if (r.recessosPendentes.length) {
        throw new ErroTool("Falta a dupla confirmar o recesso.");
      }
      // 018: fusão só nos passos que o combinado controla (travado fora)
      const gs = gruposDeSessao(
        a.fusao,
        r.passos.filter((p) => p.acao !== "travado").map((p) => p.numero)
      );
      if ("erro" in gs) throw new ErroTool(gs.erro);
      const e = escopoDaProposta(r, toDateStr(agora));
      if ("erro" in e) throw new ErroTool(e.erro);
      const escopo = {
        ...e.escopo,
        // snapshot das decisões do gesto (518) — o aceite compara pra
        // detectar "a resposta mudou depois da proposta"
        decisoes: {
          recessos: decisoes,
          sem_grade: a.sem_grade === true,
          ...(gs.grupos.length
            ? {
                fusao: {
                  aceita: true,
                  aviso_pratica: fusaoPedeAvisoPratica(gs.grupos),
                  pares: gs.grupos,
                },
              }
            : {}),
        },
      };
      const res = await rpcEscreve(ctx, "plano_propor", {
        p_dupla: a.dupla_id,
        p_escopo: escopo,
        p_via: "liza",
      });
      await emitirProdutoEvento(ctx.supabase, {
        superficie: "ia",
        acao: "plano_proposto",
        meta: {
          dupla_id: a.dupla_id,
          ritmo: escopo.ritmo,
          nivel: r.nivel,
          sem_grade: a.sem_grade === true,
        },
      });
      return res;
    },
  },

  plano_responder: {
    nome: "plano_responder",
    descricao:
      "Responde o plano 'ficar em dia' persistido: 'aceitar' carimba o aceite de quem responde — o aceite é ÚNICO, o primeiro lado que aceita já põe o plano pra valer e o outro é avisado; 'contestar' encerra o plano pra sempre — contestado é terminal, um novo acordo nasce como nova versão. Contestar só vale até o primeiro encontro do escopo acontecer; depois disso a conversa é com a coordenação. O plano_id vem de plano_em_dia, meu_plano ou da notificação." +
      ESCRITA_DOC,
    schema: z
      .object({
        plano_id: z.uuid().describe("id do plano (uuid)"),
        acao: z.enum(["aceitar", "contestar"]),
        motivo: z
          .string()
          .max(300)
          .optional()
          .describe("por que contestou (opcional, recomendado)"),
      })
      .strict(),
    roles: ["mentor_dpp", "mentorado"],
    escreve: true,
    resumo: async (a: { plano_id: string; acao: string }, supabase) => {
      const dupla = await rotuloPlano(supabase, a.plano_id);
      return `${a.acao === "aceitar" ? "Aceitar" : "Contestar"} o plano "ficar em dia"${dupla ? ` de ${dupla}` : ""}`;
    },
    run: async (
      a: { plano_id: string; acao: "aceitar" | "contestar"; motivo?: string },
      ctx
    ) => {
      const res = await rpcEscreve(ctx, "plano_responder", {
        p_plano: a.plano_id,
        p_acao: a.acao,
        p_motivo: a.motivo ?? null,
      });
      await emitirProdutoEvento(ctx.supabase, {
        superficie: "ia",
        acao: a.acao === "aceitar" ? "plano_aceito" : "plano_contestado",
        meta: { plano_id: a.plano_id },
      });
      return res;
    },
  },

  plano_aplicar_passo: {
    nome: "plano_aplicar_passo",
    descricao:
      "Aplica um passo do plano 'ficar em dia' aceito: grava a data combinada do encontro do escopo e anota no histórico do plano — uma gravação só, atômica. Vale pro mentor e pro jovem (o combinado é dos dois). Só números do escopo, só data futura dentro da janela, remarcar pede motivo; repetir o mesmo passo devolve o que já existe (idempotente)." +
      ESCRITA_DOC,
    schema: z
      .object({
        plano_id: z.uuid().describe("id do plano (uuid)"),
        numero: z.number().int().min(1).max(24).describe("encontro do escopo"),
        data_hora: z
          .string()
          .describe("data/hora ISO 8601 com fuso (ex.: 2026-12-01T19:00:00-03:00)"),
        link: z
          .string()
          .max(500)
          .optional()
          .describe("link https da chamada (opcional)"),
        motivo: z
          .string()
          .max(140)
          .optional()
          .describe("obrigatório quando a data já existia e muda"),
      })
      .strict(),
    roles: ["mentor_dpp", "mentorado"],
    escreve: true,
    resumo: async (
      a: { plano_id: string; numero: number; data_hora: string },
      supabase
    ) => {
      const dupla = await rotuloPlano(supabase, a.plano_id);
      return `Aplicar o passo do ${a.numero}º encontro${dupla ? ` de ${dupla}` : ""} em ${formatDiaHora(a.data_hora)}`;
    },
    run: async (
      a: { plano_id: string; numero: number; data_hora: string; link?: string; motivo?: string },
      ctx
    ) => {
      const res = await rpcEscreve(ctx, "plano_aplicar_passo", {
        p_plano: a.plano_id,
        p_numero: a.numero,
        p_data_hora: a.data_hora,
        p_link: a.link?.trim() || null,
        p_motivo: a.motivo ?? null,
        p_via: "liza",
      });
      await emitirProdutoEvento(ctx.supabase, {
        superficie: "ia",
        acao: "plano_passo",
        meta: { plano_id: a.plano_id, numero: a.numero },
      });
      return res;
    },
  },

  resumo_dupla: {
    nome: "resumo_dupla",
    descricao:
      "Resumo consolidado da dupla, gerado pelo resumo diário: semáforo, motivos e sinais, encontros feitos × esperados, próximos encontros, pendências de registro, perfil e interesses do jovem e o plano 'ficar em dia' vigente. O resultado já vem recortado por papel — pro mentorado chega sem semáforo/motivos/sinais. null quando o resumo diário ainda não rodou. Use pra uma visão rápida e barata da dupla; ficha_dupla dá o detalhe vivo.",
    schema: duplaIdArgs,
    roles: TODOS_PAPEIS,
    run: async ({ dupla_id }: z.infer<typeof duplaIdArgs>, ctx) => {
      const data = await rpcEscreve(ctx, "resumo_dupla", { p_dupla: dupla_id });
      const r = data as { ok?: boolean; resumo?: unknown } | null;
      return r?.resumo ?? null;
    },
  },

  meu_plano: {
    nome: "meu_plano",
    descricao:
      "O combinado do plano 'ficar em dia' da própria dupla do jovem: status, versão, ritmo combinado, os passos com datas e os passos já aplicados. Sem semáforo nem motivos internos — só o que a dupla combinou. null quando não há plano.",
    schema: semArgs,
    roles: ["mentorado"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const { data, error } = await ctx.supabase.rpc("jovem_plano");
      if (error) throw new ErroTool(error.message || "Não consegui ler o plano.");
      return data ?? null;
    },
  },

  intervencao_sugerir: {
    nome: "intervencao_sugerir",
    descricao:
      "Sugere uma intervenção estruturada na dupla: troca_mentor, troca_mentorado, pausa, dpp_para_esp (encerrar a trilha DPP seguindo com a especialista) ou encerramento — com evidências e o destino ('auxiliar' = supervisor da dupla, 'coordenacao'). A Liza SUGERE, nunca executa: quem decide é a equipe, pela fila de intervenções na ficha da dupla (chamado ou mensagem)." +
      ESCRITA_DOC,
    schema: z
      .object({
        dupla_id: z.uuid().describe("id da dupla (uuid)"),
        tipo: z.enum([
          "troca_mentor",
          "troca_mentorado",
          "pausa",
          "dpp_para_esp",
          "encerramento",
        ]),
        destino: z
          .enum(["auxiliar", "coordenacao"])
          .describe("auxiliar = supervisor da dupla; coordenacao = fila da coordenação"),
        motivo: z
          .string()
          .max(300)
          .optional()
          .describe("resumo do porquê, em uma linha"),
        evidencias: z
          .array(z.string().max(200))
          .max(6)
          .optional()
          .describe("fatos que sustentam a sugestão (sinais, datas, contagens)"),
      })
      .strict(),
    roles: ["coordenacao", "supervisor", "mentor_dpp"],
    escreve: true,
    resumo: async (
      a: { dupla_id: string; tipo: string; destino: string },
      supabase
    ) => {
      const dupla = await rotuloDupla(supabase, a.dupla_id);
      return `Sugerir intervenção "${a.tipo}" pra ${a.destino}${dupla ? ` (dupla ${dupla})` : ""}`;
    },
    run: async (
      a: { dupla_id: string; tipo: string; destino: string; motivo?: string; evidencias?: string[] },
      ctx
    ) => {
      const res = await rpcEscreve(ctx, "intervencao_sugerir", {
        p_dupla: a.dupla_id,
        p_tipo: a.tipo,
        p_evidencias: a.evidencias ?? [],
        p_destino: a.destino,
        p_motivo: a.motivo ?? null,
        p_via: "liza",
      });
      await emitirProdutoEvento(ctx.supabase, {
        superficie: "ia",
        acao: "plano_intervencao",
        meta: { dupla_id: a.dupla_id, tipo: a.tipo, destino: a.destino },
      });
      return res;
    },
  },

  guia_ajustar: {
    nome: "guia_ajustar",
    descricao:
      "Personaliza o guia de um encontro da dupla: lista de ajustes, cada um com sugestao e justificativa — o guia oficial continua sendo a base, os ajustes ficam ancorados a ele e aparecem na ficha e no preparo. Regravar o mesmo número substitui a lista inteira." +
      ESCRITA_DOC,
    schema: z
      .object({
        dupla_id: z.uuid().describe("id da dupla (uuid)"),
        numero: z.number().int().min(1).max(24).describe("encontro do guia"),
        ajustes: z
          .array(
            z
              .object({
                sugestao: z.string().min(2).max(500),
                justificativa: z.string().min(2).max(500),
              })
              .strict()
          )
          .min(1)
          .max(10),
      })
      .strict(),
    roles: ["coordenacao", "mentor_dpp"],
    escreve: true,
    resumo: async (
      a: {
        dupla_id: string;
        numero: number;
        ajustes: { sugestao: string }[];
      },
      supabase
    ) => {
      const dupla = await rotuloDupla(supabase, a.dupla_id);
      return `Ajustar o guia do ${a.numero}º encontro${dupla ? ` de ${dupla}` : ""} (${a.ajustes.length} ajuste${a.ajustes.length > 1 ? "s" : ""})`;
    },
    run: async (
      a: { dupla_id: string; numero: number; ajustes: { sugestao: string; justificativa: string }[] },
      ctx
    ) => {
      const res = await rpcEscreve(ctx, "guia_ajuste_salvar", {
        p_dupla: a.dupla_id,
        p_numero: a.numero,
        p_ajustes: a.ajustes,
        p_via: "liza",
      });
      await emitirProdutoEvento(ctx.supabase, {
        superficie: "ia",
        acao: "plano_guia",
        meta: { dupla_id: a.dupla_id, numero: a.numero },
      });
      return res;
    },
  },

  guia_limpar: {
    nome: "guia_limpar",
    descricao:
      "Volta um encontro da dupla ao guia oficial: apaga os ajustes personalizados daquele número — a ficha e o preparo passam a mostrar só o guia base." +
      ESCRITA_DOC,
    schema: z
      .object({
        dupla_id: z.uuid().describe("id da dupla (uuid)"),
        numero: z.number().int().min(1).max(24).describe("encontro do guia"),
      })
      .strict(),
    roles: ["coordenacao", "mentor_dpp"],
    escreve: true,
    resumo: async (a: { dupla_id: string; numero: number }, supabase) => {
      const dupla = await rotuloDupla(supabase, a.dupla_id);
      return `Voltar o ${a.numero}º encontro${dupla ? ` de ${dupla}` : ""} ao guia oficial`;
    },
    run: async (a: { dupla_id: string; numero: number }, ctx) => {
      const res = await rpcEscreve(ctx, "guia_ajuste_limpar", {
        p_dupla: a.dupla_id,
        p_numero: a.numero,
      });
      await emitirProdutoEvento(ctx.supabase, {
        superficie: "ia",
        acao: "plano_guia",
        meta: { dupla_id: a.dupla_id, numero: a.numero, limpar: true },
      });
      return res;
    },
  },

  registros_da_dupla: {
    nome: "registros_da_dupla",
    descricao:
      "Follow-ups semanais de uma dupla — SÓ campos estruturados: número do encontro, datas, avaliação do mentor, dificuldade (enum), atividades, pedido de apoio e próximo passo. Reflexões, observações e detalhes livres não existem pra esta tool (fora da allowlist, por desenho).",
    schema: registrosArgs,
    roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"],
    run: async ({ dupla_id, limite }: z.infer<typeof registrosArgs>, ctx) => {
      const itens = await getRegistrosDaDuplaIa(
        ctx.supabase,
        dupla_id,
        limite ?? 20
      );
      return {
        dupla_id,
        total: itens.length,
        registros: itens.map((r) => ({
          encontro_numero: r.encontro.numero,
          agendado_em: r.encontro.data_hora,
          realizado_em: r.encontro.realizado_em,
          avaliacao: r.avaliacao,
          dificuldade: r.dificuldade,
          atividades: r.atividades,
          precisa_apoio: r.precisa_apoio,
          proximo_passo: r.proximo_passo,
          registrado_em: r.created_at,
        })),
      };
    },
  },

  aguardando_par: {
    nome: "aguardando_par",
    descricao:
      "A fila de espera por pareamento, derivada ao vivo como na página de Pessoas: mentorados inscritos que nunca tiveram dupla (com origem e desde quando esperam) e mentores DPP ativos com vaga livre. Especialistas não entram — parejam por demanda, não aguardam par. Use pra 'quem tá esperando par?', 'quantos jovens na fila?'.",
    schema: semArgs,
    roles: ["coordenacao"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const ins = await getFilaInsumos(ctx.supabase);
      // contato cru (whatsapp) não sai pela tool — a fila responde "quem e
      // desde quando"; chamar a pessoa é gesto da tela, não do modelo
      const mentorados = filaMentorados(
        ins.mentorados as Mentorado[],
        ins.ocupados,
        ins.historico,
        ins.disponivelDesde
      ).map((m) => ({
        id: m.id,
        nome: m.nome, // FilaItem.nome já vem coalescido (social ?? civil)
        origem: m.origem,
        esperando_desde: m.desde,
      }));
      const mentores = filaMentores(
        ins.pessoas as Profile[],
        ins.mentorProfiles,
        ins.contagemPorMentor,
        ins.disponivelDesde
      ).map((m) => ({
        id: m.id,
        nome: m.nome,
        vagas: m.vagas,
        origem: m.origem,
        esperando_desde: m.desde,
      }));
      return {
        mentorados,
        mentores,
        total: mentorados.length + mentores.length,
      };
    },
  },

  capacidade_mentores: {
    nome: "capacidade_mentores",
    descricao:
      "Ocupação dos mentores ativos: quantas duplas vivas cada um tem vs. o teto da trilha dele (X/Y — DPP contra `capacidade`, especialista contra `capacidade_especialista`). Use pra 'quem tem vaga?', 'dá pra parear mais?'.",
    schema: semArgs,
    roles: ["coordenacao"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const ins = await getCapacidadeInsumos(ctx.supabase);
      // uma linha por trilha servida (WP6b) — o híbrido aparece nas duas,
      // cada uma com uso e teto da própria pool
      const mentores = ins.pessoas
        .filter((p) => p.ativo)
        .flatMap((p) => {
          const trilhas = [
            temPapel(p, "mentor_dpp") ? ("dpp" as const) : null,
            temPapel(p, "mentor_especialista") ? ("especialista" as const) : null,
          ].filter((t): t is "dpp" | "especialista" => t != null);
          return trilhas.map((trilha) => ({
            mentor_id: p.id,
            nome: p.nome_social ?? p.nome,
            trilha,
            em_uso: ins.contagemPorMentor[`${p.id}:${trilha}`] ?? 0,
            capacidade: tetoMentor(p, ins.mentorProfiles[p.id], trilha),
          }));
        })
        .sort((a, b) => comparaNome(a.nome, b.nome));
      return { mentores, total: mentores.length };
    },
  },

  adocao_por_dia: {
    nome: "adocao_por_dia",
    descricao:
      "Gestos de produto por dia na janela (a série temporal da aba Adoção): um ponto por dia com o total de gestos — respeita o recorte `papel`. Use pra 'o uso está crescendo?', 'teve pico/dia parado?', 'movimento desta semana'.",
    schema: adocaoArgs,
    roles: ["coordenacao"],
    run: async ({ dias, papel }: z.infer<typeof adocaoArgs>, ctx) => {
      const janela = dias ?? 30;
      const desde = new Date(Date.now() - janela * 86400_000);
      const serie = await dadosAdocaoSerieDia(
        ctx.supabase,
        desde,
        papel ?? null
      );
      return { janela_dias: janela, papel: papel ?? "todos", serie };
    },
  },

  adocao_caminhos: {
    nome: "adocao_caminhos",
    descricao:
      "Sequências de superfícies mais percorridas na janela (sessionizadas por pessoa×dia, repetições adjacentes colapsadas): cada caminho devolve os trechos na ordem e quantas pessoas percorreram. Respeita `papel`. Use pra 'por onde as pessoas navegam?', 'fluxo típico do mentor', 'abrem o quê depois do quê?'.",
    schema: adocaoCaminhosArgs,
    roles: ["coordenacao"],
    run: async (
      { dias, papel, top }: z.infer<typeof adocaoCaminhosArgs>,
      ctx
    ) => {
      const janela = dias ?? 30;
      const desde = new Date(Date.now() - janela * 86400_000);
      const caminhos = await dadosAdocaoCaminhos(
        ctx.supabase,
        desde,
        top ?? 8,
        papel ?? null
      );
      return { janela_dias: janela, papel: papel ?? "todos", caminhos };
    },
  },

  adocao_coorte: {
    nome: "adocao_coorte",
    descricao:
      "Retenção semanal por coorte de entrada no produto: % das pessoas ativas em cada semana após a primeira (sem 0-8), com 0% real distinto de semana futura. Programa inteiro — retenção é dimensão-pessoa, não recorta por papel. Use pra 'as pessoas voltam?', 'retenção das turmas novas', 'engajamento morre depois de quanto tempo?'.",
    schema: adocaoCoorteArgs,
    roles: ["coordenacao"],
    run: async ({ semanas }: z.infer<typeof adocaoCoorteArgs>, ctx) => {
      const n = semanas ?? 8;
      const coortes = await dadosAdocaoCoorte(ctx.supabase, n);
      return { semanas: n, escopo: "programa", coortes };
    },
  },

  adocao_funil: {
    nome: "adocao_funil",
    descricao:
      "Funil dos instrumentos na janela (avaliações + formulários): emitidos → respondidos com janela de conversão de 14 dias declarada, mais tardios (responderam depois do prazo), expirados e pendentes nomeados; linhas `campanha` são links multi-uso de divulgação sem denominador observável. Escopo programa — não recorta por papel. Use pra 'respondem os formulários?', 'taxa da avaliação de encontro', 'o link de intake converte?'.",
    schema: adocaoJanelaArgs,
    roles: ["coordenacao"],
    run: async ({ dias }: z.infer<typeof adocaoJanelaArgs>, ctx) => {
      const janela = dias ?? 30;
      const desde = new Date(Date.now() - janela * 86400_000);
      const instrumentos = await dadosFunilInstrumentos(ctx.supabase, desde);
      return {
        janela_dias: janela,
        conversao_dias: FUNIL_JANELA_DIAS,
        instrumentos,
      };
    },
  },

  adocao_por_superficie: {
    nome: "adocao_por_superficie",
    descricao:
      "Adoção do produto por superfície (analytics interno — gestos coletados pelo beacon e server-side): as áreas do app (duplas, ficha_dupla, agenda, materiais, formularios…) ordenadas por gestos na janela, cada uma com pessoas únicas, total de gestos, os papéis que usaram e o último gesto. Devolve também os KPIs da janela — pessoas ativas, gestos e superfícies vivas, comparados à janela anterior equivalente (respeitam o recorte `papel` quando informado). Use pra 'o que mais usam?', 'adoção por superfície', 'a área X é usada?', 'mentor usa o quê?'.",
    schema: adocaoArgs,
    roles: ["coordenacao"],
    run: async (
      { dias, papel }: z.infer<typeof adocaoArgs>,
      ctx
    ) => {
      const janela = dias ?? 30;
      const desde = new Date(
        Date.now() - janela * 86400_000
      ).toISOString();
      const [superficies, resumo] = await Promise.all([
        getAdocaoSuperficiesIa(ctx.supabase, desde, papel ?? null),
        getAdocaoResumoIa(ctx.supabase, desde, papel ?? null),
      ]);
      return {
        janela_dias: janela,
        papel: papel ?? "todos",
        resumo,
        total_superficies: superficies.length,
        superficies,
      };
    },
  },

  duplas_do_usuario: {
    nome: "duplas_do_usuario",
    descricao:
      "Índice das duplas que o usuário enxerga: o mentor vê as dele, o supervisor as supervisionadas, a coordenação todas. Devolve nomes, trilha, status e turma de cada uma + o dupla_id pra chamar ficha_dupla/registros_da_dupla quando a pergunta vier sem id ('minha dupla', 'com quem eu trabalho') — o id é bastidor, vai só em args de tool e nunca no texto. `total` é o universo no escopo; quando `truncado` vier true a lista é parcial (máx 60) — avise que há mais duplas além das listadas.",
    schema: semArgs,
    // mentorado fica fora: ele não tem grant na tabela duplas (a ficha dele
    // vem da view jovem_duplas em ficha_dupla) — e o índice não serve pra
    // quem só enxerga uma dupla
    roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const { duplas, total } = await getDuplasResumoIa(ctx.supabase);
      return {
        total,
        // o índice corta em 60 — truncado:true diz ao modelo que a lista é
        // parcial e que "quantas duplas" é o total, não duplas.length
        truncado: total > duplas.length,
        duplas: duplas.map((d) => ({
          dupla_id: d.id,
          mentor: d.mentor?.nome_social ?? d.mentor?.nome ?? null,
          mentorado: d.mentorado?.nome_social ?? d.mentorado?.nome ?? null,
          trilha: d.trilha,
          status: d.status,
          turma: d.turma,
        })),
      };
    },
  },

  duplas_panorama: {
    nome: "duplas_panorama",
    descricao:
      "Panorama das duplas com estado: cada linha traz nomes, trilha, status, o semáforo (ok, atenção ou risco) com o motivo, apoio aberto, quantos encontros eram esperados × realizados, registro pendente e o próximo encontro marcado — até 6, ordenadas pelo que pede ação primeiro (apoio aberto → risco → atenção → ok), com `total` do escopo e `truncado` quando a lista é parcial. Use pra 'como estão minhas duplas?', 'quais são minhas duplas?', 'panorama das duplas', 'tem alguma precisando de atenção?'. Pra resolver o id de uma dupla use duplas_do_usuario; pro detalhe de uma só use ficha_dupla.",
    schema: semArgs,
    // mesmos papéis do índice: quem não enxerga dupla nenhuma não tem
    // panorama — a recusa honesta se mantém
    roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const [duplas, eventos] = await Promise.all([
        getDuplasVivasIa(ctx.supabase),
        getCicloEventosIa(ctx.supabase),
      ]);
      return projetarPanorama(duplas, eventos);
    },
  },

  mensagem_template: {
    nome: "mensagem_template",
    descricao:
      "Template de mensagem do guia (cap. 14) pronto pra personalizar: o texto do modelo com os [colchetes] visíveis + os dados da dupla pra preencher — nomes reais, whatsapp, próximo encontro e, conforme o template, as tarefas pendentes ou cada pessoa indicada com o link próprio. Use quando a pessoa pedir pra personalizar/usar um modelo de mensagem — preparação do(a) mentorado(a), mensagem às pessoas indicadas ou encaminhamento entre encontros. SEM dupla_id devolve o template + as duplas do escopo: com duas ou mais, pergunte qual com ```escolha antes de montar o texto; com uma só (ou a dupla já óbvia na conversa), chame de novo com o dupla_id. COM dupla_id devolve o template + a dupla — monte a mensagem final num bloco ```rascunho seguindo a `nota` do template.",
    schema: mensagemTemplateArgs,
    // mentorado fica fora: os templates são mensagens do ADULTO pra dupla
    // ou pras pessoas indicadas — a casa dele não manda isso
    roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"],
    run: async ({ slug, dupla_id }: z.infer<typeof mensagemTemplateArgs>, ctx) => {
      const template = mensagemTemplateTexto(slug);
      if (!template) return null;
      if (!dupla_id) {
        // sem a dupla ainda: o índice do escopo alimenta a escolha — com
        // 2+ duplas a pergunta "qual dupla?" vem antes do texto
        const { duplas, total } = await getDuplasResumoIa(ctx.supabase);
        return {
          template,
          total,
          truncado: total > duplas.length,
          duplas: duplas.map((d) => ({
            dupla_id: d.id,
            mentor: d.mentor?.nome_social ?? d.mentor?.nome ?? null,
            mentorado: d.mentorado?.nome_social ?? d.mentorado?.nome ?? null,
            trilha: d.trilha,
            status: d.status,
            turma: d.turma,
          })),
        };
      }
      const [d, eventos] = await Promise.all([
        getDuplaIa(ctx.supabase, dupla_id),
        getCicloEventosIa(ctx.supabase),
      ]);
      if (!d) return { template, dupla: null };
      // insumos por template, no escopo do que cada um precisa preencher:
      // tarefa+prazo (encaminhamento) e as indicadas com link (indicadas)
      const [combinados, indicadas] = await Promise.all([
        slug === "mensagem-encaminhamento"
          ? getEncaminhamentosIa(ctx.supabase, {
              duplaId: dupla_id,
              status: "pendente",
              limite: 6,
            })
          : Promise.resolve(null),
        slug === "mensagem-indicadas"
          ? getTerceirosIa(ctx.supabase, dupla_id)
          : Promise.resolve(null),
      ]);
      const s = saudadeDaDupla(d as unknown as Dupla, eventos);
      const ultimo = d.encontros
        .filter((e) => e.status === "realizado")
        .sort((a, b) => b.numero - a.numero)[0];
      const contato = (
        p: { nome: string; nome_social: string | null; whatsapp?: string | null } | null
      ) =>
        p
          ? {
              nome: p.nome_social ?? p.nome,
              whatsapp: p.whatsapp ?? null,
            }
          : null;
      return {
        template,
        dupla: {
          dupla_id: d.id,
          trilha: d.trilha,
          status: d.status,
          turma: d.turma,
          mentor: d.mentor?.nome_social ?? d.mentor?.nome ?? null,
          mentorado: d.mentorado?.nome_social ?? d.mentorado?.nome ?? null,
          // contato por pessoa: o ```rascunho copia o whatsapp pra `numero`
          contatos: {
            mentor: contato(d.mentor),
            mentorado: contato(d.mentorado),
            supervisor: contato(d.supervisor),
          },
          proximo_encontro: s.proximo
            ? { numero: s.proximo.numero, data_hora: s.proximo.data_hora }
            : null,
          ultimo_encontro: ultimo
            ? { numero: ultimo.numero, realizado_em: ultimo.realizado_em }
            : null,
          ...(combinados
            ? {
                combinados_pendentes: combinados.map((t) => ({
                  texto: t.descricao,
                  prazo: t.prazo,
                })),
              }
            : {}),
          ...(indicadas
            ? {
                indicadas: indicadas.map((c) => ({
                  nome: c.nome,
                  vinculo: c.vinculo,
                  whatsapp: c.whatsapp,
                  // link público individual do convite — vai no [link] do
                  // texto; a base é a do deploy (SITE_URL), igual aos CTAs
                  link: `${SITE_URL}/t/${c.token}`,
                  expira_em: c.expira_em,
                  status: c.status,
                })),
              }
            : {}),
        },
      };
    },
  },

  agenda_do_periodo: {
    nome: "agenda_do_periodo",
    descricao:
      "Encontros das duplas numa janela de dias (padrão: próximos 14, com os últimos 3 incluídos): número do encontro, a dupla, o status e a data/hora. Use pra 'o que tem essa semana?', 'próximos encontros', 'agenda da dupla'.",
    schema: agendaArgs,
    roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"],
    run: async ({ dias, incluir_recentes }: z.infer<typeof agendaArgs>, ctx) => {
      const agora = Date.now();
      const desde = new Date(
        agora - (incluir_recentes === false ? 0 : 3) * 86_400_000
      ).toISOString();
      const ate = new Date(agora + (dias ?? 14) * 86_400_000).toISOString();
      const encontros = await getAgendaPeriodoIa(ctx.supabase, desde, ate);
      return {
        desde,
        ate,
        total: encontros.length,
        encontros: encontros.map((e) => ({
          dupla_id: e.dupla.id,
          mentor: e.dupla.mentor?.nome_social ?? e.dupla.mentor?.nome ?? null,
          mentorado:
            e.dupla.mentorado?.nome_social ?? e.dupla.mentorado?.nome ?? null,
          numero: e.numero,
          status: e.status,
          data_hora: e.data_hora,
          realizado_em: e.realizado_em,
        })),
      };
    },
  },

  historico_encontros: {
    nome: "historico_encontros",
    descricao:
      "Agregado de encontros numa janela PASSADA (padrão últimos 30 dias): esperados × realizados, não acontecidos, atrasados (agendado/remarcado já vencido) e futuros — total do escopo e por dupla, separável por trilha. Use pra 'quantos encontros rolaram nos últimos 30 dias?', 'taxa de realização do ciclo', 'quem está furando encontro', 'como foi a última semana'. NÃO é a agenda futura (essa é agenda_do_periodo).",
    schema: historicoArgs,
    roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"],
    run: async ({ dias, dupla_id }: z.infer<typeof historicoArgs>, ctx) => {
      const agora = Date.now();
      const desde = new Date(agora - (dias ?? 30) * 86_400_000).toISOString();
      const encontros = await getHistoricoEncontrosIa(
        ctx.supabase,
        desde,
        dupla_id
      );
      type Acum = {
        dupla_id: string;
        trilha: string;
        mentor: string | null;
        mentorado: string | null;
        esperados: number;
        realizados: number;
        nao_aconteceu: number;
        atrasados: number;
        futuros: number;
        cancelados: number;
      };
      const porDupla = new Map<string, Acum>();
      const nome = (p: { nome: string; nome_social: string | null } | null) =>
        p ? (p.nome_social ?? p.nome) : null;
      for (const e of encontros) {
        const id = e.dupla.id;
        let a = porDupla.get(id);
        if (!a) {
          a = {
            dupla_id: id,
            trilha: e.dupla.trilha ?? "dpp",
            mentor: nome(e.dupla.mentor),
            mentorado: nome(e.dupla.mentorado),
            esperados: 0,
            realizados: 0,
            nao_aconteceu: 0,
            atrasados: 0,
            futuros: 0,
            cancelados: 0,
          };
          porDupla.set(id, a);
        }
        const passou = e.data_hora !== null && e.data_hora <= new Date(agora).toISOString();
        if (e.status === "realizado") a.realizados++;
        else if (e.status === "nao_aconteceu") a.nao_aconteceu++;
        else if (e.status === "cancelado") a.cancelados++;
        else if (passou) a.atrasados++;
        else a.futuros++;
      }
      const lista = [...porDupla.values()].map((a) => ({
        ...a,
        esperados: a.realizados + a.nao_aconteceu + a.atrasados,
      }));
      // mais atraso primeiro — é onde a coordenação precisa agir
      lista.sort((x, y) => y.atrasados - x.atrasados || y.esperados - x.esperados);
      const soma = (k: keyof Acum) =>
        lista.reduce((acc, d) => acc + (d[k] as number), 0);
      return {
        desde,
        dias: dias ?? 30,
        resumo: {
          duplas: lista.length,
          esperados: soma("esperados"),
          realizados: soma("realizados"),
          nao_aconteceu: soma("nao_aconteceu"),
          atrasados: soma("atrasados"),
          futuros: soma("futuros"),
          cancelados: soma("cancelados"),
        },
        por_dupla: lista.slice(0, 30),
        ...(encontros.length === 600
          ? { aviso: "janela cortada em 600 linhas — números parciais" }
          : {}),
      };
    },
  },

  combinados_das_duplas: {
    nome: "combinados_das_duplas",
    descricao:
      "Os combinados (encaminhamentos) das duplas no escopo da pessoa: o que ficou prometido, pra quando, por quem — com a dupla, trilha e turma de contexto; vencido vem marcado em `atrasado`. A RLS decide o recorte (coordenação tudo, auxiliar as supervisionadas, mentor as próprias). Use pra 'combinados vencidos', 'o que a dupla X prometeu', 'pendências que eu preciso cobrar'. Pro jovem os dele saem por meus_combinados.",
    schema: combinadosArgs,
    roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"],
    run: async (
      { dupla_id, status, limite }: z.infer<typeof combinadosArgs>,
      ctx
    ) => {
      const linhas = await getEncaminhamentosIa(ctx.supabase, {
        duplaId: dupla_id,
        status: status ?? "pendente",
        limite: limite ?? 40,
      });
      const hoje = toDateStr(new Date());
      const combinados = linhas.map((t) => ({
        // id endereça a linha — quando a ação de staff sobre combinado
        // existir ela endereça por uuid, como jovem_marcar_combinado
        id: t.id,
        dupla_id: t.dupla.id,
        mentor: t.dupla.mentor?.nome_social ?? t.dupla.mentor?.nome ?? null,
        mentorado:
          t.dupla.mentorado?.nome_social ?? t.dupla.mentorado?.nome ?? null,
        trilha: t.dupla.trilha,
        turma: t.dupla.turma,
        // passo do guia que gerou o combinado (0157) — null em antigo
        // sem registro; diz em que ponto da jornada a promessa nasceu
        numero: t.numero,
        texto: t.descricao,
        responsavel: t.responsavel,
        prazo: t.prazo,
        status: t.status,
        // 'atrasado' é valor-fantasma (deriva de data, nunca se grava) —
        // a tool computa com a mesma régua do semáforo (ciclo.ts)
        atrasado: t.status === "pendente" && t.prazo != null && t.prazo < hoje,
        feito_em: t.feito_em,
        criado_em: t.created_at,
      }));
      return {
        total: combinados.length,
        vencidos: combinados.filter((c) => c.atrasado).length,
        combinados,
      };
    },
  },

  guia_consulta: {
    nome: "guia_consulta",
    descricao:
      "Busca nos guias oficiais do programa (Guia do Mentor DPP, Guia do Mentor Especialista, roteiros dos 16 encontros, instrumentos, cronograma do ciclo, código de ética e decisões operacionais da plataforma): metodologia, encontros, instrumentos, papéis, regras de reposição, formação, LGPD/termo. Use pra qualquer pergunta sobre 'como funciona', 'o que o guia diz', metodologia ou regras do programa — NÃO pra dados das duplas do usuário (essas saem das outras tools). Devolve trechos citáveis com guia e seção (sem número de página: a referência é sempre 'documento, seção') + `guias` (o catálogo completo de documentos disponíveis — use pra responder quando perguntarem quais guias/fontes existem); quando não achar trecho pro termo, diga que não está nos guias e sugira a coordenação. Chame **no máximo uma vez** por pergunta — depois responda com os trechos recebidos (cite guia e seção).",
    schema: guiaArgs,
    roles: TODOS_PAPEIS,
    run: async ({ pergunta }: z.infer<typeof guiaArgs>, ctx) => {
      // flag coord "busca" ("fts" desliga o braço vetorial sem deploy):
      // vem da config viva já cacheada (config.ts) — lida ANTES de embedar,
      // com fts nenhuma pergunta vai pra OpenAI (minimização). Trocar pra
      // "fts" vale em até 30s por instância (TTL da config), não na hora:
      // atraso aceito em troca de não ler ia_config a cada busca
      const { busca } = await getIaConfig(ctx.supabase);
      // audiência do frontmatter vale aqui como em /materiais/documento:
      // roteiro e instrumento DPP não chegam ao jovem pelo chat
      const leitor = { role: ctx.papel, papeis: ctx.papeis };
      const [fontes, guias] = await Promise.all([
        buscarNosGuias(ctx.supabase, pergunta, busca, leitor),
        // catálogo sempre junto — "que guias você tem" se responde
        // mesmo quando a busca não retorna trecho pro termo perguntado
        catalogoGuias(ctx.supabase, leitor),
      ]);
      return { fontes, guias };
    },
  },

  chamados_resumo: {
    nome: "chamados_resumo",
    descricao:
      "Chamados de apoio abertos ou em atendimento (REALIZA-325): número, categoria, assunto, status e a dupla ligada — a RLS decide o escopo (staff vê a fila inteira, mentor os próprios). Use pra 'quantos chamados abertos?', 'pedidos de apoio pendentes', 'o que a equipe tá atendendo'. O conteúdo das mensagens não sai pela tool — detalhe fica na tela de Chamados.",
    schema: semArgs,
    roles: TODOS_PAPEIS,
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const itens = await getChamadosIa(ctx.supabase);
      const porStatus = { aberto: 0, em_atendimento: 0 };
      for (const c of itens) {
        if (c.status === "aberto") porStatus.aberto++;
        else if (c.status === "em_atendimento") porStatus.em_atendimento++;
      }
      return {
        total: itens.length,
        ...porStatus,
        chamados: itens.map((c) => ({
          // id vai junto: as tools de escrita de chamado (MCP) endereçam
          // por uuid — o número CHA segue fora por ser ruído de protocolo
          id: c.id,
          numero: c.numero,
          categoria: c.categoria,
          assunto: c.assunto,
          status: c.status,
          dupla_id: c.dupla_id,
          criado_em: c.created_at,
        })),
      };
    },
  },

  pessoas_busca: {
    nome: "pessoas_busca",
    descricao:
      "Busca pessoas do programa por nome (staff): devolve nome, nome social e papel + o profile_id que as tools de pessoa consomem (bastidor, nunca no texto) — use pra achar a pessoa antes de perguntar pela ficha dela, ou pra responder 'quem é X'. Contatos e dados sensíveis não saem pela tool.",
    schema: z
      .object({
        nome: z
          .string()
          .min(2)
          .max(80)
          .describe("nome (ou trecho do nome) da pessoa"),
      })
      .strict(),
    roles: ["coordenacao", "supervisor"],
    run: async ({ nome }: { nome: string }, ctx) => {
      const pessoas = await getPessoasBuscaIa(ctx.supabase, nome);
      return {
        total: pessoas.length,
        pessoas: pessoas.map((p) => ({
          profile_id: p.id,
          nome: p.nome_social || p.nome,
          papel: p.role,
        })),
      };
    },
  },

  instrumentos_da_dupla: {
    nome: "instrumentos_da_dupla",
    descricao:
      "Os 4 instrumentos oficiais da jornada (Visão, Metas, PDM e Roda da Vida) de uma dupla: definição, links emitidos e as respostas já dadas — já recortada pelo papel de quem lê (coord, mentor e supervisor da dupla e o próprio jovem).",
    schema: duplaIdArgs,
    roles: TODOS_PAPEIS,
    run: async ({ dupla_id }: z.infer<typeof duplaIdArgs>, ctx) => {
      try {
        return await getInstrumentosDaDuplaIa(ctx.supabase, dupla_id);
      } catch (e) {
        // PostgrestError não é Error — a RPC definer sinaliza o escopo na
        // message ("sem permissão pra ver instrumentos desta dupla"), que
        // dá pra repassar ao modelo
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as { message: unknown }).message)
            : "";
        throw new ErroTool(
          msg || "Não consegui ler os instrumentos desta dupla."
        );
      }
    },
  },

  // ---------- mentorado (pacote liza nov/2026 — sdd D5) ----------
  // Só leitura, só o próprio recorte: as queries leem views jovem_* e
  // tabelas de policy aberta — o mesmo perímetro que o shell /jovem usa.
  // Nenhuma escreve; nenhuma expõe dado de staff (semáforo, motivo,
  // registro do mentor ficam fora por desenho).

  minha_dupla: {
    nome: "minha_dupla",
    descricao:
      "A dupla do jovem que está falando: mentor, supervisor, trilha, turma e status — sem precisar de id, já vem escopada. Use pra 'quem é meu mentor?', 'minha dupla', 'com quem eu converso' e antes de abrir instrumentos da própria dupla (o dupla_id que ela devolve é bastidor: só em args de tool, nunca no texto).",
    schema: semArgs,
    roles: ["mentorado"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const d = await getMinhaDuplaIa(ctx.supabase);
      if (!d) return null;
      // encontros alimentam os quadrados do card — mesma leitura da
      // ficha_dupla do jovem (encontros_select já escopa à dupla dele);
      // contatos vêm da view escopada como na ficha — "manda mensagem pro
      // meu mentor" chama minha_dupla, não ficha_dupla
      const [ficha, contatos] = await Promise.all([
        getJovemDuplaIa(ctx.supabase, d.id),
        getJovemContatoIa(ctx.supabase, d.id),
      ]);
      const wa = (papeis: string[]) =>
        contatos.find((c) => papeis.includes(c.papel))?.whatsapp ?? null;
      return {
        dupla_id: d.id,
        trilha: d.trilha,
        status: d.status,
        turma: d.turma,
        iniciada_em: d.iniciada_em,
        demanda: d.demanda,
        mentor: d.mentor_nome_social ?? d.mentor_nome,
        supervisor: d.supervisor_nome_social ?? d.supervisor_nome,
        contatos: {
          mentor: {
            nome: d.mentor_nome_social ?? d.mentor_nome,
            whatsapp: wa(["mentor", "especialista"]),
          },
          supervisor: {
            nome: d.supervisor_nome_social ?? d.supervisor_nome,
            whatsapp: wa(["supervisor"]),
          },
        },
        encontros: ficha?.encontros ?? [],
      };
    },
  },

  minha_agenda: {
    nome: "minha_agenda",
    descricao:
      "A agenda de encontros do jovem: os próximos marcados (com data e link da chamada) e os últimos realizados. Use pra 'quando é meu próximo encontro?', 'minha agenda', 'tive encontro essa semana?'.",
    schema: semArgs,
    roles: ["mentorado"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const { proximos, passados } = await getJovemAgendaIa(ctx.supabase);
      if (!proximos.length && !passados.length) return null;
      // mentor de cada dupla pra linha ler "Ricardo e • Você" — DPP e
      // trilha de especialista convivem na mesma agenda do jovem
      const { data: duplas } = await ctx.supabase
        .from("jovem_duplas")
        .select("id, mentor_nome, mentor_nome_social");
      const nomes = new Map(
        (duplas ?? []).map((d) => [
          d.id,
          (d.mentor_nome_social ?? d.mentor_nome) as string | null,
        ])
      );
      return {
        proximos: proximos.map((e) => ({
          // id vai junto: as tools de escrita do jovem (desmarcar,
          // marcar aconteceu/não aconteceu) endereçam o encontro por uuid
          id: e.id,
          dupla_id: e.dupla_id,
          mentor: nomes.get(e.dupla_id) ?? null,
          numero: e.numero,
          data_hora: e.data_hora,
          status: e.status,
          link: e.link,
        })),
        ultimos_realizados: passados.map((e) => ({
          numero: e.numero,
          realizado_em: e.realizado_em ?? e.data_hora,
        })),
      };
    },
  },

  meus_combinados: {
    nome: "meus_combinados",
    descricao:
      "Os combinados do jovem com o mentor (encaminhamentos): o que tá pendente com prazo e o que já foi marcado como feito. Use pra 'o que eu tenho pra fazer?', 'meus combinados', 'tarefas', 'o que falta entregar'.",
    schema: semArgs,
    roles: ["mentorado"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const { pendentes, feitos } = await getJovemCombinadosIa(ctx.supabase);
      if (!pendentes.length && !feitos.length) return null;
      return {
        pendentes: pendentes.map((c) => ({
          // id pra jovem_marcar_combinado (MCP) endereçar por uuid
          id: c.id,
          texto: c.texto,
          prazo: c.prazo,
          criado_em: c.created_at,
        })),
        feitos_recentes: feitos.map((c) => ({ texto: c.texto })),
      };
    },
  },

  meu_progresso: {
    nome: "meu_progresso",
    descricao:
      "O progresso do jovem na jornada: quais instrumentos (Visão, Metas, PDM, Roda da Vida, avaliação 360) já foram respondidos e o que ainda tá pendente pra ele. Use pra 'como tá minha jornada?', 'meu progresso', 'o que falta responder', 'tô atrasado?'.",
    schema: semArgs,
    roles: ["mentorado"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const j = await getJovemProgressoIa(ctx.supabase);
      if (!j) return null;
      const instrumentos = (j.instrumentos ?? []).map((i) => {
        const minhas = (i.entregas ?? []).filter((e) => e.destino === "mentorado");
        return {
          sistema: i.sistema,
          titulo: i.titulo ?? i.sistema,
          respondidos: minhas.filter((e) => e.status === "respondido").length,
          pendentes: minhas.filter((e) => e.status === "pendente").length,
        };
      });
      return {
        dupla_id: j.dupla_id,
        instrumentos,
        total_respondidos: instrumentos.reduce((a, i) => a + i.respondidos, 0),
        total_pendentes: instrumentos.reduce((a, i) => a + i.pendentes, 0),
      };
    },
  },

  meus_pedidos: {
    nome: "meus_pedidos",
    descricao:
      "Os pedidos de especialista que o jovem (ou a dupla dele) fez: com quem, sobre o quê e em que pé tá cada um. Use pra 'meu pedido de especialista', 'e aquele especialista?', 'pedi ajuda com X, e aí?'.",
    schema: semArgs,
    roles: ["mentorado"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const lista = await getJovemPedidosIa(ctx.supabase);
      if (!lista.length) return null;
      return {
        pedidos: lista.map((p) => ({
          // id pra confirmar_sugestao_especialista (MCP) endereçar o pedido
          id: p.id,
          especialista:
            p.especialista_nome_social ??
            p.especialista_nome ??
            // pedido 'sugerida' sem aceite ainda: mostra quem foi sugerido
            p.especialista_desejado_nome ??
            null,
          sobre: p.demanda ?? p.motivo,
          status: p.status_efetivo ?? p.status,
          criado_em: p.created_at,
        })),
      };
    },
  },

  ajuda_faq: {
    nome: "ajuda_faq",
    descricao:
      "Respostas do FAQ oficial em voz de jovem: como o programa funciona, quem faz o quê, prazos e regras. Use pra dúvidas SOBRE O PROGRAMA ('quem marca o encontro?', 'posso trocar de mentor?', 'o que é o PDM?') — não é a tool de dados pessoais (esses saem das outras tools).",
    schema: z
      .object({
        topico: z
          .string()
          .min(2)
          .max(120)
          .describe("tema ou palavras-chave da dúvida"),
      })
      .strict(),
    roles: ["mentorado"],
    run: async ({ topico }: { topico: string }) => {
      const termos = normaliza(topico).split(" ").filter((t) => t.length > 2);
      const doJovem = PERGUNTAS.filter((p) => p.papeis.includes("mentorado"));
      const ranqueadas = doJovem
        .map((p) => {
          const texto = normaliza(`${p.pergunta} ${p.resposta}`);
          const score = termos.filter((t) => texto.includes(t)).length;
          return { p, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      if (!ranqueadas.length) return { respostas: [], total_faq: doJovem.length };
      return {
        respostas: ranqueadas.map(({ p }) => ({
          pergunta: p.pergunta,
          resposta: p.resposta,
          links: (p.links ?? [])
            .filter((l) => !l.papeis || l.papeis.includes("mentorado"))
            .map((l) => ({ rotulo: l.rotulo, href: l.href })),
        })),
      };
    },
  },

  // ---------- leitura complementar das tools de escrita ----------

  mural_especialista: {
    nome: "mural_especialista",
    descricao:
      "Mural de pedidos de especialista no escopo do papel (a view solicitacoes_mural escopa sozinha: coord tudo, especialista os abertos + os dele, mentor DPP os das duplas dele). O id de cada pedido é bastidor pras tools de escrita de especialista — nunca no texto. Use pra 'quais pedidos chegaram?', 'o que tá esperando especialista'.",
    schema: semArgs,
    roles: ["coordenacao", "supervisor", "mentor_especialista", "mentor_dpp"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const { data, error } = await ctx.supabase
        .from("solicitacoes_mural")
        .select(
          "id, status, status_efetivo, demanda, motivo, slot_proposto, origem, turma, mentorado_nome, mentorado_nome_social, especialista_nome, especialista_nome_social, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return {
        pedidos: (data ?? []).map((p) => ({
          ...p,
          mentorado: p.mentorado_nome_social ?? p.mentorado_nome,
          especialista: p.especialista_nome_social ?? p.especialista_nome,
          mentorado_nome: undefined,
          mentorado_nome_social: undefined,
          especialista_nome: undefined,
          especialista_nome_social: undefined,
        })),
      };
    },
  },

  encontros_retroativo: {
    nome: "encontros_retroativo",
    descricao:
      "Os passos do guia que o jovem pode declarar como já realizados por conta própria (encontro combinado fora da plataforma): os passos oficiais já vencidos que ainda não estão na agenda, e os retroativos que ele mesmo criou e ainda pode corrigir (mesma tool de registro) ou desfazer (jovem_desfazer_retroativo) enquanto o mentor não registra. Use antes de jovem_registrar_retroativo e pra 'nos encontramos sem agendar', 'a gente se encontrou e esqueceu de marcar'.",
    schema: semArgs,
    roles: ["mentorado"],
    run: async (_args: z.infer<typeof semArgs>, ctx) =>
      getJovemRetroativoIa(ctx.supabase),
  },

  // ---------- escrita (2 passos com confirmação) ----------
  //
  // `escreve: true` muda o contrato no executarTool: a 1ª chamada NÃO roda
  // `run` — grava a prévia em ia_confirmacoes (0163) e devolve
  // {pendente_confirmacao: {confirmacao_id, resumo, args}}; a 2ª repete os
  // mesmos argumentos + `confirmacao_id`, a RPC consome atomicamente (uso
  // único, dono, mesma tool e mesmo hash de args) e aí o `run` executa.
  // A RLS/RPC definer segura o domínio; este envelope é a prova de
  // intenção humana. No MCP o client lê o envelope direto; no chat a rota
  // intercepta, emite o card e sanitiza o resultado (o confirmacao_id
  // nunca chega ao modelo — auto-aprovação vedada).

  abrir_chamado: {
    nome: "abrir_chamado",
    descricao:
      "Abre um chamado de apoio pra equipe (a própria pessoa é a autora)." +
      ESCRITA_DOC,
    schema: z
      .object({
        categoria: z
          .enum(["agenda", "metodologia", "plataforma", "urgencia", "outro"])
          .describe("categoria do pedido"),
        assunto: z.string().min(2).max(200).describe("assunto em uma linha"),
        mensagem: z
          .string()
          .min(1)
          .max(4000)
          .describe("primeira mensagem ao apoio"),
        descricao_outro: z
          .string()
          .max(280)
          .optional()
          .describe("obrigatória quando categoria=outro"),
        dupla_id: z
          .uuid()
          .optional()
          .describe("dupla ligada ao pedido, se houver"),
      })
      .strict(),
    roles: TODOS_PAPEIS,
    escreve: true,
    resumo: (a: { categoria: string; assunto: string }) =>
      `Abrir chamado "${a.assunto}" (categoria ${a.categoria})`,
    run: async (
      a: {
        categoria: string;
        assunto: string;
        mensagem: string;
        descricao_outro?: string;
        dupla_id?: string;
      },
      ctx
    ) =>
      rpcEscreve(ctx, "abrir_chamado", {
        p_categoria: a.categoria,
        p_assunto: a.assunto,
        p_mensagem: a.mensagem,
        p_descricao_outro: a.descricao_outro ?? null,
        p_dupla_id: a.dupla_id ?? null,
      }),
  },

  comentar_chamado: {
    nome: "comentar_chamado",
    descricao:
      "Escreve no chamado como a pessoa logada (autor vira mensagem pública; equipe vira nota ou resposta conforme o tipo de autor)." +
      ESCRITA_DOC,
    schema: z
      .object({
        chamado_id: z.uuid().describe("id do chamado (uuid — chamados_resumo lista)"),
        texto: z.string().min(1).max(4000),
      })
      .strict(),
    roles: TODOS_PAPEIS,
    escreve: true,
    resumo: async (a: { chamado_id: string }, supabase) =>
      `Comentar no ${await rotuloChamado(supabase, a.chamado_id)}`,
    run: async (a: { chamado_id: string; texto: string }, ctx) =>
      rpcEscreve(ctx, "comentar_chamado", {
        p_id: a.chamado_id,
        p_texto: a.texto,
      }),
  },

  acrescentar_info_chamado: {
    nome: "acrescentar_info_chamado",
    descricao:
      "Acrescenta informação ao próprio chamado aberto (só o autor; os demais não podem)." +
      ESCRITA_DOC,
    schema: z
      .object({
        chamado_id: z.uuid(),
        texto: z.string().min(1).max(4000),
      })
      .strict(),
    roles: TODOS_PAPEIS,
    escreve: true,
    resumo: async (a: { chamado_id: string }, supabase) =>
      `Acrescentar informação ao ${await rotuloChamado(supabase, a.chamado_id)}`,
    run: async (a: { chamado_id: string; texto: string }, ctx) =>
      rpcEscreve(ctx, "acrescentar_info_chamado", {
        p_id: a.chamado_id,
        p_texto: a.texto,
      }),
  },

  pedir_reabertura_chamado: {
    nome: "pedir_reabertura_chamado",
    descricao:
      "Pede a reabertura de um chamado resolvido do qual a pessoa é autora." +
      ESCRITA_DOC,
    schema: z.object({ chamado_id: z.uuid() }).strict(),
    roles: TODOS_PAPEIS,
    escreve: true,
    resumo: async (a: { chamado_id: string }, supabase) =>
      `Pedir reabertura do ${await rotuloChamado(supabase, a.chamado_id)}`,
    run: async (a: { chamado_id: string }, ctx) =>
      rpcEscreve(ctx, "pedir_reabertura_chamado", { p_id: a.chamado_id }),
  },

  assumir_chamado: {
    nome: "assumir_chamado",
    descricao:
      "Assume um chamado da fila como dono (equipe)." + ESCRITA_DOC,
    schema: z.object({ chamado_id: z.uuid() }).strict(),
    roles: ["coordenacao", "supervisor"],
    escreve: true,
    resumo: async (a: { chamado_id: string }, supabase) =>
      `Assumir o ${await rotuloChamado(supabase, a.chamado_id)}`,
    run: async (a: { chamado_id: string }, ctx) =>
      rpcEscreve(ctx, "assumir_chamado", { p_id: a.chamado_id }),
  },

  atribuir_chamado: {
    nome: "atribuir_chamado",
    descricao:
      "Atribui um chamado a outra pessoa da equipe (para = profile_id, pessoas_busca lista)." +
      ESCRITA_DOC,
    schema: z
      .object({
        chamado_id: z.uuid(),
        para: z.uuid().describe("profile_id do novo dono"),
      })
      .strict(),
    roles: ["coordenacao", "supervisor"],
    escreve: true,
    resumo: async (
      a: { chamado_id: string; para: string },
      supabase
    ) => {
      const [chamado, nome] = await Promise.all([
        rotuloChamado(supabase, a.chamado_id),
        getPessoaNomeIa(supabase, a.para)
          .then(nomeExibicao)
          .catch(() => null),
      ]);
      return `Atribuir o ${chamado} para ${nome ?? "a pessoa escolhida"}`;
    },
    run: async (a: { chamado_id: string; para: string }, ctx) =>
      rpcEscreve(ctx, "atribuir_chamado", {
        p_id: a.chamado_id,
        p_para: a.para,
      }),
  },

  devolver_chamado_fila: {
    nome: "devolver_chamado_fila",
    descricao: "Devolve o chamado à fila sem dono (equipe)." + ESCRITA_DOC,
    schema: z.object({ chamado_id: z.uuid() }).strict(),
    roles: ["coordenacao", "supervisor"],
    escreve: true,
    resumo: async (a: { chamado_id: string }, supabase) =>
      `Devolver o ${await rotuloChamado(supabase, a.chamado_id)} à fila`,
    run: async (a: { chamado_id: string }, ctx) =>
      rpcEscreve(ctx, "devolver_chamado_fila", { p_id: a.chamado_id }),
  },

  resolver_chamado: {
    nome: "resolver_chamado",
    descricao:
      "Marca o chamado como resolvido com o resumo da solução (equipe)." +
      ESCRITA_DOC,
    schema: z
      .object({
        chamado_id: z.uuid(),
        resumo: z.string().min(1).max(2000),
      })
      .strict(),
    roles: ["coordenacao", "supervisor"],
    escreve: true,
    resumo: async (a: { chamado_id: string }, supabase) =>
      `Resolver o ${await rotuloChamado(supabase, a.chamado_id)}`,
    run: async (a: { chamado_id: string; resumo: string }, ctx) =>
      rpcEscreve(ctx, "resolver_chamado", {
        p_id: a.chamado_id,
        p_resumo: a.resumo,
      }),
  },

  reabrir_chamado: {
    nome: "reabrir_chamado",
    descricao: "Reabre um chamado resolvido (equipe)." + ESCRITA_DOC,
    schema: z.object({ chamado_id: z.uuid() }).strict(),
    roles: ["coordenacao", "supervisor"],
    escreve: true,
    resumo: async (a: { chamado_id: string }, supabase) =>
      `Reabrir o ${await rotuloChamado(supabase, a.chamado_id)}`,
    run: async (a: { chamado_id: string }, ctx) =>
      rpcEscreve(ctx, "reabrir_chamado", { p_id: a.chamado_id }),
  },

  publicar_atualizacao_chamado: {
    nome: "publicar_atualizacao_chamado",
    descricao:
      "Publica uma atualização visível pro autor no chamado em atendimento (equipe)." +
      ESCRITA_DOC,
    schema: z
      .object({
        chamado_id: z.uuid(),
        texto: z.string().min(1).max(4000),
      })
      .strict(),
    roles: ["coordenacao", "supervisor"],
    escreve: true,
    resumo: async (a: { chamado_id: string }, supabase) =>
      `Publicar atualização no ${await rotuloChamado(supabase, a.chamado_id)}`,
    run: async (a: { chamado_id: string; texto: string }, ctx) =>
      rpcEscreve(ctx, "publicar_atualizacao_chamado", {
        p_id: a.chamado_id,
        p_texto: a.texto,
      }),
  },

  jovem_marcar_combinado: {
    nome: "jovem_marcar_combinado",
    descricao:
      "Marca um combinado do jovem como feito ou desfaz a marca (meus_combinados lista o id)." +
      ESCRITA_DOC,
    schema: z
      .object({
        combinado_id: z.uuid(),
        feito: z.boolean(),
      })
      .strict(),
    roles: ["mentorado"],
    escreve: true,
    resumo: async (
      a: { combinado_id: string; feito: boolean },
      supabase
    ) => {
      const c = await getCombinadoJovemIa(supabase, a.combinado_id).catch(
        () => null
      );
      return `${a.feito ? "Marcar feito" : "Desmarcar"} o combinado${c?.texto ? ` "${c.texto.slice(0, 60)}"` : ""}`;
    },
    run: async (a: { combinado_id: string; feito: boolean }, ctx) =>
      rpcEscreve(ctx, "marcar_combinado", {
        p_id: a.combinado_id,
        p_feito: a.feito,
      }),
  },

  jovem_agendar_encontro: {
    nome: "jovem_agendar_encontro",
    descricao:
      "Agenda um encontro da dupla DPP do jovem (número do encontro + data/hora; link e motivo opcionais)." +
      ESCRITA_DOC,
    schema: z
      .object({
        dupla_id: z.uuid().describe("id da dupla DPP (minha_dupla lista)"),
        numero: z.number().int().min(1).max(16).describe("número do encontro"),
        data_hora: z
          .string()
          .describe("data/hora ISO 8601 com fuso, ex. 2026-11-10T19:00:00-03:00"),
        link: z.string().max(500).optional().describe("link da chamada"),
        motivo: z
          .string()
          .max(280)
          .optional()
          .describe("motivo quando é remarcação"),
      })
      .strict(),
    roles: ["mentorado"],
    escreve: true,
    resumo: async (
      a: { dupla_id: string; numero: number; data_hora: string; motivo_tardio?: string },
      supabase
    ) => {
      const dupla = await rotuloDupla(supabase, a.dupla_id);
      return `Agendar o ${a.numero}º encontro${dupla ? ` de ${dupla}` : ""} em ${formatDiaHora(a.data_hora)}`;
    },
    run: async (
      a: {
        dupla_id: string;
        numero: number;
        data_hora: string;
        link?: string;
        motivo?: string;
      },
      ctx
    ) =>
      rpcEscreve(ctx, "agendar_encontro_mentorado", {
        p_dupla: a.dupla_id,
        p_numero: a.numero,
        p_data_hora: a.data_hora,
        p_link: a.link ?? null,
        p_motivo: a.motivo ?? null,
      }),
  },

  desmarcar_encontro: {
    nome: "desmarcar_encontro",
    descricao:
      "Desmarca um encontro agendado futuro (bilateral: mentor da dupla, jovem ou coordenação; encontro passado não se apaga — marque como não realizado). A minha_agenda/agenda_do_periodo lista o id." +
      ESCRITA_DOC,
    schema: z.object({ encontro_id: z.uuid() }).strict(),
    roles: ["mentor_dpp", "mentorado", "coordenacao"],
    escreve: true,
    resumo: async (a: { encontro_id: string }, supabase) =>
      `Desmarcar o ${await rotuloEncontro(supabase, a.encontro_id)}`,
    run: async (a: { encontro_id: string }, ctx) =>
      rpcEscreve(ctx, "desmarcar_encontro", { p_encontro: a.encontro_id }),
  },

  jovem_marcar_aconteceu: {
    nome: "jovem_marcar_aconteceu",
    descricao:
      "Confirma que o encontro da dupla do jovem aconteceu (minha_agenda lista o id)." +
      ESCRITA_DOC,
    schema: z.object({ encontro_id: z.uuid() }).strict(),
    roles: ["mentorado"],
    escreve: true,
    resumo: async (a: { encontro_id: string }, supabase) =>
      `Confirmar que o ${await rotuloEncontro(supabase, a.encontro_id)} aconteceu`,
    run: async (a: { encontro_id: string }, ctx) =>
      rpcEscreve(ctx, "marcar_aconteceu_mentorado", {
        p_encontro: a.encontro_id,
      }),
  },

  jovem_marcar_nao_aconteceu: {
    nome: "jovem_marcar_nao_aconteceu",
    descricao:
      "Marca que o encontro passado não aconteceu (minha_agenda lista o id)." +
      ESCRITA_DOC,
    schema: z.object({ encontro_id: z.uuid() }).strict(),
    roles: ["mentorado"],
    escreve: true,
    resumo: async (a: { encontro_id: string }, supabase) =>
      `Marcar o ${await rotuloEncontro(supabase, a.encontro_id)} como não realizado`,
    run: async (a: { encontro_id: string }, ctx) =>
      rpcEscreve(ctx, "marcar_nao_aconteceu_mentorado", {
        p_encontro: a.encontro_id,
      }),
  },

  jovem_registrar_retroativo: {
    nome: "jovem_registrar_retroativo",
    descricao:
      "Declara que um encontro do guia já aconteceu sem agendamento prévio — a dupla se combinou por fora (retroativo). O passo fica realizado na hora, libera a avaliação do jovem e avisa o mentor pra contar como foi no registro dele. Também corrige a data de um retroativo que a própria pessoa criou (mesmo número, nova data). encontros_retroativo lista os passos elegíveis: só data oficial já vencida, nunca o último do ciclo (fechar a jornada segue registro do mentor) e nunca a trilha de especialista (as sessões dela são do especialista). Se encontros_retroativo marcar exige_motivo, pergunte o motivo antes de confirmar e envie motivo_tardio." +
      ESCRITA_DOC,
    schema: z
      .object({
        dupla_id: z
          .uuid()
          .describe("id da dupla DPP (encontros_retroativo devolve)"),
        numero: z
          .number()
          .int()
          .min(1)
          .max(16)
          .describe("número do encontro do guia"),
        data_hora: z
          .string()
          .describe(
            "data/hora ISO 8601 com fuso de quando aconteceu, ex. 2026-11-10T19:00:00-03:00"
          ),
        motivo_tardio: z
          .string()
          .min(2)
          .max(1000)
          .optional()
          .describe(
            "obrigatório quando o passo venceu há mais de 7 dias; pergunte antes de confirmar"
          ),
      })
      .strict(),
    roles: ["mentorado"],
    escreve: true,
    resumo: async (
      a: { dupla_id: string; numero: number; data_hora: string; motivo_tardio?: string },
      supabase
    ) => {
      const dupla = await rotuloDupla(supabase, a.dupla_id);
      return `Registrar o ${a.numero}º encontro${dupla ? ` de ${dupla}` : ""} como realizado em ${formatDiaHora(a.data_hora)}`;
    },
    run: async (
      a: { dupla_id: string; numero: number; data_hora: string; motivo_tardio?: string },
      ctx
    ) =>
      rpcEscreve(ctx, "registrar_retroativo_mentorado", {
        p_dupla: a.dupla_id,
        p_numero: a.numero,
        p_data_hora: a.data_hora,
        ...(a.motivo_tardio?.trim()
          ? { p_motivo_tardio: a.motivo_tardio.trim() }
          : {}),
      }),
  },

  jovem_desfazer_retroativo: {
    nome: "jovem_desfazer_retroativo",
    descricao:
      "Desfaz um retroativo que a própria pessoa criou (encontros_retroativo lista o encontro_id). Só vale enquanto o mentor não registrou o encontro — depois disso a correção é com ele." +
      ESCRITA_DOC,
    schema: z.object({ encontro_id: z.uuid() }).strict(),
    roles: ["mentorado"],
    escreve: true,
    resumo: async (a: { encontro_id: string }, supabase) =>
      `Desfazer o retroativo do ${await rotuloEncontro(supabase, a.encontro_id)}`,
    run: async (a: { encontro_id: string }, ctx) =>
      rpcEscreve(ctx, "desfazer_retroativo_mentorado", {
        p_encontro: a.encontro_id,
      }),
  },

  declarar_recesso: {
    nome: "declarar_recesso",
    descricao:
      "Declara a decisão da dupla sobre um recesso do calendário oficial: usa=true é 'vamos pausar os encontros' (também é o padrão quando nada foi declarado — o planner empurra sugestões pra depois da janela) e usa=false é 'vamos seguir nos encontrando' (aí a janela fica disponível pra dupla: o planner pode sugerir datas dentro dela e a agenda trata o período como combinado). A decisão é por dupla e por período de recesso; a última declaração vale, com a data da mudança. Sem ciclo_evento_id vale o recesso vigente ou o próximo do cronograma da dupla — ficha_dupla lista os recessos com os ids. Só a dupla declara (a gravação revalida): o mentor dela ou o jovem; a coordenação acompanha, não decide pela dupla." +
      ESCRITA_DOC,
    schema: z
      .object({
        dupla_id: z.uuid().describe("id da dupla (uuid)"),
        ciclo_evento_id: z
          .uuid()
          .optional()
          .describe(
            "id do evento de recesso (uuid — ficha_dupla lista em recessos; sem ele vale o vigente ou o próximo)"
          ),
        usa: z
          .boolean()
          .describe(
            "true = vamos pausar os encontros (padrão); false = vamos seguir nos encontrando durante o recesso"
          ),
      })
      .strict(),
    // 0234: a RPC aceita só a dupla (mentor via my_profile_id, jovem via
    // my_mentorado_id) — coord na allowlist prometia o que o banco recusa
    roles: ["mentor_dpp", "mentorado"],
    escreve: true,
    resumo: async (a: { dupla_id: string; usa: boolean }, supabase) => {
      const dupla = await rotuloDupla(supabase, a.dupla_id);
      return `${a.usa ? "Usar" : "Atravessar"} o recesso na dupla${dupla ? ` de ${dupla}` : ""}`;
    },
    run: async (
      a: { dupla_id: string; ciclo_evento_id?: string; usa: boolean },
      ctx
    ) => {
      let evento = a.ciclo_evento_id ?? null;
      if (!evento) {
        const [cx, evs] = await Promise.all([
          // 527: jovem declara também — dupla e calendário saem pela
          // leitura de serviço do contextoPlano, não pela RLS do papel
          contextoPlanoCom(ctx.supabase, a.dupla_id, []),
          getCicloEventosPlano(),
        ]);
        if ("error" in cx) throw new ErroTool(cx.error);
        const d = cx.dupla;
        const hoje = toDateStr(new Date());
        const cand = evs
          .filter(
            (e) =>
              e.tipo === "recesso" &&
              e.cronograma_id === d.cronograma_id &&
              e.data != null &&
              (e.data_fim ?? e.data) >= hoje
          )
          .sort((x, y) => x.data!.localeCompare(y.data!))[0];
        if (!cand)
          throw new ErroTool(
            "Não encontrei recesso vigente ou futuro no cronograma desta dupla."
          );
        evento = cand.id;
      }
      return rpcEscreve(ctx, "declarar_recesso", {
        p_dupla: a.dupla_id,
        p_evento: evento,
        p_usa: a.usa,
      });
    },
  },

  disponibilidade_semana: {
    nome: "disponibilidade_semana",
    descricao:
      "Grava a grade semanal de disponibilidade do PRÓPRIO usuário (os dias e períodos em que ele consegue ter encontro: seg/ter/qua/qui/sex/sab/dom × manha/tarde/noite). É a grade que o plano 'ficar em dia' cruza com a do outro lado da dupla pra sugerir datas — cada lado responde a sua. Lista vazia limpa a grade (a dupla volta a combinar sem ela). O plano_em_dia diz se a grade do chamador tá faltando quando grade.dias_comuns é 0. Use quando a pessoa passar a disponibilidade em texto ('seg à noite e qua à tarde')." +
      ESCRITA_DOC,
    schema: z
      .object({
        celulas: z
          .array(
            z.object({
              dia: z.enum(["seg", "ter", "qua", "qui", "sex", "sab", "dom"]),
              periodo: z.enum(["manha", "tarde", "noite"]),
            })
          )
          .max(21)
          .describe("as células livres da semana — vazio limpa a grade"),
      })
      .strict(),
    // cada lado responde a sua — staff não edita grade de ninguém (518)
    roles: ["mentor_dpp", "mentorado"],
    escreve: true,
    resumo: (a: { celulas?: { dia: string; periodo: string }[] }) =>
      a.celulas?.length
        ? `Salvar sua grade semanal (${a.celulas.length} ${a.celulas.length === 1 ? "período livre" : "períodos livres"})`
        : "Limpar sua grade semanal",
    run: async (a: { celulas: { dia: string; periodo: string }[] }, ctx) => {
      // round-trip pelo parser do domínio — a RPC/coluna revalida no banco
      const grade: Disponibilidade | null = a.celulas.length
        ? { celulas: a.celulas as Disponibilidade["celulas"] }
        : null;
      const parsed = parseDisponibilidade(JSON.stringify(grade));
      if (parsed && "error" in parsed) throw new ErroTool(parsed.error);
      // os mesmos caminhos do salvarDisponibilidadePlano (518): jovem pela
      // RPC do papel, mentor pelo self-update do cadastro
      if (ctx.papeis.includes("mentorado") && !ctx.papeis.includes("mentor_dpp")) {
        return rpcEscreve(ctx, "set_disponibilidade_mentorado", {
          p_grade: parsed,
        });
      }
      const { data: pid } = await ctx.supabase.rpc("my_profile_id");
      const { error } = await ctx.supabase
        .from("mentor_profiles")
        .update({ disponibilidade: parsed })
        .eq("profile_id", pid);
      if (error) throw new ErroTool("Não consegui salvar sua grade agora.");
      return { salvo: true, celulas: a.celulas.length };
    },
  },

  jovem_pedir_especialista: {
    nome: "jovem_pedir_especialista",
    descricao:
      "Pede um mentor especialista (demanda/motivo em texto livre; especialista_id e slot só quando a pessoa já sabe quem e quando)." +
      ESCRITA_DOC,
    schema: z
      .object({
        especialista_id: z
          .uuid()
          .optional()
          .describe("profile_id do especialista desejado, se escolhido"),
        demanda: z
          .string()
          .max(2000)
          .optional()
          .describe("o que a pessoa quer trabalhar"),
        motivo: z.string().max(2000).optional(),
        slot: z
          .string()
          .optional()
          .describe("horário preferido ISO 8601 com fuso"),
      })
      .strict(),
    roles: ["mentorado"],
    escreve: true,
    resumo: () => `Pedir um mentor especialista`,
    run: async (
      a: {
        especialista_id?: string;
        demanda?: string;
        motivo?: string;
        slot?: string;
      },
      ctx
    ) =>
      rpcEscreve(ctx, "pedir_especialista_jovem", {
        p_especialista_id: a.especialista_id ?? null,
        p_demanda: a.demanda ?? null,
        p_motivo: a.motivo ?? null,
        p_slot: a.slot ?? null,
      }),
  },

  confirmar_sugestao_especialista: {
    nome: "confirmar_sugestao_especialista",
    descricao:
      "Aceita a sugestão de especialista que a equipe fez pro jovem (meus_pedidos lista o id do pedido sugerido)." +
      ESCRITA_DOC,
    schema: z
      .object({
        solicitacao_id: z.uuid(),
        demanda: z.string().max(2000).optional(),
        objetivo: z.string().max(2000).optional(),
        especialista_id: z.uuid().optional(),
      })
      .strict(),
    roles: ["mentorado"],
    escreve: true,
    resumo: () => `Aceitar a sugestão de especialista`,
    run: async (
      a: {
        solicitacao_id: string;
        demanda?: string;
        objetivo?: string;
        especialista_id?: string;
      },
      ctx
    ) =>
      rpcEscreve(ctx, "confirmar_sugestao_especialista", {
        p_id: a.solicitacao_id,
        p_demanda: a.demanda ?? null,
        p_objetivo: a.objetivo ?? null,
        p_especialista_id: a.especialista_id ?? null,
      }),
  },

  aceitar_solicitacao: {
    nome: "aceitar_solicitacao",
    descricao:
      "Aceita um pedido de mentor especialista do mural (mural_especialista lista o id; slot opcional marca a primeira sessão)." +
      ESCRITA_DOC,
    schema: z
      .object({
        solicitacao_id: z.uuid(),
        slot: z
          .string()
          .optional()
          .describe("data/hora da primeira sessão ISO 8601 com fuso"),
      })
      .strict(),
    roles: ["mentor_especialista"],
    escreve: true,
    resumo: async (a: { solicitacao_id: string }, supabase) => {
      const nome = await rotuloSolicitacao(supabase, a.solicitacao_id);
      return `Aceitar o pedido de especialista${nome ? ` de ${nome}` : ""}`;
    },
    run: async (a: { solicitacao_id: string; slot?: string }, ctx) =>
      rpcEscreve(ctx, "aceitar_solicitacao", {
        p_id: a.solicitacao_id,
        p_slot: a.slot ?? null,
      }),
  },

  contra_propor_solicitacao: {
    nome: "contra_propor_solicitacao",
    descricao:
      "Contra-propõe outro horário pra um pedido de especialista (mural_especialista lista o id)." +
      ESCRITA_DOC,
    schema: z
      .object({
        solicitacao_id: z.uuid(),
        slot: z
          .string()
          .describe("horário proposto ISO 8601 com fuso"),
        mensagem: z.string().max(2000).optional(),
      })
      .strict(),
    roles: ["mentor_especialista"],
    escreve: true,
    resumo: async (
      a: { solicitacao_id: string; slot: string },
      supabase
    ) => {
      const nome = await rotuloSolicitacao(supabase, a.solicitacao_id);
      return `Contra-propor o horário ${formatDiaHora(a.slot)}${nome ? ` pro pedido de ${nome}` : ""}`;
    },
    run: async (
      a: { solicitacao_id: string; slot: string; mensagem?: string },
      ctx
    ) =>
      rpcEscreve(ctx, "contra_propor_solicitacao", {
        p_id: a.solicitacao_id,
        p_slot: a.slot,
        p_mensagem: a.mensagem ?? null,
      }),
  },

  recusar_solicitacao: {
    nome: "recusar_solicitacao",
    descricao:
      "Recusa um pedido de especialista com justificativa (mural_especialista lista o id)." +
      ESCRITA_DOC,
    schema: z
      .object({
        solicitacao_id: z.uuid(),
        justificativa: z.string().min(1).max(2000),
      })
      .strict(),
    roles: ["mentor_especialista"],
    escreve: true,
    resumo: async (a: { solicitacao_id: string }, supabase) => {
      const nome = await rotuloSolicitacao(supabase, a.solicitacao_id);
      return `Recusar o pedido de especialista${nome ? ` de ${nome}` : ""}`;
    },
    run: async (
      a: { solicitacao_id: string; justificativa: string },
      ctx
    ) =>
      rpcEscreve(ctx, "recusar_solicitacao", {
        p_id: a.solicitacao_id,
        p_justificativa: a.justificativa,
      }),
  },

  // ---------- escrita do domínio (REALIZA-126) ----------
  //
  // As 5 abaixo são as únicas anunciadas no payload do chat (ESCRITAS_
  // DOMINIO + provider) e delegam aos MESMOS cores/RPC das actions —
  // regra nenhuma é reimplementada aqui. O envelope pendente_confirmacao
  // é o contrato dos dois canais: no chat o card do cliente é a via de
  // approve (POST /api/ia/confirmacao, sem LLM); no MCP o client pede o
  // "sim" pelo UX próprio e re-chama com confirmacao_id.

  registrar_interacao: {
    nome: "registrar_interacao",
    descricao:
      "Registra um contato com a dupla na timeline (interacoes): tipo 'contato' pra interação em geral (respondeu, remarcou por fora), 'apoio' pra atendimento de um pedido de apoio. 'nudge' não entra — nudge é artefato do fluxo Lembrar. Escopo: equipe em qualquer dupla, mentor e supervisor só na deles." +
      ESCRITA_DOC,
    schema: z
      .object({
        dupla_id: z.uuid().describe("id da dupla (uuid — duplas_do_usuario/ficha_dupla devolvem)"),
        tipo: z.enum(["contato", "apoio"]).describe("contato em geral ou atendimento de apoio"),
        nota: z
          .string()
          .max(300)
          .optional()
          .describe("resumo do contato em uma linha (opcional)"),
      })
      .strict(),
    roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"],
    escreve: true,
    resumo: async (
      a: { dupla_id: string; tipo: string; nota?: string },
      supabase
    ) => {
      const dupla = await rotuloDupla(supabase, a.dupla_id);
      return `Registrar ${a.tipo} na dupla${dupla ? ` de ${dupla}` : ""}${a.nota ? `: ${a.nota}` : ""}`;
    },
    run: async (a: { dupla_id: string; tipo: "contato" | "apoio"; nota?: string }, ctx) =>
      rodarCore(registrarInteracaoCore(ctx.supabase, await atorDoCanal(ctx), a)),
  },

  marcar_situacao_mentorado: {
    nome: "marcar_situacao_mentorado",
    descricao:
      "Marca a situação do mentorado no programa: 'desistente' ou 'concluido' gravam a saída (desistente exige motivo; uma dupla ativa/pausada bloqueia — encerre a dupla antes); 'ativo' reativa. pessoas_busca lista o mentorado_id." +
      ESCRITA_DOC,
    schema: z
      .object({
        mentorado_id: z.uuid().describe("id do mentorado (uuid)"),
        situacao: z.enum(["ativo", "desistente", "concluido"]),
        motivo: z
          .string()
          .max(300)
          .optional()
          .describe("obrigatório quando situacao=desistente"),
      })
      .strict(),
    roles: ["coordenacao"],
    escreve: true,
    resumo: async (
      a: { situacao: string; mentorado_id: string },
      supabase
    ) => {
      const nome = await getPessoaNomeIa(supabase, a.mentorado_id)
        .then(nomeExibicao)
        .catch(() => null);
      return `Marcar situação "${a.situacao}"${nome ? ` de ${nome}` : " do mentorado"}`;
    },
    run: async (
      a: { mentorado_id: string; situacao: "ativo" | "desistente" | "concluido"; motivo?: string },
      ctx
    ) =>
      rodarCore(
        marcarSaidaMentoradoCore(ctx.supabase, await atorDoCanal(ctx), {
          id: a.mentorado_id,
          situacao: a.situacao,
          motivo: a.motivo ?? null,
        })
      ),
  },

  emitir_link_instrumento: {
    nome: "emitir_link_instrumento",
    descricao:
      "Emite o link do instrumento pro jovem da dupla responder (visão de futuro, roda da vida, PDM, metas). Devolve a URL /f/<token> pra enviar a ele — link pendente vigente é reusado, não duplicado. Escopo: equipe em qualquer dupla; mentor DPP só na dupla viva dele." +
      ESCRITA_DOC,
    schema: z
      .object({
        dupla_id: z.uuid().describe("id da dupla (uuid)"),
        sistema: z
          .enum(["visao", "roda_vida", "pdm", "metas"])
          .describe("qual instrumento emitir"),
      })
      .strict(),
    roles: ["coordenacao", "mentor_dpp"],
    escreve: true,
    resumo: async (a: { dupla_id: string; sistema: string }, supabase) => {
      const dupla = await rotuloDupla(supabase, a.dupla_id);
      return `Emitir o link do instrumento ${a.sistema}${dupla ? ` pra dupla de ${dupla}` : " pra dupla"}`;
    },
    run: async (a: { dupla_id: string; sistema: string }, ctx) => {
      const d = (await rpcEscreve(ctx, "emitir_link_instrumento", {
        p_dupla_id: a.dupla_id,
        p_sistema: a.sistema,
      })) as { token?: string; reutilizado?: boolean } | null;
      // telemetria (417): a emissão via Liza é form_emitido na superfície
      // "ia" — a origem do gesto é o canal, não a tela (chat grava com o
      // JWT da sessão; no MCP o JWT impersonado carimba o dono da PAT).
      // Sem token não houve link — só conta emissão real
      if (d?.token) {
        await emitirProdutoEvento(ctx.supabase, {
          superficie: "ia",
          acao: "form_emitido",
          meta: {
            dupla_id: a.dupla_id,
            sistema: a.sistema,
            reutilizado: d?.reutilizado === true,
          },
        });
      }
      // o card de documento precisa de quem recebe e da ponte (527): a
      // ficha já traz nomes e whatsapps no escopo do papel — jovem sem
      // WhatsApp cai no repasse pro mentor, os dois sem número = só copiar
      const ficha = d?.token
        ? await getDuplaIa(ctx.supabase, a.dupla_id).catch(() => null)
        : null;
      return {
        url: d?.token ? `/f/${d.token}` : null,
        token: d?.token ?? null,
        sistema: a.sistema,
        reutilizado: d?.reutilizado === true,
        // quem assina o convite (msgLinkWhatsApp): do número do mentor a
        // voz "a equipe" lê errado — ele assina como pessoa
        remetente: ctx.papel === "mentor_dpp" ? "mentor" : "equipe",
        jovem: ficha?.mentorado
          ? {
              nome: ficha.mentorado.nome_social ?? ficha.mentorado.nome,
              whatsapp: ficha.mentorado.whatsapp ?? null,
            }
          : null,
        mentor: ficha?.mentor
          ? {
              nome: ficha.mentor.nome_social ?? ficha.mentor.nome,
              whatsapp: ficha.mentor.whatsapp ?? null,
            }
          : null,
      };
    },
  },

  agendar_encontro: {
    nome: "agendar_encontro",
    descricao:
      "Agenda (ou remarca) um encontro da própria dupla do mentor — data futura, número dentro do cronograma. Remarcar exige o motivo; encontro já realizado não mexe. A coordenação NÃO agenda (quem agenda é a dupla) e a trilha especialista não cria sessão fora do pedido aceito — esses casos voltam como recusa na confirmação." +
      ESCRITA_DOC,
    schema: z
      .object({
        dupla_id: z.uuid().describe("id da própria dupla (uuid — duplas_do_usuario devolve)"),
        numero: z.number().int().min(1).max(24).describe("número do encontro na jornada"),
        data_hora: z.string().describe("data/hora ISO 8601 com fuso (ex.: 2026-12-01T19:00:00-03:00)"),
        link: z
          .string()
          .max(500)
          .optional()
          .describe("link https da chamada (opcional)"),
        motivo: z
          .string()
          .max(140)
          .optional()
          .describe("obrigatório quando é remarcação — por que a data mudou"),
      })
      .strict(),
    // coord stays in the allowlist on purpose: the domain guard in
    // agendarEncontroCore must answer "Quem agenda é a dupla" instead of
    // the generic role denial — the refusal is the teaching moment
    roles: ["mentor_dpp", "mentor_especialista", "coordenacao"],
    escreve: true,
    resumo: async (
      a: { dupla_id: string; numero: number; data_hora: string; motivo_tardio?: string },
      supabase
    ) => {
      const dupla = await rotuloDupla(supabase, a.dupla_id);
      return `Agendar o ${a.numero}º encontro${dupla ? ` de ${dupla}` : " da dupla"} em ${formatDiaHora(a.data_hora)}`;
    },
    run: async (
      a: { dupla_id: string; numero: number; data_hora: string; link?: string; motivo?: string },
      ctx
    ) => {
      // o core conhece o vocabulário de presets de remarcação: um motivo
      // que casa com o value entra como preset, texto livre vira "outro"
      const preset = (a.motivo ?? "").trim();
      const ehPreset =
        preset === "ausencia_mentorado" ||
        preset === "ausencia_mentor" ||
        preset === "conflito" ||
        preset === "imprevisto";
      return rodarCore(
        agendarEncontroCore(ctx.supabase, await atorDoCanal(ctx), {
          dupla_id: a.dupla_id,
          numero: a.numero,
          data_hora: a.data_hora,
          link: a.link?.trim() || null,
          motivo: ehPreset ? preset : preset ? "outro" : undefined,
          motivo_outro: ehPreset ? undefined : preset || undefined,
        })
      );
    },
  },


  pessoas_agregado: {
    nome: "pessoas_agregado",
    descricao:
      "Agrega pessoas do programa por estado (uf), gênero, faixa de idade, papel ou trilha, com filtros simples. Coordenação vê o programa todo; supervisor vê só o recorte que a RLS dele alcança. Gênero e idade são visão da coordenação. Retorna contagens, percentuais, top N com outros e no máximo 5 linhas de exemplo sem contato nem data de nascimento.",
    schema: z
      .object({
        dimensao: z
          .enum(["estado", "genero", "faixa_idade", "papel", "trilha"])
          .describe("dimensão do agrupamento"),
        papel: z
          .enum(["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista", "mentorado"])
          .optional()
          .describe("filtra por papel efetivo"),
        uf: z.string().trim().min(2).max(2).optional().describe("sigla do estado, ex.: SP"),
        genero: z
          .enum(["feminino", "masculino", "nao_binario", "outro", "prefiro_nao_dizer"])
          .optional(),
        faixa_idade: z
          .enum(["ate_17", "18_24", "25_34", "35_mais"])
          .optional(),
        trilha: z.enum(["dpp", "especialista"]).optional(),
        incluir_inativas: z
          .boolean()
          .default(false)
          .describe("false conta só pessoas ativas; true inclui inativas, desistentes e concluídas"),
        limite: z.number().int().min(1).max(20).default(8).describe("top N de grupos; o restante vira outros"),
      })
      .strict(),
    roles: ["coordenacao", "supervisor"],
    run: async (a: {
      dimensao: "estado" | "genero" | "faixa_idade" | "papel" | "trilha";
      papel?: AppRole;
      uf?: string;
      genero?: "feminino" | "masculino" | "nao_binario" | "outro" | "prefiro_nao_dizer";
      faixa_idade?: "ate_17" | "18_24" | "25_34" | "35_mais";
      trilha?: "dpp" | "especialista";
      incluir_inativas: boolean;
      limite: number;
    }, ctx) => {
      const sensivel =
        a.dimensao === "genero" ||
        a.dimensao === "faixa_idade" ||
        a.genero != null ||
        a.faixa_idade != null;
      if (sensivel && ctx.papel !== "coordenacao") {
        throw new ErroTool(
          "Gênero e faixa de idade são visão da coordenação. Posso agregar por estado, papel ou trilha dentro do seu recorte."
        );
      }
      const pessoas = await getPessoasBiIa(ctx.supabase, a.incluir_inativas);
      const agregado = agregarPessoasBi(pessoas, a.dimensao, a, a.limite);
      // a linha de exemplo também segue a fronteira: supervisor pode ver
      // nome/papel/trilha/UF do recorte dele, mas não recebe nem o rótulo
      // "não informado" de gênero/idade — a dimensão sensível não entra
      // no payload fora da coordenação
      const linhas =
        ctx.papel === "coordenacao"
          ? agregado.linhas
          : agregado.linhas.map((l) => ({
              nome: l.nome,
              papel: l.papel,
              trilhas: l.trilhas,
              uf: l.uf,
            }));
      return {
        ...agregado,
        linhas,
        filtros_aplicados: Object.fromEntries(
          Object.entries({
            papel: a.papel,
            uf: a.uf?.toUpperCase(),
            genero: a.genero,
            faixa_idade: a.faixa_idade,
            trilha: a.trilha,
          }).filter(([, v]) => v != null)
        ),
        escopo:
          ctx.papel === "coordenacao"
            ? "programa inteiro, com a RLS da coordenação"
            : "recorte visível ao supervisor, com a RLS da sessão",
        privacidade:
          "sem contato, data de nascimento, dados civis, cor/raça ou motivação; idade sai só em faixas",
      };
    },
  },

  editar_campo_pessoa: {
    nome: "editar_campo_pessoa",
    descricao:
      "Corrige um campo de cadastro de uma pessoa (profiles ou mentorados): whatsapp ou nome_social em qualquer uma. Email, papel, dados civis e datas NÃO entram — têm fluxo próprio. pessoas_busca lista o pessoa_id." +
      ESCRITA_DOC,
    schema: z
      .object({
        pessoa_id: z.uuid().describe("id da pessoa (uuid — pessoas_busca devolve)"),
        campo: z.enum(["whatsapp", "nome_social"]),
        valor: z.string().max(10000).describe("novo valor do campo"),
      })
      .strict(),
    roles: ["coordenacao"],
    escreve: true,
    resumo: async (
      a: { pessoa_id: string; campo: string; valor: string },
      supabase
    ) => {
      const nome = await getPessoaNomeIa(supabase, a.pessoa_id)
        .then(nomeExibicao)
        .catch(() => null);
      return `Editar ${a.campo}${nome ? ` de ${nome}` : " da pessoa"} pra "${a.valor.slice(0, 80)}"`;
    },
    run: async (a: { pessoa_id: string; campo: string; valor: string }, ctx) =>
      rodarCore(
        editarCampoPessoaCore(ctx.supabase, await atorDoCanal(ctx), {
          pessoa_id: a.pessoa_id,
          campo: a.campo,
          valor: a.valor,
        })
      ),
  },
} satisfies Record<
  string,
  {
    nome: string;
    descricao: string;
    schema: z.ZodType;
    roles: readonly Papel[];
    escreve?: boolean;
    // `args: never` é o supertipo universal de qualquer run/resumo — o
    // satisfies confere a forma sem apagar o tipo preciso de cada schema
    resumo?: (
      args: never,
      supabase: SupabaseClient
    ) => string | Promise<string>;
    run: (args: never, ctx: ContextoIa) => Promise<unknown>;
  }
>;

export type IaToolNome = keyof typeof IA_TOOLS;

export const IA_TOOL_NOMES = Object.keys(IA_TOOLS) as IaToolNome[];

/** Catálogo do registry pra expor ao transporte (chat/MCP): nome +
 *  descrição + papéis — o schema zod vira JSON Schema na camada que monta o
 *  payload do provedor. */
export const IA_TOOL_CATALOGO = IA_TOOL_NOMES.map((n) => {
  const t = IA_TOOLS[n];
  return {
    nome: t.nome,
    descricao: t.descricao,
    roles: t.roles,
    schema: t.schema,
  };
});

// ---------- execução ----------

/** args JSON-seguros pro log — o que vai pra ia_eventos é o que o modelo
 *  mandou (canonicalizado pelo zod quando válido); payload não-serializável
 *  ou gigante vira marcador, nunca quebra a auditoria. */
function argsParaLog(v: unknown): Record<string, unknown> {
  try {
    const s = JSON.stringify(v ?? {});
    if (s.length > 4000) return { _truncado: true };
    const p = JSON.parse(s);
    return p && typeof p === "object" && !Array.isArray(p)
      ? (p as Record<string, unknown>)
      : { _valor: p };
  } catch {
    return { _invalido: true };
  }
}

/** Args com cara de PII (texto livre que pode citar nome/relato de menor)
 *  não entram verbatim no ledger — a convenção da 0083 é "a ação, não a
 *  fala". Vira {n, hash12}: dá pra depurar repetição/padrão sem gravar o
 *  conteúdo. Mapa por tool→campo; hash é sha256 truncado, sem sal — o
 *  objetivo é dedupe/forense, não sigilo criptográfico. */
const ARGS_MINIMIZADOS: Record<string, readonly string[]> = {
  guia_consulta: ["pergunta"],
  pessoas_busca: ["nome"],
  // texto livre das tools de escrita — o ledger guarda a ação, não a fala
  abrir_chamado: ["assunto", "mensagem", "descricao_outro"],
  comentar_chamado: ["texto"],
  acrescentar_info_chamado: ["texto"],
  resolver_chamado: ["resumo"],
  publicar_atualizacao_chamado: ["texto"],
  jovem_pedir_especialista: ["demanda", "motivo"],
  confirmar_sugestao_especialista: ["demanda", "objetivo"],
  contra_propor_solicitacao: ["mensagem"],
  recusar_solicitacao: ["justificativa"],
  jovem_agendar_encontro: ["motivo", "link"],
  // escritas do domínio (126): nota/motivo/valor podem citar pessoa — idem
  registrar_interacao: ["nota"],
  marcar_situacao_mentorado: ["motivo"],
  agendar_encontro: ["motivo", "link"],
  editar_campo_pessoa: ["valor"],
  // plano/guia/intervenção (459): motivos e textos livres, mesma régua
  plano_responder: ["motivo"],
  plano_aplicar_passo: ["motivo", "link"],
  intervencao_sugerir: ["motivo", "evidencias"],
  guia_ajustar: ["ajustes"],
};

function argsMinimizados(
  nome: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  const campos = ARGS_MINIMIZADOS[nome];
  if (!campos) return args;
  const out = { ...args };
  for (const c of campos) {
    const v = out[c];
    if (typeof v !== "string" || !v) continue;
    out[c] = {
      n: v.length,
      hash12: createHash("sha256").update(v).digest("hex").slice(0, 12),
    };
  }
  return out;
}

function resumoZod(err: z.ZodError): string {
  return err.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "args"}: ${i.message}`)
    .join("; ");
}

/** Evento de ia_eventos no formato do registrar_ia_eventos_lote (0160) —
 *  o chat junta as tools da mensagem + o resumo 'resposta' numa escrita. */
export type EventoIa = {
  canal: CanalIa;
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  erro?: string | null;
  duracao_ms?: number | null;
  request_id?: string | null;
  modelo?: string | null;
  tier?: string | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  tokens_reasoning?: number | null;
  cache_read?: number | null;
  custo_usd?: number | null;
  allowance_usd?: number | null;
  billing_source?: string | null;
  iteracoes?: number | null;
};

// ---------- dedup de resultado por sessão (chat) ----------

/** Na mesma conversa o modelo às vezes repete a mesma tool com os mesmos
 *  args (follow-up) — as tools de leitura são idempotentes e a RLS já
 *  escopa ao dono da sessão, então o resultado de segundos atrás é o que
 *  a query devolveria de novo. 90s cobre a vida útil de uma resposta sem
 *  servir dado velho demais; 200 entradas por instância. Só o chat passa
 *  dedupKey: o token MCP é multi-uso (uma sessão não existe lá) e tools
 *  `escreve`/`guia_consulta` ficam fora por contrato (escrita não é
 *  idempotente; a guia já tem a guarda "uma busca por resposta" na route
 *  e a re-chamada precisa cair nela, não no cache). */
const dedupTools = new CacheTtl<unknown>(90_000, 200);

/** Testes: começa do zero (o cache é por módulo). */
export function limparDedupTools() {
  dedupTools.limpar();
}

/** Ponto único de execução das tools — valida args (zod), barra papel fora
 *  da allowlist ANTES de rodar, mede a duração e grava ia_eventos via RPC
 *  (o `await` importa: rpc() solto é lazy e nunca chegaria no PostgREST;
 *  falha da auditoria loga no servidor mas não derruba a resposta da tool). */
export async function executarTool(
  nome: string,
  args: unknown,
  supabase: SupabaseClient,
  canal: CanalIa,
  /** papéis pré-resolvidos — o MCP autentica por PAT (não há JWT pra
   *  my_papeis), então a rota passa os papéis que a autorização devolveu.
   *  Ausente → resolve do JWT como sempre. */
  papeisForcados?: AppRole[],
  /** profile_id explícito pra auditoria — hoje nenhuma rota passa (a
   *  do MCP vai undefined): o client da execução já é o JWT impersonado
   *  do dono da PAT, então my_profile_id() resolve a pessoa na RPC
   *  igual à sessão do chat. Escape pra um futuro caller sem JWT. */
  autorProfileId?: string,
  /** request_id da reserva do limite — correla os eventos da tool com a
   *  mensagem que a disparou (sdd D4). Ausente no MCP por enquanto. */
  requestId?: string,
  /** coletarEvento: o caller guarda o evento de auditoria e grava em lote
   *  (chat → registrar_ia_eventos_lote no fim do stream). Ausente → grava
   *  na hora via registrar_ia_evento, como o MCP faz.
   *  dedupKey: id estável da conversa — repetição de tool de leitura com
   *  os mesmos args dentro do TTL devolve o resultado guardado em vez de
   *  re-rodar a query (o evento sai com args.cache:true). */
  opcoes?: { coletarEvento?: (ev: EventoIa) => void; dedupKey?: string }
): Promise<ResultadoTool> {
  const inicio = Date.now();
  let ok = false;
  let erro: string | null = null;
  let dados: unknown = null;
  // resposta servida do dedup por sessão — vira args.cache no evento
  let dedupHit = false;
  // log registra os args crus enquanto o parse não valida; depois, os
  // canônicos (defaults aplicados, campos fora do schema descartados)
  let argsLog = argsParaLog(args);

  try {
    const tool = IA_TOOLS[nome as IaToolNome] as
      | (typeof IA_TOOLS)[IaToolNome]
      | undefined;
    if (!tool) throw new ErroTool(`Tool desconhecida: ${nome}`);

    // escritas no chat passam pelo mesmo pendente_confirmacao do MCP
    // (REALIZA-126) — a diferença é só o transporte de volta. Kill-switch
    // IA_ESCRITAS=0: no chat restaura o erro de canal pra TODA escrita
    // (o canal volta read-only); no MCP só as 5 do domínio saem do ar —
    // as de chamados/jovem já eram live antes da flag existir
    if ((tool as { escreve?: boolean }).escreve) {
      const desligadas = process.env.IA_ESCRITAS === "0";
      if (canal !== "mcp" && desligadas) {
        throw new ErroTool(
          "Esta ação ainda não está disponível neste canal — pelo app ela fica na tela correspondente."
        );
      }
      if (canal === "mcp" && desligadas && ESCRITAS_DOMINIO.has(nome)) {
        throw new ErroTool("Esta ação não está disponível no momento.");
      }
    }

    // `confirmacao_id` chega fora do schema (a prévia instrui a repetição
    // com ele) — sai antes do parse e nunca entra no hash nem no log
    const confirmacaoId =
      (tool as { escreve?: boolean }).escreve &&
      args &&
      typeof args === "object" &&
      !Array.isArray(args)
        ? (args as Record<string, unknown>).confirmacao_id
        : undefined;
    const argsDominio =
      (tool as { escreve?: boolean }).escreve &&
      args &&
      typeof args === "object" &&
      !Array.isArray(args)
        ? Object.fromEntries(
            Object.entries(args as Record<string, unknown>).filter(
              ([k]) => k !== "confirmacao_id"
            )
          )
        : args;

    const parsed = tool.schema.safeParse(argsDominio ?? {});
    if (!parsed.success)
      throw new ErroTool(`Argumentos inválidos: ${resumoZod(parsed.error)}`);
    argsLog = argsParaLog(parsed.data);

    // gate por papel EFETIVO (0085): my_papeis traz primário + secundários
    // — o híbrido chama a tool do papel que ele tem, mesmo fora do primário.
    // ctx.papel é o papel que liberou (ordem do roles da tool — staff antes
    // de mentorado), pra run ramificar certo (ex.: ficha do jovem)
    const papeis = papeisForcados ?? (await papeisDoUsuario(supabase));
    const papel = (tool.roles as readonly Papel[]).find((r) =>
      papeis.includes(r)
    );
    if (!papel)
      throw new ErroTool("Esta consulta não está disponível pro seu papel.");

    if ((tool as { escreve?: boolean }).escreve) {
      // 2 passos: sem confirmacao_id grava a prévia e devolve o envelope
      // (ok=true, sem efeito); com ele consome atomicamente (dono, mesma
      // tool, mesmo hash, uso único, não expirado) e só então executa
      // o resumo nomeia por nomes (026/FR-010) — args serializados com
      // uuid nunca viram texto visível; sem resumo próprio o fallback é
      // a descrição da tool, também sem args
      const resumo =
        (await (tool as {
          resumo?: (
            a: never,
            supabase: SupabaseClient
          ) => string | Promise<string>;
        }).resumo?.(parsed.data as never, supabase)) ??
        `${tool.descricao.split(/[.;]/)[0]}`.slice(0, 300);
      if (typeof confirmacaoId !== "string" || !confirmacaoId) {
        const { data: cid, error: eCriar } = await supabase.rpc(
          "ia_confirmacao_criar",
          { p_tool: nome, p_args: parsed.data, p_resumo: resumo }
        );
        if (eCriar || !cid) {
          console.error("ia_confirmacao_criar:", eCriar);
          throw new ErroTool(
            "Não consegui preparar a confirmação — tente de novo."
          );
        }
        dados = {
          pendente_confirmacao: {
            confirmacao_id: cid,
            tool: nome,
            args: parsed.data,
            resumo,
            expira_em_minutos: 10,
            instrucao:
              "Nada foi alterado ainda. Para executar, chame a mesma tool com os mesmos argumentos mais confirmacao_id.",
          },
        };
        ok = true;
      } else {
        const { data: consumida, error: eConsumir } = await supabase.rpc(
          "ia_confirmacao_consumir",
          { p_id: confirmacaoId, p_tool: nome, p_args: parsed.data }
        );
        if (eConsumir) {
          console.error("ia_confirmacao_consumir:", eConsumir);
          throw new ErroTool(
            "Não consegui validar a confirmação — tente de novo."
          );
        }
        if (!consumida) {
          throw new ErroTool(
            "Confirmação inválida, expirada ou já utilizada (ou os argumentos mudaram) — peça a prévia de novo."
          );
        }
        dados = await tool.run(parsed.data as never, { supabase, papel, papeis });
        ok = true;
      }
    } else {
      // dedup por sessão: a chave usa os args CANÔNICOS (pós-zod) — mesma
      // serialização da confirmação (canonico), chaves ordenadas em
      // profundidade. Falha não fica guardada (o erro propaga antes do
      // set) e `rodou` separa hit de miss: o obter só chama o carregador
      // quando a entrada não existe nem está em voo — dividir a promessa
      // de outra chamada idêntica também conta como dedup.
      const chaveDedup =
        opcoes?.dedupKey && nome !== "guia_consulta"
          ? `${opcoes.dedupKey}|${nome}|${createHash("sha256")
              .update(canonico(parsed.data))
              .digest("hex")
              .slice(0, 16)}`
          : null;
      if (chaveDedup) {
        let rodou = false;
        // `parsed.data` já passou no schema da própria tool — o `as
        // never` casa com a união dos params tipados de cada run
        dados = await dedupTools.obter(chaveDedup, async () => {
          rodou = true;
          return tool.run(parsed.data as never, { supabase, papel, papeis });
        });
        dedupHit = !rodou;
      } else {
        dados = await tool.run(parsed.data as never, { supabase, papel, papeis });
      }
      ok = true;
    }
  } catch (e) {
    if (e instanceof ErroTool) {
      erro = e.message;
    } else {
      console.error(`executarTool(${nome}):`, e);
      erro = "Não consegui executar esta consulta agora.";
    }
  }

  // hit do dedup sai marcado em args.cache — é o que permite contar na
  // telemetria quantas tool calls foram poupadas por sessão
  const argsEvento = dedupHit
    ? { ...argsMinimizados(nome, argsLog), cache: true }
    : argsMinimizados(nome, argsLog);

  if (opcoes?.coletarEvento) {
    opcoes.coletarEvento({
      canal,
      tool: nome,
      args: argsEvento,
      ok,
      erro,
      duracao_ms: Date.now() - inicio,
      request_id: requestId ?? null,
    });
    return ok ? { ok: true, dados } : { ok: false, erro: erro! };
  }

  try {
    const { error: erroAudit } = await supabase.rpc("registrar_ia_evento", {
      p_canal: canal,
      p_tool: nome,
      p_args: argsEvento,
      p_ok: ok,
      p_erro: erro,
      p_duracao_ms: Date.now() - inicio,
      p_profile_id: autorProfileId ?? null,
      p_request_id: requestId ?? null,
    });
    if (erroAudit) console.error("registrar_ia_evento:", erroAudit);
  } catch (e) {
    console.error("registrar_ia_evento:", e);
  }

  return ok ? { ok: true, dados } : { ok: false, erro: erro! };
}
