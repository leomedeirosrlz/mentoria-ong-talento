import type { Metadata } from "next";
import Link from "next/link";
import {
  EnvelopeSimple,
  Handshake,
  Sparkle,
  UserCheck,
  Users,
  UsersFour,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { avatarPublicUrl } from "@/lib/avatar";
import { waLink } from "@/lib/ciclo";
import {
  getJovemColegas,
  getJovemContatos,
  getJovemDuplas,
} from "@/lib/queries-jovem";
import { getMe } from "@/lib/queries";
import type { ColegaTurma, JovemContato, JovemDupla } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pessoas" };

/** O diretório do jovem (0076), agrupado por cargo: mentoria, especialistas,
 *  supervisão e coordenação vêm da `jovem_contatos` (adultos das duplas
 *  dele — contato direto por default); os colegas da turma vêm da
 *  `mentorados_turma` (só quem tem conta; WhatsApp só com opt-in do
 *  próprio colega — o do jovem ele controla no Perfil). */
export default async function JovemPessoas() {
  const [me, contatos, colegas, duplas] = await Promise.all([
    getMe(),
    getJovemContatos(),
    getJovemColegas(),
    getJovemDuplas(),
  ]);
  if (!me) return null; // o layout já barra — convenção das páginas
  const nomeTela = me.nome_social || me.nome;

  // status/trilha por dupla — a etiqueta "trilha concluída / mentoria
  // pausada" marca contato de dupla que não está mais em curso
  const porDupla = new Map(
    duplas.map((d) => [d.id, { status: d.status, trilha: d.trilha }])
  );
  // "vida" da dupla — o vínculo ainda em curso vence na dedupe abaixo
  const pesoStatus = (status: JovemDupla["status"] | undefined): number =>
    status === "ativa" ? 0
    : status === "pausada" ? 1
    : status === "concluida" ? 2
    : status === "encerrada" ? 3
    : 0;

  /** A view repete a pessoa por dupla (mentor de duas trilhas, supervisor
   *  de três) — a linha é uma por papel, marcando a dupla mais viva. */
  function agrupaPorPessoa(lista: JovemContato[]): JovemContato[] {
    const mapa = new Map<string, JovemContato>();
    for (const c of lista) {
      const chave = `${c.id}:${c.papel}`;
      const atual = mapa.get(chave);
      const pesoNovo = pesoStatus(
        c.dupla_id ? porDupla.get(c.dupla_id)?.status : null
      );
      const pesoAtual = pesoStatus(
        atual?.dupla_id ? porDupla.get(atual.dupla_id)?.status : null
      );
      if (!atual || pesoNovo < pesoAtual) mapa.set(chave, c);
    }
    return [...mapa.values()];
  }

  const porPapel = (papel: string): JovemContato[] =>
    agrupaPorPessoa(contatos.filter((c) => c.papel === papel));

  /** Etiqueta de estado da dupla do contato — só quando não está ativa. */
  function seloDe(c: JovemContato): string | null {
    const d = c.dupla_id ? porDupla.get(c.dupla_id) : undefined;
    if (!d?.status || d.status === "ativa") return null;
    const base = d.trilha === "especialista" ? "trilha" : "mentoria";
    return `${base} ${d.status}`;
  }

  const grupos: {
    id: string;
    titulo: string;
    icon: typeof Handshake;
    itens: JovemContato[];
    vazio: string;
  }[] = [
    {
      id: "mentoria",
      titulo: "Mentoria",
      icon: Handshake,
      itens: porPapel("mentor"),
      vazio: "Quando a sua dupla for formada, o seu mentor aparece aqui.",
    },
    {
      id: "especialistas",
      titulo: "Especialistas",
      icon: Sparkle,
      itens: porPapel("especialista"),
      vazio:
        "O especialista da sua trilha aparece aqui quando ela começar.",
    },
    {
      id: "supervisao",
      titulo: "Supervisão",
      icon: UserCheck,
      itens: porPapel("supervisor"),
      vazio: "O supervisor da sua dupla aparece aqui.",
    },
    {
      id: "coordenacao",
      titulo: "Coordenação",
      icon: UsersFour,
      itens: porPapel("coordenacao"),
      vazio: "A equipe da coordenação aparece aqui.",
    },
  ];

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pessoas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mentoria, especialistas, coordenação e os colegas da sua turma.
        </p>
      </header>

      {/* Os adultos, um grupo por cargo — contato direto por default
          (jovem_contatos): mentor e supervisor de CADA dupla,
          especialistas das trilhas e a coordenação */}
      {grupos.map((g) => (
        <section key={g.id} aria-labelledby={`${g.id}-titulo`}>
          <h2
            id={`${g.id}-titulo`}
            className="mb-3 flex items-center gap-2 font-semibold"
          >
            <g.icon
              size={18}
              className="text-muted-foreground"
              aria-hidden
            />
            {g.titulo}
          </h2>
          <Card className="animate-enter">
            <CardContent>
              {g.itens.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  {g.vazio}
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {g.itens.map((c) => (
                    <ContatoLinha
                      key={`${g.id}-${c.id}`}
                      c={c}
                      selo={seloDe(c)}
                      nomeJovem={nomeTela}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      ))}

      {/* Colegas de turma — a view mentorados_turma: só quem tem conta e
          divide turma de dupla; o WhatsApp chega null pra quem não ligou
          o compartilhamento, então o CTA nunca abre quebrado */}
      <section aria-labelledby="colegas-titulo">
        <h2
          id="colegas-titulo"
          className="mb-3 flex items-center gap-2 font-semibold"
        >
          <Users size={18} className="text-muted-foreground" aria-hidden />
          Colegas da turma
        </h2>
        <Card className="animate-enter">
          <CardContent>
            {colegas.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Quando colegas da sua turma entrarem na plataforma, eles
                aparecem aqui.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {colegas.map((c) => (
                  <ColegaLinha key={c.id} c={c} nomeJovem={nomeTela} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Um colega só aparece aqui quando tem conta na plataforma, e o
          WhatsApp dele só aparece se ele escolher compartilhar. O seu você
          controla em{" "}
          <Link
            href="/jovem/perfil"
            className="font-medium underline underline-offset-2"
          >
            Perfil
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

/** Adulto do diretório — avatar + nome (com o estado da dupla quando não
 *  é ativa) + WhatsApp/e-mail diretos. O cargo é a seção onde a linha
 *  mora — não repete em cada linha. */
function ContatoLinha({
  c,
  selo,
  nomeJovem,
}: {
  c: JovemContato;
  /** "trilha concluída", "mentoria pausada"… — null quando a dupla vive */
  selo?: string | null;
  nomeJovem: string;
}) {
  const nome = c.nome_social || c.nome || "?";
  const wa = waLink(
    c.whatsapp,
    `Olá! Sou ${nomeJovem}, mentorado(a) do programa Realiza.vc.`
  );
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Avatar
        nome={nome}
        src={c.avatar_path ? avatarPublicUrl(c.avatar_path) : null}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{nome}</p>
        {selo && <p className="text-xs text-muted-foreground">{selo}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {c.email && (
          <a
            href={`mailto:${c.email}`}
            aria-label={`Enviar e-mail para ${nome}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "px-2.5"
            )}
          >
            <EnvelopeSimple size={15} aria-hidden />
            <span className="sr-only sm:not-sr-only sm:inline">E-mail</span>
          </a>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Conversar com ${nome} no WhatsApp`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <WhatsappLogo size={15} aria-hidden />
            <span className="sr-only sm:not-sr-only sm:inline">WhatsApp</span>
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        )}
      </div>
    </li>
  );
}

/** Colega de turma — iniciais, não foto (menor sem cláusula de imagem, a
 *  mesma decisão do avatar do próprio jovem); cidade/UF e interesses pra
 *  ter ideia de quem é; WhatsApp só quando o colega compartilhou. */
function ColegaLinha({
  c,
  nomeJovem,
}: {
  c: ColegaTurma;
  nomeJovem: string;
}) {
  const nome = c.nome_social || c.nome || "?";
  const local = [c.cidade, c.uf].filter(Boolean).join(" · ");
  const interesses = c.interesses ?? [];
  const wa = waLink(
    c.whatsapp,
    `Olá! Sou ${nomeJovem}, da sua turma no programa Realiza.vc.`
  );
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Avatar nome={nome} papel="mentorado" size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{nome}</p>
        {local && (
          <p className="truncate text-xs text-muted-foreground">{local}</p>
        )}
        {interesses.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {interesses.slice(0, 4).map((i) => (
              <Badge
                key={i}
                variant="outline"
                className="bg-muted font-normal text-muted-foreground"
              >
                {i}
              </Badge>
            ))}
            {interesses.length > 4 && (
              <span className="self-center text-[11px] text-muted-foreground">
                +{interesses.length - 4}
              </span>
            )}
          </span>
        )}
      </div>
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Conversar com ${nome} no WhatsApp`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0"
          )}
        >
          <WhatsappLogo size={15} aria-hidden />
          <span className="sr-only sm:not-sr-only sm:inline">WhatsApp</span>
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">
          não compartilhou o contato
        </span>
      )}
    </li>
  );
}
