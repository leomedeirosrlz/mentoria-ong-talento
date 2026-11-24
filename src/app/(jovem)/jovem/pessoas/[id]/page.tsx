import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  EnvelopeSimple,
  MapPin,
  Sparkle,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PessoaBanner, type PapelBanner } from "@/components/pessoa-banner";
import { Linha } from "@/app/(app)/perfil/perfil-form";
import { ChipsTags } from "@/app/(app)/perfil/perfil-form";
import { avatarPublicUrl } from "@/lib/avatar";
import { papelLabel, waLink } from "@/lib/ciclo";
import { msgApresentacaoJovem } from "@/lib/whatsapp-msgs";
import { turmaLonga } from "@/lib/turma";
import {
  getJovemDuplas,
  getJovemEspecialistas,
  getJovemPessoa,
} from "@/lib/queries-jovem";
import { getMe } from "@/lib/queries";
import type { JovemContato, JovemEspecialista } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Perfil · Pessoas" };

/** O perfil de quem o jovem enxerga — mesmo cartão-banner do perfil de
 *  todo mundo, dados SÓ das projeções seguras (jovem_contatos /
 *  mentorados_turma / jovem_especialistas). id fora dessas fontes cai no
 *  mesmo 404 de quem não existe. */
export default async function JovemPessoaPerfil({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [me, pessoa, duplas, catalogo] = await Promise.all([
    getMe(),
    getJovemPessoa(id),
    getJovemDuplas(),
    getJovemEspecialistas(),
  ]);
  if (!me || !pessoa) notFound();
  const nomeJovem = me.nome_social || me.nome;

  /** A projeção pública do especialista, quando a pessoa é uma — vem da
   *  mesma view do catálogo (jovem_especialistas), nunca de profiles.
   *  No contato de trilha o registro casa pelo mesmo profile_id. */
  const esp: JovemEspecialista | null =
    pessoa.tipo === "especialista"
      ? pessoa.especialista
      : pessoa.tipo === "contato" && pessoa.contato.papel === "especialista"
        ? (catalogo.find((e) => e.id === pessoa.contato.id) ?? null)
        : null;

  /** A dupla que amarra o contato — origem do vínculo (trilha, turma,
   *  a demanda que abriu a trilha de especialista). */
  const dupla =
    pessoa.tipo === "contato" && pessoa.contato.dupla_id
      ? (duplas.find((d) => d.id === pessoa.contato.dupla_id) ?? null)
      : null;

  // a turma só é nomeável pro colega quando o jovem tem uma — com duas
  // turmas (ex.: DPP numa, trilha noutra) a origem segue "da turma" genérica
  const turmaColega =
    pessoa.tipo === "colega" &&
    new Set(duplas.map((d) => d.turma).filter(Boolean)).size === 1
      ? duplas.find((d) => d.turma)?.turma
      : null;

  const nome =
    pessoa.tipo === "contato"
      ? pessoa.contato.nome_social || pessoa.contato.nome || "?"
      : pessoa.tipo === "colega"
        ? pessoa.colega.nome_social || pessoa.colega.nome || "?"
        : pessoa.especialista.nome_social || pessoa.especialista.nome;

  const papel: PapelBanner =
    pessoa.tipo === "colega"
      ? "mentorado"
      : pessoa.tipo === "contato"
        ? (pessoa.contato.role ?? null)
        : "mentor_especialista";

  const areas =
    (pessoa.tipo === "colega" ? pessoa.colega.interesses : esp?.areas) ??
    undefined;

  const lugar =
    pessoa.tipo === "colega"
      ? [pessoa.colega.cidade, pessoa.colega.uf].filter(Boolean).join(" · ")
      : [esp?.cidade, esp?.uf].filter(Boolean).join(" · ");

  const turmaMeta =
    dupla?.turma != null
      ? turmaLonga(dupla.turma)
      : turmaColega != null
        ? turmaLonga(turmaColega)
        : null;

  // foto só pra adulto (contato/catálogo) — colega menor fica nas
  // iniciais amarelas, a mesma decisão do diretório e do próprio perfil
  const avatarSrc =
    pessoa.tipo === "contato"
      ? pessoa.contato.avatar_path && avatarPublicUrl(pessoa.contato.avatar_path)
      : pessoa.tipo === "especialista"
        ? pessoa.especialista.avatar_path &&
          avatarPublicUrl(pessoa.especialista.avatar_path)
        : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/jovem/pessoas"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={15} aria-hidden />
        Pessoas
      </Link>

      <header className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <PessoaBanner
          papel={papel}
          nome={nome}
          cidade={
            pessoa.tipo === "colega" ? pessoa.colega.cidade : (esp?.cidade ?? null)
          }
          uf={pessoa.tipo === "colega" ? pessoa.colega.uf : (esp?.uf ?? null)}
          areas={areas}
          seed={id}
        />
        <div className="px-4 pb-5 sm:px-6 sm:pb-6">
          <div className="flex items-end justify-between gap-3">
            <div className="relative z-10 -mt-10 shrink-0 sm:-mt-12">
              <Avatar
                nome={nome}
                papel={pessoa.tipo === "colega" ? "mentorado" : undefined}
                src={avatarSrc}
                size={80}
                className="size-20! ring-4 ring-card outline outline-1 outline-[var(--brand-ink)]/15 sm:size-24!"
              />
            </div>
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
            {nome}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1.5 font-normal">
              {pessoa.tipo === "contato"
                ? rotuloContato(pessoa.contato)
                : pessoa.tipo === "colega"
                  ? "Colega da turma"
                  : "Mentor especialista"}
            </Badge>
            <SeloDupla dupla={dupla} />
            {turmaMeta && <span>{turmaMeta}</span>}
            {lugar ? (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="shrink-0" aria-hidden />
                {lugar}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* A projeção pública do especialista — bio/áreas/experiência/janela,
          quando a pessoa é uma (trilha dele ou catálogo). Sem bio, o bloco
          some com a linha — nunca um card de "—" atrás de "—". */}
      {esp && (
        <SecaoEspecialista
          e={esp}
          daPropriaTrilha={pessoa.tipo === "contato"}
          demandaTrilha={
            dupla?.trilha === "especialista" ? (dupla.demanda ?? null) : null
          }
        />
      )}
      {pessoa.tipo === "contato" && (
        <SecaoContato c={pessoa.contato} nomeJovem={nomeJovem} />
      )}
      {pessoa.tipo === "colega" && (
        <SecaoColega c={pessoa.colega} nomeJovem={nomeJovem} />
      )}
    </div>
  );
}

/** Rótulo do contato no badge — o `papel` da view fala o vínculo com o
 *  jovem ("mentor", "especialista"…), não o cargo técnico da pessoa. */
function rotuloContato(c: JovemContato): string {
  switch (c.papel) {
    case "mentor":
      return "Seu mentor";
    case "especialista":
      return "Seu especialista";
    case "supervisor":
      return "Auxiliar executivo da sua dupla";
    case "coordenacao":
      return papelLabel("coordenacao");
    default:
      return papelLabel(c.role);
  }
}

/** Etiqueta honesta de dupla que não está mais em curso — o mesmo selo
 *  da linha do diretório ("trilha concluída", "mentoria pausada"). */
function SeloDupla({
  dupla,
}: {
  dupla: { status: string | null; trilha: string | null } | null;
}) {
  if (!dupla?.status || dupla.status === "ativa") return null;
  const base = dupla.trilha === "especialista" ? "trilha" : "mentoria";
  const status =
    { pausada: "pausada", concluida: "concluída", encerrada: "encerrada" }[
      dupla.status
    ] ?? dupla.status;
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {`${base} ${status}`}
    </Badge>
  );
}

/** Adulto alcançável — os dois canais diretos que a jovem_contatos já
 *  entrega (e-mail e WhatsApp são por default pro adulto). */
function SecaoContato({ c, nomeJovem }: { c: JovemContato; nomeJovem: string }) {
  const nome = c.nome_social || c.nome || "?";
  const wa = waLink(c.whatsapp, msgApresentacaoJovem(nomeJovem));
  return (
    <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
      <h2 className="text-base font-semibold">
        Contato
      </h2>
      <dl className="mt-4 space-y-4">
        <Linha rotulo="Nome" valor={c.nome?.trim() || "—"} />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {c.email ? (
            <a
              href={`mailto:${c.email}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5"
              )}
            >
              <EnvelopeSimple size={15} aria-hidden />
              {c.email}
            </a>
          ) : null}
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5"
              )}
              aria-label={`Conversar com ${nome} no WhatsApp (abre em nova aba)`}
            >
              <WhatsappLogo size={15} aria-hidden />
              WhatsApp
            </a>
          ) : null}
        </div>
      </dl>
    </section>
  );
}

/** Colega da turma — a mesma projeção do diretório (cidade/UF/interesses)
 *  e o WhatsApp só quando ele compartilhou. */
function SecaoColega({
  c,
  nomeJovem,
}: {
  c: {
    nome: string | null;
    nome_social: string | null;
    cidade: string | null;
    uf: string | null;
    interesses: string[] | null;
    whatsapp: string | null;
  };
  nomeJovem: string;
}) {
  const wa = waLink(c.whatsapp, msgApresentacaoJovem(nomeJovem, true));
  return (
    <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
      <h2 className="text-base font-semibold">
        Colega da sua turma
      </h2>
      <dl className="mt-4 space-y-4">
        <Linha rotulo="Cidade" valor={c.cidade?.trim() || "—"} />
        <Linha rotulo="UF" valor={c.uf?.trim() || "—"} />
        <Linha
          rotulo="Interesses"
          valor={c.interesses?.length ? <ChipsTags itens={c.interesses} /> : "—"}
        />
        <div className="pt-1">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5"
              )}
              aria-label="Conversar no WhatsApp (abre em nova aba)"
            >
              <WhatsappLogo size={15} aria-hidden />
              WhatsApp
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ainda não compartilhou o contato. Quando compartilhar, o
              WhatsApp aparece aqui.
            </p>
          )}
        </div>
      </dl>
    </section>
  );
}

/** A projeção pública do especialista — o recorte que a view
 *  `jovem_especialistas` já libera pro jovem (bio, atuação, áreas,
 *  experiência, formação, voluntariado e a janela em "dia + período",
 *  nunca slot exato). Dois contextos: `daPropriaTrilha` quando a pessoa é
 *  o especialista de uma dupla dele (aí o canal direto mora no card de
 *  Contato ao lado); sem trilha é catálogo — a ficha aponta pra página
 *  onde o pedido acontece. */
function SecaoEspecialista({
  e,
  daPropriaTrilha,
  demandaTrilha,
}: {
  e: JovemEspecialista;
  daPropriaTrilha: boolean;
  /** `duplas.demanda` da trilha dela com o jovem — o motivo pelo qual a
   *  dupla existe, do mesmo recorte que a agenda já mostra. */
  demandaTrilha: string | null;
}) {
  const atuacao = [e.cargo, e.empresa].filter(Boolean).join(" · ");
  return (
    <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
      <h2 className="text-base font-semibold">
        {daPropriaTrilha ? "Sobre" : "Especialista do programa"}
      </h2>
      {e.bio && <p className="mt-3 text-sm leading-relaxed">{e.bio}</p>}
      <dl className="mt-4 space-y-4">
        {demandaTrilha && <Linha rotulo="Sua trilha" valor={demandaTrilha} />}
        {atuacao && <Linha rotulo="Atuação" valor={atuacao} />}
        {e.areas?.length ? (
          <Linha rotulo="Áreas" valor={<ChipsTags itens={e.areas} />} />
        ) : null}
        {e.experiencia_previa && (
          <Linha rotulo="Experiência" valor={e.experiencia_previa} />
        )}
        {e.formacao_externa && (
          <Linha rotulo="Formação" valor={e.formacao_externa} />
        )}
        {e.voluntariado && (
          <Linha rotulo="Voluntariado" valor={e.voluntariado} />
        )}
        {e.grade_resumo?.length ? (
          <Linha rotulo="Atende" valor={e.grade_resumo.join(" · ")} />
        ) : null}
      </dl>
      {!daPropriaTrilha && (
        <>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            O contato direto abre quando a sua trilha de especialista
            começar.
          </p>
          <Link
            href="/jovem/especialistas"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-3 gap-1.5"
            )}
          >
            <Sparkle size={15} aria-hidden />
            Ver no catálogo de especialistas
          </Link>
        </>
      )}
    </section>
  );
}
