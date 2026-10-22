import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  EnvelopeSimple,
  MapPin,
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
import { getJovemDuplas, getJovemPessoa } from "@/lib/queries-jovem";
import { getMe } from "@/lib/queries";
import type { JovemContato } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Perfil — Pessoas" };

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
  const [me, pessoa, duplas] = await Promise.all([
    getMe(),
    getJovemPessoa(id),
    getJovemDuplas(),
  ]);
  if (!me || !pessoa) notFound();
  const nomeJovem = me.nome_social || me.nome;

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
    (pessoa.tipo === "colega"
      ? pessoa.colega.interesses
      : pessoa.tipo === "especialista"
        ? pessoa.especialista.areas
        : null) ?? undefined;

  const meta =
    pessoa.tipo === "colega"
      ? [pessoa.colega.cidade, pessoa.colega.uf].filter(Boolean).join(" · ")
      : "";

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
          cidade={pessoa.tipo === "colega" ? pessoa.colega.cidade : null}
          uf={pessoa.tipo === "colega" ? pessoa.colega.uf : null}
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
            <SeloDupla
              contato={pessoa.tipo === "contato" ? pessoa.contato : null}
              duplas={duplas}
            />
            {meta ? (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="shrink-0" aria-hidden />
                {meta}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {pessoa.tipo === "contato" && (
        <SecaoContato c={pessoa.contato} nomeJovem={nomeJovem} />
      )}
      {pessoa.tipo === "colega" && (
        <SecaoColega c={pessoa.colega} nomeJovem={nomeJovem} />
      )}
      {pessoa.tipo === "especialista" && (
        <SecaoEspecialista e={pessoa.especialista} />
      )}
    </div>
  );
}

/** Rótulo do contato no badge — o `papel` da view fala o vínculo com o
 *  jovem ("mentor", "especialista"…), não o cargo técnico da pessoa. */
function rotuloContato(c: JovemContato): string {
  switch (c.papel) {
    case "mentor":
      return "Seu mentor DPP";
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
  contato,
  duplas,
}: {
  contato: JovemContato | null;
  duplas: { id: string | null; status: string | null; trilha: string | null }[];
}) {
  if (!contato?.dupla_id) return null;
  const d = duplas.find((x) => x.id === contato.dupla_id);
  if (!d?.status || d.status === "ativa") return null;
  const base = d.trilha === "especialista" ? "trilha" : "mentoria";
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {`${base} ${d.status}`}
    </Badge>
  );
}

/** Adulto alcançável — os dois canais diretos que a jovem_contatos já
 *  entrega (e-mail e WhatsApp são por default pro adulto). */
function SecaoContato({ c, nomeJovem }: { c: JovemContato; nomeJovem: string }) {
  const nome = c.nome_social || c.nome || "?";
  const wa = waLink(
    c.whatsapp,
    `Olá! Sou ${nomeJovem}, mentorado(a) do programa Realiza.vc.`
  );
  return (
    <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
  const wa = waLink(
    c.whatsapp,
    `Olá! Sou ${nomeJovem}, da sua turma no programa Realiza.vc.`
  );
  return (
    <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
              Ele ainda não compartilhou o contato — quando compartilhar, o
              WhatsApp aparece aqui.
            </p>
          )}
        </div>
      </dl>
    </section>
  );
}

/** Especialista do catálogo — o jovem o conhece pra direcionar o pedido,
 *  mas o canal direto só abre quando a trilha nasce. */
function SecaoEspecialista({
  e,
}: {
  e: { nome: string; areas: string[] | null };
}) {
  return (
    <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Especialista do programa
      </h2>
      <dl className="mt-4 space-y-4">
        <Linha
          rotulo="Áreas"
          valor={e.areas?.length ? <ChipsTags itens={e.areas} /> : "—"}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          O contato direto abre quando a sua trilha de especialista começar
          — até lá, o pedido passa pela coordenação.
        </p>
      </dl>
    </section>
  );
}
