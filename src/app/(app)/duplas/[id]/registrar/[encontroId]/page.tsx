import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import {
  getCicloEventos,
  getDupla,
  getEspecialistaEventos,
  getMateriais,
  getMe,
} from "@/lib/queries";
import { getEncerramentoDaDupla } from "@/lib/queries-encerramento";
import { encerramentoDecidido } from "@/lib/encerramento";
import {
  eventosDoCronograma,
  formatDate,
  formatDateTime,
  linkSeguro,
  passosDaTrilha,
  semanaBounds,
} from "@/lib/ciclo";
import { guiaDoEncontro } from "@/lib/como-conduzir";
import { hrefMaterial, materiaisDoNumero } from "@/lib/materiais";
import {
  coberturaDaSessao,
  combinadosPendentesDaDupla,
  estadoDaRotaRegistro,
  filaRegistrosPendentes,
} from "@/lib/registro-contexto";
import type { Encontro, Material } from "@/lib/types";
import { turmaLonga } from "@/lib/turma";
import { PageHeader } from "@/components/page-header";
import { VoltarLink } from "@/components/voltar-link";
import { RevelarApos } from "@/components/revelar-apos";
import { RegistroPagina } from "@/components/registro-pagina";
import { buttonVariants } from "@/components/ui/button";
import { DuplaNomes } from "@/components/dupla-nomes";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Título da tarefa — a rota é de criação, nunca de edição (registro já
 *  gravado volta pra ficha). Especialista não tem nº do guia: a sessão é o
 *  assunto, não o passo. */
function tituloDaTarefa(dupla: { trilha: string }, encontro: Encontro) {
  return dupla.trilha === "especialista"
    ? "Registrar sessão de especialista"
    : `Registrar o ${encontro.numero}º encontro`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; encontroId: string }>;
}): Promise<Metadata> {
  const { id, encontroId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(encontroId)) {
    return { title: "Registrar encontro" };
  }
  try {
    // React.cache divide a leitura com a página — sem query dupla
    const dupla = await getDupla(id);
    const encontro = dupla?.encontros.find((e) => e.id === encontroId);
    if (!dupla || !encontro) return { title: "Registrar encontro" };
    const nomes = [
      dupla.mentor.nome_social ?? dupla.mentor.nome,
      dupla.mentorado.nome_social ?? dupla.mentorado.nome,
    ].join(" e ");
    return { title: `${tituloDaTarefa(dupla, encontro)} · ${nomes} · Realiza.vc` };
  } catch {
    // nunca lança: metadado é decoração da aba, não a página
    return { title: "Registrar encontro" };
  }
}

/** Card de saída dos estados bloqueados — nenhum estado é tela morta. */
function EstadoBloqueado({
  id,
  encontro,
  dupla,
  titulo,
  descricao,
  recarregar,
}: {
  id: string;
  encontro: Encontro;
  dupla: {
    trilha: string;
    turma: string;
    mentor: { nome: string; nome_social?: string | null };
    mentorado: { nome: string; nome_social?: string | null };
  };
  titulo: string;
  descricao: string;
  /** Encontro futuro: "Recarregar" aparece quando a hora chega (aba aberta
   *  atravessando o horário, sem exigir refresh manual). */
  recarregar?: boolean;
}) {
  const hrefFicha = `/duplas/${id}?aba=encontros`;
  const nomes = [
    dupla.mentor.nome_social ?? dupla.mentor.nome,
    dupla.mentorado.nome_social ?? dupla.mentorado.nome,
  ].join(" e ");
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        kicker={<VoltarLink fallback={hrefFicha} />}
        title={tituloDaTarefa(dupla, encontro)}
        meta={
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span>{nomes}</span>
            <span aria-hidden>·</span>
            <span>{turmaLonga(dupla.turma)}</span>
            {encontro.data_hora && (
              <>
                <span aria-hidden>·</span>
                <span>{formatDateTime(encontro.data_hora)}</span>
              </>
            )}
          </span>
        }
      />
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={hrefFicha} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Voltar para a dupla
          </Link>
          {recarregar && encontro.data_hora && (
            <RevelarApos from={encontro.data_hora}>
              {/* <a> de propósito: reload completo reavalia a hora no servidor */}
              <a
                href={`/duplas/${id}/registrar/${encontro.id}`}
                className={buttonVariants({ size: "sm" })}
              >
                Recarregar
              </a>
            </RevelarApos>
          )}
        </div>
      </section>
    </div>
  );
}

/** Material de apoio do número — mesma gramática da linha do encontro: doc
 *  nativo navega na mesma aba carregando a ficha no ?dupla=; arquivo/link
 *  externo abre em nova aba. */
function materialHref(m: Material, duplaId: string) {
  const h = hrefMaterial(m);
  return h && m.path?.startsWith("doc:") ? `${h}?dupla=${duplaId}` : h;
}

function diaMesCurto(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export default async function RegistrarEncontroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; encontroId: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { id, encontroId } = await params;
  const { salvo } = await searchParams;
  // link podre não faz round-trip: 404 antes da query (privacidade + custo)
  if (!UUID_RE.test(id) || !UUID_RE.test(encontroId)) notFound();

  const [me, dupla] = await Promise.all([getMe(), getDupla(id)]);
  if (!me) notFound();
  // RLS já escopa: dupla fora do escopo do papel devolve null — id de outra
  // dupla cai no mesmo 404, sem vazar existência
  if (!dupla) notFound();

  const [eventos, encerramento, espEventos] = await Promise.all([
    getCicloEventos(),
    getEncerramentoDaDupla(id),
    // passos da trilha especialista só existem nela — não paga o round-trip
    // no DPP
    dupla.trilha === "especialista" ? getEspecialistaEventos() : null,
  ]);

  const eventosDaDupla = eventosDoCronograma(eventos, dupla.cronograma_id);
  const passos = passosDaTrilha(
    dupla.trilha,
    eventosDaDupla,
    espEventos ?? []
  );
  // mesmo recorte do `podeEditar` da ficha (0102): concluída com rito
  // pendente ainda aceita o registro do último encontro
  const ritoPendente =
    dupla.status === "concluida" &&
    encerramento != null &&
    !encerramentoDecidido(encerramento);

  const agora = new Date();
  const estado = estadoDaRotaRegistro({
    dupla,
    encontroId,
    passos,
    meId: me.id,
    agora,
    ritoPendente,
    recemSalvo: salvo === "1",
  });

  if (estado.tipo === "bloqueado") {
    const enc = estado.encontro ?? dupla.encontros.find((e) => e.id === encontroId);
    switch (estado.motivo) {
      // vazio e id de outra dupla respondem igual — não vaza existência
      case "sem_encontro":
        notFound();
      // coord/sup (e quem não é o mentor) leem na ficha; o destino leva o
      // bloco aberto
      case "nao_e_mentor":
      case "ja_registrado":
        redirect(`/duplas/${id}?aba=encontros#registrar-${encontroId}`);
      case "dupla_inativa": {
        if (!enc) notFound();
        const situacao =
          dupla.status === "pausada"
            ? "pausada"
            : dupla.status === "encerrada"
              ? "encerrada"
              : "concluída";
        return (
          <EstadoBloqueado
            id={id}
            encontro={enc}
            dupla={dupla}
            titulo={`Esta dupla está ${situacao}.`}
            descricao="Não é possível registrar agora."
          />
        );
      }
      case "ainda_nao_aconteceu": {
        if (!enc) notFound();
        return (
          <EstadoBloqueado
            id={id}
            encontro={enc}
            dupla={dupla}
            titulo={
              enc.data_hora
                ? `Marcado para ${formatDateTime(enc.data_hora)}.`
                : "Encontro sem data marcada."
            }
            descricao="O registro abre depois do horário."
            recarregar
          />
        );
      }
    }
  }

  const { encontro, passo } = estado;
  // o catálogo só entra quando há form: estado bloqueado não paga o payload
  const materiais = await getMateriais();
  // nº do guia: DPP é o próprio encontro; especialista é o passo coberto
  // pela tentativa (o material segue o passo, não a tentativa)
  const numero = passo?.numero ?? encontro.numero;
  const guia = dupla.trilha === "especialista" ? null : guiaDoEncontro(numero);
  const nota =
    dupla.notas?.find((n) => n.numero === numero)?.texto ?? null;
  const materiaisDoPasso = materiaisDoNumero({
    materiais,
    eventosDaDupla,
    trilha: dupla.trilha,
    numero,
  });
  const materiaisComDestino = materiaisDoPasso.filter(
    (m) => m.path || linkSeguro(m.url)
  );
  const chamada = linkSeguro(encontro.link);
  // limbo: agendado/remarcado vencido — o chip avisa que o registro é o que
  // falta, sem esperar o mentor deduzir pelo status. `nao_aconteceu` e
  // `cancelado` também abrem o form, mas o fato gravado não é "aconteceu"
  const limbo =
    (encontro.status === "agendado" || encontro.status === "remarcado") &&
    encontro.data_hora != null &&
    new Date(encontro.data_hora) <= agora;
  const semana = passo?.data
    ? semanaBounds(new Date(`${passo.data}T12:00:00`))
    : null;
  const proximos = dupla.trilha === "especialista"
    ? []
    : filaRegistrosPendentes(dupla, {
        excluirEncontroId: encontro.id,
        agora,
      });
  // a sessão pode ter coberto mais de um passo do guia (007 US11) — a
  // mesma régua da ficha, revalidada pelo salvarRegistro
  const cobertura = coberturaDaSessao({ dupla, numero, passos, agora });
  const mentorNome = dupla.mentor.nome_social ?? dupla.mentor.nome;
  const mentoradoNome = dupla.mentorado.nome_social ?? dupla.mentorado.nome;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        kicker={<VoltarLink fallback={`/duplas/${dupla.id}?aba=encontros`} />}
        title={tituloDaTarefa(dupla, encontro)}
        meta={
          <span className="flex flex-wrap items-center gap-x-1.5">
            <DuplaNomes mentor={mentorNome} mentorado={mentoradoNome} />
            <span aria-hidden>·</span>
            <span>{turmaLonga(dupla.turma)}</span>
            {encontro.data_hora && (
              <>
                <span aria-hidden>·</span>
                <span>{formatDateTime(encontro.data_hora)}</span>
              </>
            )}
          </span>
        }
      >
        {limbo && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-2.5 py-1 text-xs font-medium text-[var(--warn-text)]">
            Aconteceu em {formatDate(encontro.data_hora)} · falta o registro
          </p>
        )}
      </PageHeader>

      <section
        aria-labelledby="contexto-encontro"
        className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Encontro
        </p>
        <h2
          id="contexto-encontro"
          className="mt-1 text-base font-semibold text-pretty"
        >
          {passo ? `${passo.numero}º · ${passo.titulo}` : `Encontro ${numero}`}
        </h2>
        <div className="mt-2 space-y-1.5 text-sm">
          {semana && (
            <p className="text-xs text-muted-foreground">
              Semana sugerida {diaMesCurto(semana.seg)} a {diaMesCurto(semana.dom)}
            </p>
          )}
          {guia?.conduzir && (
            <p>
              <span className="font-medium">Como conduzir:</span>{" "}
              <span className="text-muted-foreground">{guia.conduzir}</span>
            </p>
          )}
          {nota && (
            <div className="rounded-lg bg-muted/50 px-3.5 py-3 shadow-[var(--shadow-inset)]">
              <p className="text-xs font-semibold">Plano do encontro</p>
              <p className="mt-1 whitespace-pre-line break-words">{nota}</p>
            </div>
          )}
          {(materiaisComDestino.length > 0 || chamada) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {materiaisComDestino.length === 1 && (
                <a
                  href={materialHref(materiaisComDestino[0], dupla.id)!}
                  {...(materiaisComDestino[0].path?.startsWith("doc:")
                    ? {}
                    : { target: "_blank", rel: "noopener noreferrer" })}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <BookOpen aria-hidden size={16} />
                  Material de apoio
                </a>
              )}
              {chamada && (
                <a
                  href={chamada}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <VideoCamera aria-hidden size={16} />
                  Entrar na chamada
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
            </div>
          )}
          {materiaisComDestino.length > 1 && (
            <div className="mt-1 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">
                Material de apoio
              </p>
              <ul className="space-y-1">
                {materiaisComDestino.map((m) => (
                  <li key={m.id}>
                    <a
                      href={materialHref(m, dupla.id)!}
                      {...(m.path?.startsWith("doc:")
                        ? {}
                        : { target: "_blank", rel: "noopener noreferrer" })}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
                    >
                      <BookOpen aria-hidden size={14} />
                      {m.titulo}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <RegistroPagina
        encontroId={encontro.id}
        duplaId={dupla.id}
        evento={passo}
        trilha={dupla.trilha}
        // `?salvo=1` + registro = re-render do pós-save (ou um refresh no
        // meio dele): o form recebe a row e abre em modo edição em vez de
        // um create vazio que sobrescreveria campos com null no submit
        registro={encontro.registro ?? null}
        combinadosDoRegistro={
          encontro.registro
            ? (dupla.encaminhamentos ?? []).filter(
                (c) => c.registro_id === encontro.registro?.id
              )
            : []
        }
        combinadosPendentes={combinadosPendentesDaDupla(dupla)}
        proximosRegistros={proximos}
        cobertura={cobertura}
        // telemetria (REALIZA-217): encontro "externo" nasceu no fluxo
        // retroativo — a sessão do form é catch-up, não novo
        origem={encontro.origem === "externo" ? "retroativo" : "novo"}
      />
    </div>
  );
}
