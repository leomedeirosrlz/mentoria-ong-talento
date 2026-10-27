import type { Metadata } from "next";
import Link from "next/link";
import {
  getCicloEventos,
  getDuplas,
  getMateriais,
  getMe,
  getPainelInstrumentosJornada,
} from "@/lib/queries";
import { getFormularios } from "@/lib/forms/queries";
import type { FormularioSistema } from "@/lib/forms/schema";
import { getUltimasInteracoes } from "@/lib/interacoes";
import {
  eventoDaSemana,
  eventosDoCronograma,
  maxNumeroEncontro,
} from "@/lib/ciclo";
import { EMAIL_ENVIO_LIBERADO } from "@/lib/email";
import { turmaLonga } from "@/lib/turma";
import { temPapel } from "@/lib/types";
import { FolderOpen } from "@phosphor-icons/react/dist/ssr";
import { NovoMaterialDialog } from "@/components/novo-material-dialog";
import { PageHeader } from "@/components/page-header";
import { BibliotecaLista } from "@/components/biblioteca-lista";
import {
  MateriaisAbas,
  type AbaMateriais,
  type AbaMaterialItem,
} from "@/components/materiais-abas";
import { InstrumentosPrograma } from "./instrumentos-programa";
import {
  particionarMateriais,
  titulosPorNumero,
} from "@/components/materiais-hub";
import {
  MateriaisMentorBiblioteca,
  type EncontroResumo,
  type TurmaMateriais,
} from "@/components/materiais-mentor-biblioteca";

export const metadata: Metadata = { title: "Materiais" };

export default async function MateriaisPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const { aba: abaParam } = await searchParams;
  const [materiais, me, eventos] = await Promise.all([
    getMateriais(),
    getMe(),
    getCicloEventos(),
  ]);

  // coordenação por papel (não só o primário): o híbrido supervisor+coord
  // vê e faz o que a RLS (has_papel) e a RPC de lote já autorizam
  const ehCoord = temPapel(me, "coordenacao");

  const visiveis = materiais.filter((m) => {
    if (m.audiencia === "todos") return true;
    if (ehCoord) return true;
    if (m.audiencia === "dpp") return temPapel(me, "mentor_dpp");
    if (m.audiencia === "especialista")
      return temPapel(me, "mentor_especialista");
    return false;
  });

  // encontro_num do material é por programa (o guia do 5º vale pras duas
  // turmas) — o teto do hub é o maior nº que existe, não a soma das linhas
  const maxEncontro = maxNumeroEncontro(eventos);
  const { porEncontro, transversais } = particionarMateriais(
    visiveis,
    maxEncontro
  );
  const titulos = titulosPorNumero(eventos);

  // encontroAtual = o vigente do calendário oficial (eventoDaSemana por
  // cronograma — com duas turmas defasadas fica o MENOR nº)
  const agora = new Date();
  const cronogramaIds = [...new Set(eventos.map((e) => e.cronograma_id))];
  const numsVigentes = cronogramaIds
    .map(
      (c) => eventoDaSemana(eventosDoCronograma(eventos, c), agora)?.numero
    )
    .filter((n): n is number => n != null);
  const encontroAtual = numsVigentes.length ? Math.min(...numsVigentes) : null;

  // WP7 — o painel "Progresso da jornada" é staff-only (a RPC valida
  // coord/supervisor; a chamada nem rola fora dos dois papéis). status +
  // whatsapp do mentor vem das duplas — o payload agregado não os carrega
  // e o Lembrar precisa dos dois (pausada não recebe nudge; o wa.me só
  // abre com telefone real). O cap de 48h lê só interações tipo nudge.
  // REALIZA-51 — pra coord os flags "tem e-mail" alimentam a prévia do
  // lote (o endereço em si nunca desce pro client; pro supervisor nem os
  // flags são usados — o botão não renderiza pra ele). REALIZA-194 — a
  // mesma lista de duplas alimenta o rodapé do mentor ("ficha da dupla")
  // da aba Instrumentos.
  const vePainel =
    me != null && (temPapel(me, "coordenacao") || temPapel(me, "supervisor"));
  const ehMentorDpp = me != null && temPapel(me, "mentor_dpp");
  const [painel, duplasPainel] =
    vePainel || ehMentorDpp
      ? await Promise.all([
          vePainel ? getPainelInstrumentosJornada() : Promise.resolve([]),
          getDuplas(),
        ])
      : [[], []];
  const nudges = painel.length
    ? await getUltimasInteracoes(
        painel.map((l) => l.dupla_id),
        "nudge"
      )
    : {};
  const duplasInfo = new Map(
    duplasPainel.map((d) => [
      d.id,
      {
        status: d.status,
        mentorWhatsapp: d.mentor?.whatsapp ?? null,
        jovemWhatsapp: d.mentorado?.whatsapp ?? null,
        jovemTemEmail: !!d.mentorado?.email?.trim(),
        mentorTemEmail: !!d.mentor?.email?.trim(),
      },
    ])
  );

  // REALIZA-194 — "Instrumentos do programa": a régua oficial DPP sai da
  // biblioteca genérica. Coord/supervisor/mentor DPP veem (especialista
  // não — a trilha dele é outra); o mapa sistema→form_id monta o "Ver
  // respostas" da coord (getFormularios é coord-only — nem chama pros
  // outros) e as duplas DPP vivas do mentor viram os deep links de ficha.
  const veInstrumentos =
    me != null &&
    (temPapel(me, "coordenacao") ||
      temPapel(me, "supervisor") ||
      ehMentorDpp);
  const papelInstrumentos = ehCoord
    ? ("coordenacao" as const)
    : vePainel
      ? ("supervisor" as const)
      : ("mentor" as const);
  const formIds = new Map<FormularioSistema, string>();
  if (ehCoord) {
    const forms = await getFormularios().catch((e) => {
      console.error("materiais/getFormularios:", e);
      return [];
    });
    for (const f of forms) {
      if (f.sistema && !formIds.has(f.sistema)) formIds.set(f.sistema, f.id);
    }
  }
  const fichasMentor = ehMentorDpp
    ? duplasPainel
        .filter(
          (d) =>
            d.trilha !== "especialista" &&
            (d.status === "ativa" || d.status === "pausada")
        )
        .map((d) => ({
          id: d.id,
          jovemNome: d.mentorado.nome_social || d.mentorado.nome,
        }))
    : [];

  // biblioteca do mentor/especialista (rodada dores-ux-2026-10): estrutura
  // própria, sem cobertura/filtros/selo de público — o encontro da semana
  // DA TURMA ancora a página. Uma turma por cronograma DPP vivo das duplas
  // DELE (d.mentor, não o escopo do supervisor no híbrido) — com turmas
  // defasadas cada uma tem sua semana. Sem dupla viva (entre ciclos ou
  // ainda sem par), o calendário vigente do programa responde sozinho,
  // sem rótulo de turma. Especialista sem papel DPP não tem cronograma:
  // turmas vazia → a biblioteca vira a lista plana dos materiais dele.
  const ehMentor =
    me != null &&
    !ehCoord &&
    (temPapel(me, "mentor_dpp") || temPapel(me, "mentor_especialista"));
  const turmasMentor: TurmaMateriais[] = [];
  if (ehMentor && ehMentorDpp && me) {
    const cronTurma = new Map<string, string>();
    for (const d of duplasPainel) {
      if (
        d.trilha === "dpp" &&
        d.cronograma_id != null &&
        (d.status === "ativa" || d.status === "pausada") &&
        d.mentor?.id === me.id &&
        !cronTurma.has(d.cronograma_id)
      ) {
        cronTurma.set(d.cronograma_id, d.turma);
      }
    }
    const varias = cronTurma.size > 1;
    for (const [cronId, turma] of [...cronTurma.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], "pt-BR")
    )) {
      const evs = eventosDoCronograma(eventos, cronId);
      turmasMentor.push({
        rotulo: varias ? turmaLonga(turma) : null,
        vigente: eventoDaSemana(evs, agora)?.numero ?? null,
        encontros: evs
          .filter((e) => e.tipo === "encontro" && e.numero != null)
          .map((e) => ({
            numero: e.numero!,
            titulo: e.titulo,
            data: e.data,
          }))
          .sort((a, b) => a.numero - b.numero),
      });
    }
    if (turmasMentor.length === 0) {
      // sem dupla viva: o programa todo é a referência — vigente global e
      // títulos já acordados por número (o titulo divergente entre turmas
      // não desce pro card)
      const porNum = new Map<number, EncontroResumo>();
      for (const e of eventos) {
        if (
          e.tipo === "encontro" &&
          e.numero != null &&
          !porNum.has(e.numero)
        ) {
          porNum.set(e.numero, {
            numero: e.numero,
            titulo: titulos.get(e.numero),
            data: e.data,
          });
        }
      }
      turmasMentor.push({
        rotulo: null,
        vigente: encontroAtual,
        encontros: [...porNum.values()].sort((a, b) => a.numero - b.numero),
      });
    }
  }

  // duas abas: Instrumentos (staff abre aqui — o estado da coorte e a fila
  // de atrasados moram nos cards) e Biblioteca. A antiga aba Jornada saiu:
  // o retrato fino por dupla é da ficha. Mentor e especialista abrem na
  // Biblioteca (o acervo é o que eles mais usam)
  const abas: AbaMaterialItem[] = [
    ...(veInstrumentos
      ? [{ id: "instrumentos" as const, rotulo: "Instrumentos" }]
      : []),
    { id: "biblioteca" as const, rotulo: "Biblioteca" },
  ];
  const padrao: AbaMateriais =
    painel.length > 0 && veInstrumentos ? "instrumentos" : "biblioteca";
  const ativa: AbaMateriais = abas.some((a) => a.id === abaParam)
    ? (abaParam as AbaMateriais)
    : padrao;

  return (
    <div className="space-y-6">
      {/* biblioteca vazia: o CTA mora dentro do card de estado vazio, não
          aqui — por isso o actions some junto com o catálogo */}
      <PageHeader
        title="Materiais"
        meta={
          ehCoord
            ? "Instrumentos da jornada e o acervo do programa"
            : "Guias e instrumentos do programa. A coordenação publica conforme a jornada avança"
        }
        actions={
          ehCoord && visiveis.length > 0 ? (
            <NovoMaterialDialog maxEncontro={maxEncontro} />
          ) : undefined
        }
      />

      <MateriaisAbas abas={abas} ativa={ativa}>
        {ativa === "instrumentos" && veInstrumentos ? (
          <InstrumentosPrograma
            papel={papelInstrumentos}
            linhas={painel}
            eventos={eventos}
            duplasInfo={duplasInfo}
            formIds={formIds}
            envioLiberado={EMAIL_ENVIO_LIBERADO}
            fichasMentor={fichasMentor}
            nudges={nudges}
            meuNome={me?.nome_social || me?.nome || ""}
          />
        ) : visiveis.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <FolderOpen size={18} aria-hidden />
            </span>
            <p className="text-sm font-medium">
              {ehCoord
                ? "Nenhum material publicado ainda"
                : "Nenhum material disponível para o seu perfil"}
            </p>
            <p className="text-sm text-muted-foreground">
              {ehCoord
                ? "Publique o primeiro guia, modelo ou instrumento do programa."
                : "Os guias e instrumentos do programa aparecem aqui quando a coordenação publicar."}
            </p>
            <div className="mt-3">
              {ehCoord ? (
                <NovoMaterialDialog maxEncontro={maxEncontro} />
              ) : (
                <Link
                  href="/agenda"
                  className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2 transition-colors hover:text-muted-foreground sm:min-h-8"
                >
                  Ver a agenda
                </Link>
              )}
            </div>
          </div>
        ) : ehMentor ? (
          /* mentor/especialista: biblioteca própria — a semana da turma
             ancora a página, o resto do ciclo fica recolhido; o especialista
             (sem cronograma) lê a lista plana */
          <MateriaisMentorBiblioteca
            turmas={turmasMentor}
            porEncontro={porEncontro}
            referenciais={
              turmasMentor.length > 0
                ? transversais.flatMap((g) => g.itens)
                : visiveis
            }
          />
        ) : (
          /* staff: a biblioteca inteira agrupada por categoria
             (REALIZA-250) — editar/anexar/excluir no ⋯ de cada linha
             pra coord */
          <BibliotecaLista
            materiais={visiveis}
            ehCoord={ehCoord}
            maxEncontro={maxEncontro}
          />
        )}
      </MateriaisAbas>
    </div>
  );
}
