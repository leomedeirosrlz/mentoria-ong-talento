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
import { demoRole } from "./mode";
import { demoCicloEventos, demoDuplas } from "./queries";

type RespostaDemo = { content: string; ui: UiBloco[] };

const STAFF = ["coordenacao", "supervisor"];

const sugestoes = (itens: string[]) =>
  `\n\n\`\`\`sugestoes\n${JSON.stringify(itens)}\n\`\`\``;

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

  if (/mensagem|lembrete|escrev|rascunho|convite/.test(p)) {
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
