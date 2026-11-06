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
// client do próprio usuário, nunca service role.
//
// Toda chamada grava ia_eventos (0083): canal, tool, args canônicos, ok/erro
// e latência — inclusive as rejeitadas, porque "o que a IA tentou" também é
// auditoria.

import { createHash } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { comparaNome, saudadeDaDupla } from "@/lib/ciclo";
import { filaMentorados, filaMentores, tetoMentor } from "@/lib/fila";
import { saudeDoRecorte } from "@/lib/agenda-coordenacao";
import { temPapel } from "@/lib/types";
import type {
  AppRole,
  CicloEvento,
  Dupla,
  Mentorado,
  Profile,
} from "@/lib/types";
import {
  getAgendaPeriodoIa,
  getCapacidadeInsumos,
  getChamadosIa,
  getCicloEventosIa,
  getDuplaIa,
  getDuplasResumoIa,
  getDuplasVivasIa,
  getFilaInsumos,
  getInstrumentosDaDuplaIa,
  getJovemAgendaIa,
  getJovemCombinadosIa,
  getJovemDuplaIa,
  getJovemPedidosIa,
  getJovemProgressoIa,
  getMinhaDuplaIa,
  getPessoasBuscaIa,
  getRegistrosDaDuplaIa,
  papeisDoUsuario,
  type DuplaIa,
} from "./queries";
import { PERGUNTAS } from "@/lib/ajuda/conteudo";
import { normaliza } from "@/lib/utils";
import { getIaConfig } from "./config";
import { buscarNosGuias, catalogoGuias } from "./guias";

/** Canais registrados em ia_eventos — o CHECK do banco fecha o vocabulário. */
export type CanalIa = "chat" | "mcp";

/** O `roles` do registry — vocabulário do banco (app_role). */
export type Papel = AppRole;

export type ResultadoTool =
  | { ok: true; dados: unknown }
  | { ok: false; erro: string };

type ContextoIa = {
  supabase: SupabaseClient;
  papel: Papel;
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

const guiaArgs = z
  .object({
    pergunta: z
      .string()
      .min(3)
      .max(300)
      .describe("a pergunta em linguagem natural, como o usuário fez"),
  })
  .strict();

const semaforoOrd = { risco: 0, atencao: 1, ok: 2 } as const;

/** Saída do resumo_semana a partir das duplas vivas — pura, pra a demo
 *  (/demo, dataset em memória) responder pelo MESMO caminho da tool. */
export function projetarResumo(duplas: DuplaIa[], eventos: CicloEvento[]) {
  const itens = duplas.map((d) => {
    // a projeção de IA_SAUDE_SELECT é exatamente o que saudadeDaDupla
    // lê — o contrato é a constante compartilhada, não a linha solta
    const s = saudadeDaDupla(d as unknown as Dupla, eventos);
    return {
      dupla_id: d.id,
      mentor: d.mentor?.nome ?? null,
      mentorado: d.mentorado?.nome ?? null,
      trilha: d.trilha,
      status: d.status,
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
  // chat e o texto do modelo leem o mesmo número da home e de /duplas
  const saude = saudeDoRecorte(duplas as unknown as Dupla[], eventos, new Date());
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
    },
    duplas: itens,
  };
}

/** Saída do ficha_dupla (visão da equipe) — pura, idem projetarResumo. */
export function projetarFicha(d: DuplaIa, eventos: CicloEvento[]) {
  const s = saudadeDaDupla(d as unknown as Dupla, eventos);
  return {
    dupla_id: d.id,
    trilha: d.trilha,
    status: d.status,
    turma: d.turma,
    iniciada_em: d.iniciada_em,
    demanda: d.demanda,
    mentor: d.mentor?.nome ?? null,
    mentorado: d.mentorado?.nome ?? null,
    supervisor: d.supervisor?.nome ?? null,
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
    encontros: d.encontros
      .map((e) => ({
        numero: e.numero,
        status: e.status,
        data_hora: e.data_hora,
        realizado_em: e.realizado_em,
        tem_registro: e.registro != null,
      }))
      .sort((a, b) => a.numero - b.numero),
  };
}

export const IA_TOOLS = {
  resumo_semana: {
    nome: "resumo_semana",
    descricao:
      "Panorama das duplas vivas (ativas e pausadas): o semáforo de cada uma — ok, atenção ou risco — com todos os motivos/sinais acesos, pedidos de apoio abertos (eixo separado do semáforo: trabalho, não falha), quantos encontros eram esperados × realizados e o próximo encontro marcado. Use pra 'como estão as duplas?', 'quem tá em risco?', 'resumo da semana'.",
    schema: semArgs,
    roles: ["coordenacao", "supervisor"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const [duplas, eventos] = await Promise.all([
        getDuplasVivasIa(ctx.supabase),
        getCicloEventosIa(ctx.supabase),
      ]);
      return projetarResumo(duplas, eventos);
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
        const r = await getJovemDuplaIa(ctx.supabase, dupla_id);
        if (!r) return null;
        // o jovem é o outro lado da própria dupla — "Você" como no
        // projetor minha_dupla; sem ele o card voltava a "a definir"
        const prox = r.encontros.find(
          (e) => e.status === "agendado" || e.status === "remarcado"
        );
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
        ins.historico
      ).map((m) => ({
        id: m.id,
        nome: m.nome,
        origem: m.origem,
        esperando_desde: m.desde,
      }));
      const mentores = filaMentores(
        ins.pessoas as Profile[],
        ins.mentorProfiles,
        ins.contagemPorMentor
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
            nome: p.nome,
            trilha,
            em_uso: ins.contagemPorMentor[`${p.id}:${trilha}`] ?? 0,
            capacidade: tetoMentor(p, ins.mentorProfiles[p.id], trilha),
          }));
        })
        .sort((a, b) => comparaNome(a.nome, b.nome));
      return { mentores, total: mentores.length };
    },
  },

  duplas_do_usuario: {
    nome: "duplas_do_usuario",
    descricao:
      "Índice das duplas que o usuário enxerga: o mentor vê as dele, o supervisor as supervisionadas, a coordenação todas. Devolve o dupla_id + nomes, trilha, status e turma de cada uma — chame antes de ficha_dupla/registros_da_dupla quando a pergunta vier sem id ('minha dupla', 'com quem eu trabalho'). `total` é o universo no escopo; quando `truncado` vier true a lista é parcial (máx 60) — avise que há mais duplas além das listadas.",
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
          mentor: d.mentor?.nome ?? null,
          mentorado: d.mentorado?.nome ?? null,
          trilha: d.trilha,
          status: d.status,
          turma: d.turma,
        })),
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
          mentor: e.dupla.mentor?.nome ?? null,
          mentorado: e.dupla.mentorado?.nome ?? null,
          numero: e.numero,
          status: e.status,
          data_hora: e.data_hora,
          realizado_em: e.realizado_em,
        })),
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
      // com fts nenhuma pergunta vai pra OpenAI (minimização)
      const { busca } = await getIaConfig(ctx.supabase);
      const [fontes, guias] = await Promise.all([
        buscarNosGuias(ctx.supabase, pergunta, busca),
        // catálogo completo sempre junto — "que guias você tem" se responde
        // mesmo quando a busca não retorna trecho pro termo perguntado
        catalogoGuias(ctx.supabase),
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
      "Busca pessoas do programa por nome (staff): devolve profile_id, nome, nome social e papel — use pra achar a pessoa antes de perguntar pela ficha dela, ou pra responder 'quem é X'. Contatos e dados sensíveis não saem pela tool.",
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
      "Os 4 instrumentos oficiais da jornada (Visão, Metas, PDM e Roda da Vida) de uma dupla: definição, links emitidos e as respostas já dadas — mesma leitura da RPC instrumentos_da_dupla, que decide o escopo (coord, mentor e supervisor da dupla e o próprio jovem).",
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
      "A dupla do jovem que está falando: mentor, supervisor, trilha, turma e status — sem precisar de id, a view jovem_duplas já é escopada. Use pra 'quem é meu mentor?', 'minha dupla', 'com quem eu converso' e antes de abrir instrumentos da própria dupla (devolve o dupla_id).",
    schema: semArgs,
    roles: ["mentorado"],
    run: async (_args: z.infer<typeof semArgs>, ctx) => {
      const d = await getMinhaDuplaIa(ctx.supabase);
      if (!d) return null;
      // encontros alimentam os quadrados do card — mesma leitura da
      // ficha_dupla do jovem (encontros_select já escopa à dupla dele)
      const ficha = await getJovemDuplaIa(ctx.supabase, d.id);
      return {
        dupla_id: d.id,
        trilha: d.trilha,
        status: d.status,
        turma: d.turma,
        iniciada_em: d.iniciada_em,
        demanda: d.demanda,
        mentor: d.mentor_nome_social ?? d.mentor_nome,
        supervisor: d.supervisor_nome_social ?? d.supervisor_nome,
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
          especialista: p.especialista_nome,
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
} satisfies Record<
  string,
  {
    nome: string;
    descricao: string;
    schema: z.ZodType;
    roles: readonly Papel[];
    // `args: never` é o supertipo universal de qualquer run — o satisfies
    // confere a forma sem apagar o tipo preciso de cada schema
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
  /** profile_id explícito pra auditoria — idem: no MCP não existe JWT, o
   *  my_profile_id() da RPC sairia NULL e o evento não gravaria. O caller
   *  passa o dono da PAT; no chat fica ausente e a RPC usa o JWT. */
  autorProfileId?: string,
  /** request_id da reserva do limite — correla os eventos da tool com a
   *  mensagem que a disparou (sdd D4). Ausente no MCP por enquanto. */
  requestId?: string
): Promise<ResultadoTool> {
  const inicio = Date.now();
  let ok = false;
  let erro: string | null = null;
  let dados: unknown = null;
  // log registra os args crus enquanto o parse não valida; depois, os
  // canônicos (defaults aplicados, campos fora do schema descartados)
  let argsLog = argsParaLog(args);

  try {
    const tool = IA_TOOLS[nome as IaToolNome] as
      | (typeof IA_TOOLS)[IaToolNome]
      | undefined;
    if (!tool) throw new ErroTool(`Tool desconhecida: ${nome}`);

    const parsed = tool.schema.safeParse(args ?? {});
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

    // `parsed.data` já passou no schema da própria tool — o `as never`
    // casa com a união dos params tipados de cada run
    dados = await tool.run(parsed.data as never, { supabase, papel });
    ok = true;
  } catch (e) {
    if (e instanceof ErroTool) {
      erro = e.message;
    } else {
      console.error(`executarTool(${nome}):`, e);
      erro = "Não consegui executar esta consulta agora.";
    }
  }

  try {
    const { error: erroAudit } = await supabase.rpc("registrar_ia_evento", {
      p_canal: canal,
      p_tool: nome,
      p_args: argsMinimizados(nome, argsLog),
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
