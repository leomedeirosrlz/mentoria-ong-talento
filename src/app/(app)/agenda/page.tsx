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
import {
  getMinhaGrade,
  getMinhasExcecoes,
  getSlotsLivres,
} from "@/lib/queries-especialista";
import {
  cronogramaVigente,
  eventoDaSemana,
  eventosDoCronograma,
  toDateStr,
} from "@/lib/ciclo";
import { AgendaCalendario } from "@/components/agenda-calendario";
import { AgendaDisponibilidade } from "@/components/agenda-disponibilidade";
import { AgendaEspecialista } from "@/components/agenda-especialista";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; visao?: string }>;
}) {
  // ?dia=YYYY-MM-DD abre a agenda já no dia (deep-link da ficha/notificações);
  // ?visao=especialista abre a aba de especialista do híbrido (WP6b)
  const { dia, visao: visaoParam } = await searchParams;
  const diaInicial = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null;

  // getDuplas vem no escopo do RLS: mentor→a própria, supervisor→supervisionadas, coord→todas.
  // getMeuMentorProfile resolve cedo pra quem não é mentor (getMe já cacheado) —
  // a grade dele alimenta o overlay de disponibilidade da agenda (REALIZA-24).
  const [eventos, me, duplas, materiais, cronogramas, meuMentorProfile] =
    await Promise.all([
      getCicloEventos(),
      getMe(),
      getDuplas(),
      getMateriais(),
      getCronogramas(),
      getMeuMentorProfile(),
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
  const espEventos = temEspecialista ? await getEspecialistaEventos() : [];
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
      (visaoParam
        ? visaoParam === "especialista"
        : me?.role === "mentor_especialista"));

  if (visaoEsp) {
    // agenda real do especialista (0073): grade semanal + exceções + a
    // projeção de slots que os jovens veem — buscadas sempre, mesmo sem
    // dupla (configurar a oferta é justamente o estado vazio ideal)
    const [grade, excecoes, slots] = await Promise.all([
      getMinhaGrade(),
      getMinhasExcecoes(),
      getSlotsLivres(me!.id),
    ]);
    // sem dupla ainda: cabeçalho + a agenda editável + o estado vazio — a
    // grade de terças DPP não se aplica a ele. No híbrido, a fila usa só as
    // trilhas esp — a DPP tem a própria aba de calendário
    const duplasEsp = duplas.filter((d) => d.trilha === "especialista");
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
          ["dpp", "Ciclo DPP", "/agenda"],
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
