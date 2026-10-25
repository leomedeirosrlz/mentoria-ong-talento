import type { Metadata } from "next";
import { headers } from "next/headers";
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
import { temPapel, type Material } from "@/lib/types";
import { FolderOpen } from "@phosphor-icons/react/dist/ssr";
import { NovoMaterialDialog } from "@/components/novo-material-dialog";
import { PainelJornada } from "@/components/painel-jornada";
import { PageHeader } from "@/components/page-header";
import { MateriaisBiblioteca } from "@/components/materiais-biblioteca";
import {
  MateriaisAbas,
  type AbaMateriais,
  type AbaMaterialItem,
} from "@/components/materiais-abas";
import { InstrumentosPrograma } from "./instrumentos-programa";
import {
  particionarMateriais,
  temConteudo,
  titulosPorNumero,
} from "@/components/materiais-hub";

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
  const { porEncontro, nums, transversais } = particionarMateriais(
    visiveis,
    maxEncontro
  );
  const titulos = titulosPorNumero(eventos);

  // REALIZA-184 — dashboard da biblioteca:
  // · encontroAtual = o vigente do calendário oficial (eventoDaSemana por
  //   cronograma — com duas turmas defasadas fica o MENOR nº: a semana em
  //   que as duas ainda convivem); abre e marca a linha dele no desktop.
  const agora = new Date();
  const cronogramaIds = [...new Set(eventos.map((e) => e.cronograma_id))];
  const numsVigentes = cronogramaIds
    .map(
      (c) => eventoDaSemana(eventosDoCronograma(eventos, c), agora)?.numero
    )
    .filter((n): n is number => n != null);
  const encontroAtual = numsVigentes.length ? Math.min(...numsVigentes) : null;
  // · KPI "último item": a tabela materiais tem created_at e o select("*")
  //   devolve — o tipo Material é que ainda não declara (demora do schema).
  const datasCriacao = (visiveis as (Material & { created_at?: string })[])
    .map((m) => m.created_at)
    .filter((d): d is string => Boolean(d))
    .sort();
  const ultimoIso = datasCriacao.at(-1) ?? null;
  const stats = {
    cobertos: nums.filter((n) =>
      (porEncontro.get(n) ?? []).some(temConteudo)
    ).length,
    teto: nums.length,
    publicados: visiveis.filter(temConteudo).length,
    emBreve: visiveis.length - visiveis.filter(temConteudo).length,
    ultimo: ultimoIso
      ? new Intl.DateTimeFormat("pt-BR", {
          day: "numeric",
          month: "short",
          timeZone: "America/Sao_Paulo",
        }).format(new Date(ultimoIso))
      : null,
  };
  // · default por viewport via UA — heurística de DEFAULT (quem receber
  //   "errado" só desfaz com um toque), não detecção de feature: SSR sai no
  //   estado certo sem flash de collapse pós-hidratação
  const ua = (await headers()).get("user-agent") ?? "";
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

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

  // abas por papel: coord/supervisor abrem na Jornada; mentor e especialista
  // abrem na Biblioteca (o acervo é o que eles mais usam)
  const abas: AbaMaterialItem[] = [
    ...(painel.length > 0 && me
      ? [{ id: "jornada" as const, rotulo: "Jornada" }]
      : []),
    ...(veInstrumentos
      ? [{ id: "instrumentos" as const, rotulo: "Instrumentos" }]
      : []),
    { id: "biblioteca" as const, rotulo: "Biblioteca" },
  ];
  const padrao: AbaMateriais =
    painel.length > 0 && me ? "jornada" : "biblioteca";
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
            ? "Guias, modelos e instrumentos do programa, publicados por encontro"
            : "Guias e instrumentos do programa. A coordenação publica conforme a jornada avança"
        }
        actions={
          ehCoord && visiveis.length > 0 ? (
            <NovoMaterialDialog maxEncontro={maxEncontro} />
          ) : undefined
        }
      />

      <MateriaisAbas abas={abas} ativa={ativa}>
        {ativa === "jornada" && me && painel.length > 0 ? (
          <PainelJornada
            linhas={painel}
            eventos={eventos}
            nudges={nudges}
            duplasInfo={duplasInfo}
            meuNome={me.nome_social || me.nome}
            ehSupervisor={!ehCoord}
          />
        ) : ativa === "instrumentos" && veInstrumentos ? (
          <InstrumentosPrograma
            papel={papelInstrumentos}
            linhas={painel}
            eventos={eventos}
            duplasInfo={duplasInfo}
            formIds={formIds}
            envioLiberado={EMAIL_ENVIO_LIBERADO}
            fichasMentor={fichasMentor}
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
        ) : (
          /* hub por encontro (REALIZA-173) com cara de dashboard (REALIZA-184):
             a trilha de cobertura responde "o que falta" num olhar e ancora no
             <details> do encontro; chips filtram por audiência/tipo sem reload.
             Mentor/especialista veem a mesma estrutura em leitura —
             MaterialActions e NovoMaterialDialog só renderizam pra coord */
          <MateriaisBiblioteca
            stats={stats}
            encontros={nums.map((n) => ({
              n,
              titulo: titulos.get(n),
              itens: porEncontro.get(n) ?? [],
            }))}
            transversais={transversais}
            ehCoord={ehCoord}
            maxEncontro={maxEncontro}
            encontroAtual={encontroAtual}
            mobile={mobile}
            guiaPapel={ehMentorDpp ? "mentor" : vePainel ? "staff" : null}
          />
        )}
      </MateriaisAbas>
    </div>
  );
}
