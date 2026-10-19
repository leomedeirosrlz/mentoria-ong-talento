import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { temPapel } from "@/lib/types";
import {
  getCicloEventos,
  getCronogramas,
  getDuplas,
  getEspecialistaEventos,
  getMateriais,
  getMe,
  getMeuMentorProfile,
} from "@/lib/queries";
import { getMentoresChamada, getPresencas } from "@/lib/queries-presenca";
import { getSupervisoesDaPessoa } from "@/lib/queries-supervisao";
import {
  getEspecialistas,
  getMinhaGrade,
  getMinhasExcecoes,
  getSlotsLivres,
  getSolicitacoesDaDupla,
  getTrilhasDosJovens,
} from "@/lib/queries-especialista";
import type { SolicitacaoEspecialista } from "@/lib/types";
import {
  cronogramaVigente,
  eventoDaSemana,
  eventosDoCronograma,
  toDateStr,
} from "@/lib/ciclo";
import { sessoesDaGrade } from "@/lib/agenda-especialista";
import { AgendaCalendario } from "@/components/agenda-calendario";
import { AgendaDisponibilidade } from "@/components/agenda-disponibilidade";
import { AgendaEspecialista } from "@/components/agenda-especialista";
import { AgendaMinha } from "@/components/agenda-minha";
import { AgendaPorMentorado } from "@/components/agenda-por-mentorado";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; visao?: string; aba?: string }>;
}) {
  // ?dia=YYYY-MM-DD abre a agenda já no dia (deep-link da ficha/notificações);
  // ?visao=dpp|especialista abre a aba correspondente do híbrido (WP6b);
  // ?aba=minha|por-mentorado|calendario abre o modo dentro da visão DPP (WP3)
  const { dia, visao: visaoParam, aba: abaParam } = await searchParams;
  const diaInicial = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null;
  // valor fora do vocabulário vale como param ausente — cai no default do
  // papel primário em vez de forçar a visão DPP
  const visao =
    visaoParam === "dpp" || visaoParam === "especialista" ? visaoParam : null;

  // getDuplas vem no escopo do RLS: mentor→a própria, supervisor→supervisionadas, coord→todas.
  // O que só um ramo usa (materiais, grade do mentor, chamada, catálogo esp)
  // é buscado depois do roteamento — a aba não paga pela query da outra.
  const [eventos, me, duplas, cronogramas] = await Promise.all([
    getCicloEventos(),
    getMe(),
    getDuplas(),
    getCronogramas(),
  ]);
  const agora = new Date();
  const hoje = toDateStr(agora);
  // "semana do encontro" é do cronograma vigente (o default da tela) — na
  // união dos calendários, semana de T1 e T2 se embaralhariam. Ela alimenta
  // só a inicialização/deep-link do calendário: dentro dele o "atual" é
  // recomputado do cronograma selecionado
  const vigente = cronogramaVigente(cronogramas, agora);
  const eventosVigente = vigente
    ? eventosDoCronograma(eventos, vigente.id)
    : eventos;
  const semana = eventoDaSemana(eventosVigente, agora);
  const temEspecialista = duplas.some((d) => d.trilha === "especialista");
  // Quem tem o papel de especialista carrega a agenda própria (grade,
  // exceções, fila) — papel efetivo, não primário: o híbrido DPP também
  // configura a dele (WP6b). A superfície DPP (calendário oficial do ciclo)
  // vale pra todo mundo menos o especialista puro — o híbrido vê as duas
  // em abas (?visao=), aterrissando na do papel primário
  const souEsp = temPapel(me, "mentor_especialista");
  const mostraDpp =
    !souEsp ||
    temPapel(me, "mentor_dpp") ||
    duplas.some((d) => d.trilha !== "especialista");
  const duasVisoes = souEsp && mostraDpp;
  const visaoEsp =
    souEsp &&
    (!duasVisoes ||
      (visao ? visao === "especialista" : me?.role === "mentor_especialista"));

  if (visaoEsp) {
    // agenda real do especialista (0073): grade semanal + exceções + a
    // projeção de slots que os jovens veem — buscadas sempre, mesmo sem
    // dupla (configurar a oferta é justamente o estado vazio ideal)
    const [grade, excecoes, slots, espEventos] = await Promise.all([
      getMinhaGrade(),
      getMinhasExcecoes(),
      getSlotsLivres(me!.id),
      temEspecialista ? getEspecialistaEventos() : Promise.resolve([]),
    ]);
    // sem dupla ainda: cabeçalho + a agenda editável + o estado vazio — a
    // grade de terças DPP não se aplica a ele. No híbrido, a fila usa só as
    // trilhas esp — a DPP tem a própria aba de calendário.
    // `duplas` vem no escopo do RLS — pra supervisor/coord que TAMBÉM é
    // mentor_especialista ele traz duplas de outros mentores; a visão esp é
    // "minha agenda", então filtra pelas do próprio mentor antes de derivar.
    const minhasDuplas = duplas.filter((d) => d.mentor?.id === me!.id);
    const duplasEsp = minhasDuplas.filter((d) => d.trilha === "especialista");
    // Blocos de sessão da grade visual: todas as duplas do mentor — os
    // encontros DPP do híbrido ocupam a agenda física (a projeção de slots
    // já os desconta), então aparecem muted pra não fingir horário livre
    const sessoes = sessoesDaGrade(minhasDuplas);
    const conteudoEsp =
      duplasEsp.length === 0 ? (
        <div className="space-y-6">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Mentoria especializada · até 5 encontros de 1h em até 3 meses. As
              datas são combinadas por vocês, sem terça oficial.
            </p>
          </header>
          <AgendaDisponibilidade
            grade={grade}
            excecoes={excecoes}
            slots={slots}
            sessoes={sessoes}
            hojeIso={hoje}
          />
          <div className="rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted-foreground">
              {duasVisoes
                ? "Você ainda não tem trilhas de especialista. Quando a coordenação formar uma, os encontros combinados aparecem aqui."
                : "Você ainda não está em nenhuma dupla. Quando a coordenação formar uma, os encontros combinados aparecem aqui."}
            </p>
          </div>
        </div>
      ) : (
        <AgendaEspecialista
          duplas={duplasEsp}
          espEventos={espEventos}
          grade={grade}
          excecoes={excecoes}
          slots={slots}
          sessoes={sessoes}
          hojeIso={hoje}
        />
      );
    return duasVisoes ? (
      <div className="space-y-6">
        <AbasAgenda ativa="especialista" />
        {conteudoEsp}
      </div>
    ) : (
      conteudoEsp
    );
  }

  // WP3 — os modos do mentor DPP vivem numa tablist dentro da visão DPP:
  // Minha agenda (cronológica, default — "o que eu tenho hoje" primeiro),
  // Por mentorado (card por jovem com a trilha do especialista em modo
  // "acompanha, não participa") e Calendário (o AgendaCalendario atual,
  // preservado inteiro). Coord/sup ficam no calendário — os modos novos são
  // do mentor. Param inválido cai em "minha" — default da v6, não do papel.
  // ?dia= sem ?aba= explícita mira o calendário — o deep-link é dele.
  const souMentor = temPapel(me, "mentor_dpp");
  const aba =
    abaParam === "por-mentorado" || abaParam === "calendario"
      ? abaParam
      : diaInicial != null
        ? "calendario"
        : "minha";
  const duplasDpp = duplas.filter((d) => d.trilha !== "especialista");

  if (souMentor && aba !== "calendario") {
    const idsDpp = duplasDpp.map((d) => d.id);
    const [trilhas, supervisoes, solicitacoes, especialistas] =
      await Promise.all([
        getTrilhasDosJovens(idsDpp),
        aba === "minha"
          ? getSupervisoesDaPessoa(me!.id)
          : Promise.resolve([]),
        aba === "por-mentorado"
          ? Promise.all(idsDpp.map((id) => getSolicitacoesDaDupla(id))).then(
              (lista) => Object.fromEntries(idsDpp.map((id, i) => [id, lista[i]]))
            )
          : Promise.resolve({} as Record<string, SolicitacaoEspecialista[]>),
        aba === "por-mentorado" ? getEspecialistas() : Promise.resolve([]),
      ]);
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Os encontros do ciclo, os que você marcou com suas duplas e o que
            seus jovens fazem com os especialistas.
          </p>
        </header>
        {duasVisoes && <AbasAgenda ativa="dpp" />}
        <AbasAgendaMentor ativa={aba} hibrido={duasVisoes} />
        {aba === "minha" ? (
          <AgendaMinha
            duplas={duplasDpp}
            trilhas={trilhas}
            eventos={eventos}
            cronogramas={cronogramas}
            supervisoes={supervisoes}
            meuId={me!.id}
            hoje={hoje}
            agora={agora.getTime()}
          />
        ) : (
          <AgendaPorMentorado
            duplas={duplasDpp}
            trilhas={trilhas}
            solicitacoes={solicitacoes}
            especialistas={especialistas.map((e) => ({
              id: e.id,
              nome: e.nome,
            }))}
            eventos={eventos}
            cronogramas={cronogramas}
            hoje={hoje}
          />
        )}
      </div>
    );
  }

  // ---- ramo calendário (e a única superfície de coord/sup) ----
  // Busca tardia: materiais, grade do mentor (overlay de disponibilidade),
  // chamada da coordenação e o catálogo de sessões esp só valem aqui.
  const [materiais, meuMentorProfile, espEventos] = await Promise.all([
    getMateriais(),
    getMeuMentorProfile(),
    temEspecialista ? getEspecialistaEventos() : Promise.resolve([]),
  ]);
  // audiência = mesma regra de /materiais: "todos" pra todo mundo, "dpp" e
  // "especialista" pro papel correspondente, coordenação vê tudo
  const materiaisVisiveis = materiais.filter((m) => {
    if (m.audiencia === "todos") return true;
    if (me?.role === "coordenacao") return true;
    if (m.audiencia === "dpp") return temPapel(me, "mentor_dpp");
    if (m.audiencia === "especialista")
      return temPapel(me, "mentor_especialista");
    return false;
  });
  // chamada dos encontros de formação — só a coordenação marca; pros demais
  // papéis nem busca (a UI nem renderiza o painel fora da coordenação)
  const idsFormacao = eventos
    .filter((e) => e.tipo === "formacao")
    .map((e) => e.id);
  const [mentoresChamada, presencasLista] =
    me?.role === "coordenacao"
      ? await Promise.all([getMentoresChamada(), getPresencas(idsFormacao)])
      : [[], []];
  const presencasPorEvento: Record<string, Record<string, boolean>> = {};
  for (const p of presencasLista)
    (presencasPorEvento[p.ciclo_evento_id] ??= {})[p.profile_id] = p.presente;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {/* contexto estático por papel — a semana vigente vive no rail e no
              título do board, que acompanham o cronograma selecionado */}
          {me?.role === "coordenacao" || me?.role === "supervisor"
            ? "O calendário oficial do ciclo e o que cada dupla marcou."
            : "Os encontros do ciclo e os que você marcou com sua dupla."}
        </p>
      </header>

      {duasVisoes && <AbasAgenda ativa="dpp" />}
      {souMentor && <AbasAgendaMentor ativa="calendario" hibrido={duasVisoes} />}

      {eventos.length === 0 ? (
        <div className="rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
          <p className="text-sm text-muted-foreground">
            A agenda ainda não foi publicada pela coordenação.
          </p>
        </div>
      ) : (
        <AgendaCalendario
          eventos={eventos}
          cronogramas={cronogramas}
          espEventos={espEventos}
          materiais={materiaisVisiveis}
          hoje={hoje}
          semanaId={semana?.id ?? null}
          diaInicial={diaInicial}
          duplas={duplas}
          role={me?.role ?? null}
          papeis={me?.papeis ?? null}
          mentores={mentoresChamada}
          presencas={presencasPorEvento}
          // Overlay "quem pode nesse dia" — só o mentor DPP (REALIZA-24):
          // coord/sup veem TODAS as duplas (uma tinta por dupla seria
          // ambígua) e o especialista tem o próprio sistema de slots
          // (0073, AgendaEspecialista), não a grade dow×período
          mentorDisponibilidade={
            temPapel(me, "mentor_dpp")
              ? (meuMentorProfile?.disponibilidade ?? null)
              : undefined
          }
        />
      )}
    </div>
  );
}

/** Abas da agenda do híbrido (WP6b) — quem é DPP + especialista alterna
 *  entre o calendário oficial do ciclo e a agenda própria de especialista.
 *  Deep-link por ?visao= — notificações de trilha esp podem pousar direto. */
function AbasAgenda({ ativa }: { ativa: "dpp" | "especialista" }) {
  return (
    <nav
      aria-label="Visão da agenda"
      className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
    >
      {(
        [
          // o param explícito é obrigatório — sem ele o default recai na
          // visão do papel primário e a aba DPP fica inalcançável pro
          // híbrido com primário especialista
          ["dpp", "Ciclo DPP", "/agenda?visao=dpp"],
          ["especialista", "Especialista", "/agenda?visao=especialista"],
        ] as const
      ).map(([v, label, href]) => (
        <Link
          key={v}
          href={href}
          aria-current={ativa === v ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            ativa === v
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Modos da agenda do mentor DPP (WP3) — segundo nível, dentro da visão DPP.
 *  Link + role=tablist/tab: deep-link por ?aba= (notificação pode pousar na
 *  aba certa) sem roubar o nome acessível "Visão da agenda" do nav do
 *  híbrido (WP6b). No híbrido os links carregam ?visao=dpp — sem ele a
 *  aba DPP volta a ficar inalcançável pra quem tem primário especialista. */
function AbasAgendaMentor({
  ativa,
  hibrido,
}: {
  ativa: "minha" | "por-mentorado" | "calendario";
  hibrido: boolean;
}) {
  const base = hibrido ? "/agenda?visao=dpp&aba=" : "/agenda?aba=";
  return (
    <div
      role="tablist"
      aria-label="Modos da agenda"
      className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
    >
      {(
        [
          ["minha", "Minha agenda"],
          ["por-mentorado", "Por mentorado"],
          ["calendario", "Calendário"],
        ] as const
      ).map(([v, label]) => (
        <Link
          key={v}
          role="tab"
          aria-selected={ativa === v}
          href={`${base}${v}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            ativa === v
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
