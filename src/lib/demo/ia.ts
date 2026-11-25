"use server";

// Assistente na /demo: sem provider nem API — mas os cards da genUI
// direta saem pelo MESMO caminho da rota real (projetarResumo/projetarFicha
// → uiDaTool) a partir do dataset evergreen, então o visitante vê a
// experiência de verdade com números de exemplo. O texto é honesto
// ("na demonstração…") e as intenções cobertas são as que o dataset
// responde; o resto cai na resposta enlatada do cliente (null).

import { projetarFicha, projetarResumo } from "@/lib/ia/tools";
import type { DuplaIa } from "@/lib/ia/queries";
import { uiDaTool, type UiBloco } from "@/lib/ia/ui";
import { PERGUNTAS } from "@/lib/ajuda/conteudo";
import { normaliza } from "@/lib/utils";
import { demoRole } from "./mode";
import { demoJovemJornada } from "./forms-data";
import {
  demoCicloEventos,
  demoDuplas,
  demoJovemDuplas,
  demoJovemEncaminhamentos,
  demoJovemEncontros,
  demoSolicitacoesVisiveis,
} from "./queries";

type RespostaDemo = { content: string; ui: UiBloco[] };

const STAFF = ["coordenacao", "supervisor"];

const sugestoes = (itens: string[]) =>
  `\n\n\`\`\`sugestoes\n${JSON.stringify(itens)}\n\`\`\``;

// ---------- ajuda do jovem ----------

// palavras-vazia da busca do FAQ — a forma da pergunta ("o que é…",
// "como funciona…") casaria com qualquer resposta e aposentaria o
// placar; só o tema pontua
const AJUDA_VAZIAS = new Set([
  "que", "como", "qual", "quais", "quem", "onde", "quando", "funciona",
  "pra", "para", "por", "sobre", "essa", "esse", "isso", "isto", "voce",
  "você", "meu", "minha", "meus", "minhas", "uma", "uns", "ser", "sao",
  "são", "tem", "ter", "diz",
]);

// sigla → a forma por extenso que a ajuda escreve: o FAQ oficial fala
// "plano de desenvolvimento", nunca "PDM" — sem a expansão a busca não
// acha a entrada certa
const AJUDA_SIGLAS: Record<string, string[]> = {
  pdm: ["pdm", "plano", "desenvolvimento"],
};

/** FAQ oficial do jovem → card "Ajuda do Realiza" (mesmo uiDaTool da
 *  rota real): placar = termos do tema achados no texto pergunta +
 *  resposta, top 3. Null quando nada pontua — a resposta honesta assume. */
function uiAjuda(pergunta: string): UiBloco | null {
  // quebra em tudo que não é letra/dígito: "pdm?" precisa virar "pdm"
  const termos = normaliza(pergunta)
    .split(/[^a-z0-9]+/)
    .flatMap((t) => AJUDA_SIGLAS[t] ?? [t])
    .filter((t) => t.length > 2 && !AJUDA_VAZIAS.has(t));
  const ranqueadas = PERGUNTAS.filter((x) => x.papeis.includes("mentorado"))
    .map((x) => ({
      x,
      score: termos.filter((t) =>
        normaliza(`${x.pergunta} ${x.resposta}`).includes(t)
      ).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!ranqueadas.length) return null;
  return uiDaTool("ajuda_faq", {
    respostas: ranqueadas.map(({ x }) => ({
      pergunta: x.pergunta,
      resposta: x.resposta,
    })),
  });
}

export async function responderDemoIa(
  pergunta: string
): Promise<RespostaDemo | null> {
  const role = await demoRole();
  if (!role) return null;
  const p = pergunta.toLowerCase();
  const duplas = demoDuplas(role).filter((d) =>
    ["ativa", "pausada"].includes(d.status)
  ) as unknown as DuplaIa[];
  const eventos = demoCicloEventos();

  // o rascunho é fala de staff pra dupla ("Oi, pessoal!") — pro mentorado
  // cai no bloco próprio abaixo em vez de um texto sem sentido pra ele
  if (role !== "mentorado" && /mensagem|lembrete|escrev|rascunho|convite/.test(p)) {
    const d = duplas[0];
    const jovem = d?.mentorado?.nome?.split(" ")[0] ?? "pessoal";
    return {
      content: `Montei um rascunho de exemplo pra você ajustar e enviar.\n\n\`\`\`rascunho\n${JSON.stringify(
        {
          canal: "whatsapp",
          para: d?.mentorado?.nome ?? "a dupla",
          texto: `Oi, ${jovem}! Passando pra lembrar do nosso próximo encontro. Se precisar remarcar, me avisa por aqui que a gente acha outro horário. Até lá!`,
        }
      )}\n\`\`\`${sugestoes(["Próximos encontros", "Como está minha dupla?"])}`,
      ui: [],
    };
  }

  if (/agenda|encontro|próxim|proxim/.test(p) && role !== "mentorado") {
    const agora = Date.now();
    const desde = agora - 3 * 86_400_000;
    const ate = agora + 14 * 86_400_000;
    const encontros = duplas
      .flatMap((d) =>
        d.encontros
          .filter((e) => {
            const t = e.data_hora ? Date.parse(e.data_hora) : NaN;
            return t >= desde && t <= ate;
          })
          .map((e) => ({
            dupla_id: d.id,
            mentor: d.mentor?.nome ?? null,
            mentorado: d.mentorado?.nome ?? null,
            numero: e.numero,
            status: e.status,
            data_hora: e.data_hora,
          }))
      )
      .sort((a, b) => String(a.data_hora).localeCompare(String(b.data_hora)));
    const ui = uiDaTool("agenda_do_periodo", {
      desde: new Date(desde).toISOString(),
      ate: new Date(ate).toISOString(),
      total: encontros.length,
      encontros,
    });
    return {
      content: ui
        ? `Na demonstração a agenda é de exemplo. Os encontros já marcados estão acima; vale confirmar com as duplas os desta semana.${sugestoes(["Resumo da semana", "Escreva um lembrete pra dupla"])}`
        : `Na demonstração não há encontros nas próximas duas semanas.${sugestoes(["Resumo da semana"])}`,
      ui: ui ? [ui] : [],
    };
  }

  // ---------- mentorado: os branches dele saem das mesmas funções demo
  // do shell /jovem, projetados pelo uiDaTool igual à rota real ----------
  if (role === "mentorado") {
    // pergunta conceitual ("o que é…", "como funciona…") vai pra ajuda
    // oficial, não pros cards de dados — a mesma régua da tool ajuda_faq:
    // conceito do programa sai do FAQ, dado pessoal das outras tools.
    // Vem primeiro: "o que é o PDM?" não é pedido de progresso e "como
    // funciona o especialista?" não é a lista de pedidos
    if (
      /\bo que (é|e|sao|são|significa)|como funciona|pra que|o que diz\b/.test(
        p
      )
    ) {
      const ui = uiAjuda(p);
      return {
        content: ui
          ? `Na demonstração a resposta sai da ajuda oficial, igual ao card acima. No ambiente real a Liza também consulta os guias do programa.${sugestoes(["Como tá minha jornada?", "O que tenho pra fazer?"])}`
          : `Na demonstração a Liza responde dúvidas do programa com a ajuda oficial. No ambiente real ela também consulta os guias.${sugestoes(["Quem é meu mentor?"])}`,
        ui: ui ? [ui] : [],
      };
    }
    if (/agenda|encontro|próxim|proxim|quando|tive|teve|rolou/.test(p)) {
      const agoraMs = Date.now();
      const agora = new Date(agoraMs).toISOString();
      // "tive encontro essa semana?" pergunta do que rolou: os realizados
      // recentes entram na lista junto dos marcados — o card mostra a
      // pill de cada status
      const passado = /tive|teve|rolou|já foi|ja foi|aconteceu/.test(p);
      const desdePassado = new Date(agoraMs - 14 * 86_400_000).toISOString();
      const proximos = demoJovemEncontros(role)
        .filter(
          (e) =>
            ((e.status === "agendado" || e.status === "remarcado") &&
              (e.data_hora == null || e.data_hora >= agora)) ||
            (passado &&
              e.status === "realizado" &&
              e.data_hora != null &&
              e.data_hora >= desdePassado)
        )
        .slice(0, 8);
      // mentor por dupla, igual à tool real (DPP e especialista convivem)
      const nomes = new Map(
        demoJovemDuplas(role).map((d) => [d.id, d.mentor_nome_social ?? d.mentor_nome])
      );
      const ui = proximos.length
        ? uiDaTool("minha_agenda", {
            proximos: proximos.map((e) => ({
              dupla_id: e.dupla_id,
              mentor: nomes.get(e.dupla_id) ?? null,
              numero: e.numero,
              data_hora: e.data_hora,
              status: e.status,
              link: e.link,
            })),
          })
        : null;
      return {
        content: ui
          ? passado
            ? `Na demonstração a agenda é de exemplo. O que rolou e os próximos estão acima; se algum não aconteceu, combina outro dia com seu mentor na mesma semana.${sugestoes(["Quando é o próximo encontro?", "O que tenho pra fazer?"])}`
            : `Na demonstração a agenda é de exemplo. Seus próximos encontros estão acima; se não der pra ir, avisa seu mentor com antecedência.${sugestoes(["O que tenho pra fazer?", "Como tá minha jornada?"])}`
          : `Na demonstração não há encontro marcado. Quem marca é você com seu mentor: combina com ele.${sugestoes(["Quem é meu mentor?"])}`,
        ui: ui ? [ui] : [],
      };
    }
    if (/combinado|tarefa|pra fazer|falta|dever|lição|licao/.test(p)) {
      const lista = demoJovemEncaminhamentos(role);
      const ui = lista.length
        ? uiDaTool("meus_combinados", {
            pendentes: lista
              .filter((c) => c.status === "pendente")
              .map((c) => ({ texto: c.descricao, prazo: c.prazo })),
            feitos_recentes: lista
              .filter((c) => c.status !== "pendente")
              .slice(0, 5)
              .map((c) => ({ texto: c.descricao })),
          })
        : null;
      return {
        content: ui
          ? `Na demonstração os combinados são de exemplo. Os pendentes estão acima. Fez algum? Marca na sua página ou conversa com seu mentor.${sugestoes(["Quando é o próximo encontro?", "Como tá minha jornada?"])}`
          : `Na demonstração não há combinado pendente.${sugestoes(["Como tá minha jornada?"])}`,
        ui: ui ? [ui] : [],
      };
    }
    if (/jornada|progresso|instrumento|pdm|roda da vida|metas|visão|visao|atrasad/.test(p)) {
      const j = demoJovemJornada(role);
      const ui = j
        ? uiDaTool("meu_progresso", {
            dupla_id: j.dupla_id,
            instrumentos: (j.instrumentos ?? []).map((i) => {
              const minhas = (i.entregas ?? []).filter(
                (e) => e.destino === "mentorado"
              );
              return {
                sistema: i.sistema,
                titulo: i.titulo ?? i.sistema,
                respondidos: minhas.filter((e) => e.status === "respondido").length,
                pendentes: minhas.filter((e) => e.status === "pendente").length,
              };
            }),
            total_respondidos: 0,
            total_pendentes: 0,
          })
        : null;
      // total sai do recorte real — recalcula depois do projetor
      const uiOk =
        ui?.kind === "jornada"
          ? {
              ...ui,
              total_respondidos: ui.instrumentos.reduce((a, i) => a + i.respondidos, 0),
              total_pendentes: ui.instrumentos.reduce((a, i) => a + i.pendentes, 0),
            }
          : ui;
      return {
        content: uiOk
          ? `Na demonstração o progresso é de exemplo. A esteira acima mostra o que já foi e o que falta responder. Tá em dúvida em algum?${sugestoes(["O que tenho pra fazer?", "Quem é meu mentor?"])}`
          : `Na demonstração a jornada ainda não começou.${sugestoes(["Quem é meu mentor?"])}`,
        ui: uiOk ? [uiOk] : [],
      };
    }
    if (/dupla|mentor|supervisor|com quem|quem /.test(p)) {
      // demoJovemDuplas/jovemEncontros: o mesmo recorte da view jovem_* —
      // demoDuplas(role) filtra por mentor.id e devolve [] pro mentorado
      const jovemDuplas = demoJovemDuplas(role);
      // a DPP é "a dupla" pro jovem — a de especialista é trilha (null=dpp)
      const d = jovemDuplas.find((x) => x.trilha !== "especialista") ?? jovemDuplas[0];
      const encontros = d
        ? demoJovemEncontros(role).filter((e) => e.dupla_id === d.id)
        : [];
      const ui = d
        ? uiDaTool("minha_dupla", {
            dupla_id: d.id,
            trilha: d.trilha,
            status: d.status,
            turma: d.turma,
            iniciada_em: d.iniciada_em,
            demanda: d.demanda,
            mentor: d.mentor_nome_social ?? d.mentor_nome,
            supervisor: d.supervisor_nome_social ?? d.supervisor_nome,
            encontros: encontros.map((e) => ({
              numero: e.numero,
              status: e.status,
              data_hora: e.data_hora,
            })),
          })
        : null;
      return {
        content: ui
          ? `Na demonstração a dupla é de exemplo. Mentor e supervisor estão no card acima. O próximo passo é manter os encontros marcados.${sugestoes(["Quando é o próximo encontro?", "O que tenho pra fazer?"])}`
          : `Na demonstração ainda não há dupla formada.${sugestoes(["O que é o PDM?"])}`,
        ui: ui ? [ui] : [],
      };
    }
    if (/especialista|pedido|pedi/.test(p)) {
      const pedidos = demoSolicitacoesVisiveis(role);
      const ui = pedidos.length
        ? uiDaTool("meus_pedidos", {
            pedidos: pedidos.map((s) => ({
              especialista: s.especialista?.nome ?? null,
              sobre: s.demanda ?? s.motivo ?? null,
              status: s.status_efetivo ?? s.status,
              criado_em: s.created_at,
            })),
          })
        : null;
      return {
        content: ui
          ? `Na demonstração os pedidos são de exemplo. O andamento de cada um tá acima. Quem destrava é a coordenação.${sugestoes(["Como tá minha jornada?"])}`
          : `Na demonstração não há pedido de especialista.${sugestoes(["Como tá minha jornada?"])}`,
        ui: ui ? [ui] : [],
      };
    }
  }

  if (STAFF.includes(role) && /resumo|semana|risco|aten|como est|duplas|apoio/.test(p)) {
    const ui = uiDaTool("resumo_semana", projetarResumo(duplas, eventos));
    const pedem = ui?.kind === "saude" ? ui.pedem_acao : 0;
    return {
      content: `Na demonstração os números são de exemplo. ${
        pedem
          ? `${pedem === 1 ? "Uma dupla pede" : `${pedem} duplas pedem`} ação agora: comece por quem pediu apoio e depois pelas em risco.`
          : "Nenhuma dupla pede ação agora."
      }${sugestoes(["Encontros desta semana", "Escreva um lembrete pra dupla"])}`,
      ui: ui ? [ui] : [],
    };
  }

  if (/minha dupla|como est|dupla/.test(p) && duplas[0]) {
    const ficha = projetarFicha(duplas[0], eventos);
    // o jovem não vê a situação calculada (instrumento da equipe) — o
    // projetor omite quando a tool não manda semáforo, igual à rota real
    const dados =
      role === "mentorado"
        ? {
            dupla_id: ficha.dupla_id,
            trilha: ficha.trilha,
            status: ficha.status,
            turma: ficha.turma,
            mentor: ficha.mentor,
            mentorado: ficha.mentorado,
            supervisor: ficha.supervisor,
            encontros: ficha.encontros,
            proximo_encontro: ficha.proximo_encontro,
          }
        : ficha;
    const ui = uiDaTool("ficha_dupla", dados);
    return {
      content: `Na demonstração a dupla é de exemplo. O resumo está acima; o próximo passo é manter o encontro marcado e o registro em dia.${sugestoes(["Próximos encontros", "Escreva um lembrete pra dupla"])}`,
      ui: ui ? [ui] : [],
    };
  }

  return null;
}
