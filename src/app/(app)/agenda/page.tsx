import type { Metadata } from "next";
import {
  getCicloEventos,
  getCronogramas,
  getDuplas,
  getEspecialistaEventos,
  getMateriais,
  getMe,
} from "@/lib/queries";
import { getMentoresChamada, getPresencas } from "@/lib/queries-presenca";
import {
  cronogramaVigente,
  eventoDaSemana,
  eventosDoCronograma,
  toDateStr,
} from "@/lib/ciclo";
import { AgendaCalendario } from "@/components/agenda-calendario";
import { AgendaEspecialista } from "@/components/agenda-especialista";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  // ?dia=YYYY-MM-DD abre a agenda já no dia (deep-link da ficha/notificações)
  const { dia } = await searchParams;
  const diaInicial = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null;

  // getDuplas vem no escopo do RLS: mentor→a própria, supervisor→supervisionadas, coord→todas
  const [eventos, me, duplas, materiais, cronogramas] = await Promise.all([
    getCicloEventos(),
    getMe(),
    getDuplas(),
    getMateriais(),
    getCronogramas(),
  ]);
  // audiência = mesma regra de /materiais: "todos" pra todo mundo, "dpp" e
  // "especialista" pro papel correspondente, coordenação vê tudo
  const materiaisVisiveis = materiais.filter((m) => {
    if (m.audiencia === "todos") return true;
    if (me?.role === "coordenacao") return true;
    if (m.audiencia === "dpp") return me?.role === "mentor_dpp";
    if (m.audiencia === "especialista") return me?.role === "mentor_especialista";
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
  // mentor cuja única trilha é a especialista não tem calendário de terças —
  // a agenda dele é a fila combinada da própria dupla, não o ciclo DPP.
  // `every` em lista vazia é true de propósito: especialista SEM dupla também
  // cai aqui — o calendário DPP seria um dado alheio pra ele
  const soEspecialista =
    me?.role === "mentor_especialista" &&
    duplas.every((d) => d.trilha === "especialista");

  if (soEspecialista) {
    // sem dupla ainda: só o cabeçalho da trilha + o estado vazio — a grade de
    // terças DPP não se aplica a ele
    if (duplas.length === 0) {
      return (
        <div className="space-y-6">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Mentoria especializada · até 5 encontros de 1h em até 3 meses. As
              datas são combinadas por vocês, sem terça oficial.
            </p>
          </header>
          <div className="rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted-foreground">
              Você ainda não está em nenhuma dupla. Quando a coordenação formar
              uma, os encontros combinados aparecem aqui.
            </p>
          </div>
        </div>
      );
    }
    return <AgendaEspecialista duplas={duplas} espEventos={espEventos} />;
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
          mentores={mentoresChamada}
          presencas={presencasPorEvento}
        />
      )}
    </div>
  );
}
