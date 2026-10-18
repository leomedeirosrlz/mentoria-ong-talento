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

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { comparaNome, saudadeDaDupla } from "@/lib/ciclo";
import { filaMentorados, filaMentores, tetoMentor } from "@/lib/fila";
import { temPapel } from "@/lib/types";
import type { AppRole, Dupla, Mentorado, Profile } from "@/lib/types";
import {
  getCapacidadeInsumos,
  getCicloEventosIa,
  getDuplaIa,
  getDuplasVivasIa,
  getFilaInsumos,
  getInstrumentosDaDuplaIa,
  getJovemDuplaIa,
  getRegistrosDaDuplaIa,
  papelDoUsuario,
} from "./queries";

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

const semaforoOrd = { risco: 0, atencao: 1, ok: 2 } as const;

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
      return {
        gerado_em: new Date().toISOString(),
        total: itens.length,
        duplas: itens,
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
        const r = await getJovemDuplaIa(ctx.supabase, dupla_id);
        if (!r) return null;
        return {
          dupla_id: r.dupla.id,
          trilha: r.dupla.trilha,
          status: r.dupla.status,
          turma: r.dupla.turma,
          iniciada_em: r.dupla.iniciada_em,
          demanda: r.dupla.demanda,
          pdm_url: r.dupla.pdm_url,
          mentor: r.dupla.mentor_nome,
          supervisor: r.dupla.supervisor_nome,
          encontros: r.encontros,
        };
      }
      const [d, eventos] = await Promise.all([
        getDuplaIa(ctx.supabase, dupla_id),
        getCicloEventosIa(ctx.supabase),
      ]);
      if (!d) return null;
      const s = saudadeDaDupla(d as unknown as Dupla, eventos);
      return {
        dupla_id: d.id,
        trilha: d.trilha,
        status: d.status,
        turma: d.turma,
        iniciada_em: d.iniciada_em,
        demanda: d.demanda,
        pdm_url: d.pdm_url,
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
      "A fila de espera por pareamento, derivada ao vivo como na página de Pessoas: mentorados inscritos que nunca tiveram dupla (com origem e desde quando esperam) e mentores ativos com vaga livre (trilha e vagas). Use pra 'quem tá esperando par?', 'quantos jovens na fila?'.",
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
        trilha: m.trilha,
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
  canal: CanalIa
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

    const papel = await papelDoUsuario(supabase);
    if (!papel || !(tool.roles as readonly Papel[]).includes(papel))
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
      p_args: argsLog,
      p_ok: ok,
      p_erro: erro,
      p_duracao_ms: Date.now() - inicio,
    });
    if (erroAudit) console.error("registrar_ia_evento:", erroAudit);
  } catch (e) {
    console.error("registrar_ia_evento:", e);
  }

  return ok ? { ok: true, dados } : { ok: false, erro: erro! };
}
