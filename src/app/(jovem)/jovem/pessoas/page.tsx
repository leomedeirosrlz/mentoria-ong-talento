import type { Metadata } from "next";
import Link from "next/link";
import {
  EnvelopeSimple,
  Handshake,
  Users,
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

/** O diretório do jovem (0076) — quem ele pode alcançar: os adultos das
 *  duplas dele (mentor, especialista, supervisor — todas, não só a atual)
 *  + a coordenação, e os colegas de turma com conta. Contato de adulto é
 *  direto por default; o de colega só aparece quando o próprio colega
 *  ligou o compartilhamento — e o do jovem ele controla no Perfil. */
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
  const mentores = porPapel("mentor");
  const especialistas = porPapel("especialista");
  const supervisores = porPapel("supervisor");
  const coordenacao = porPapel("coordenacao");
  const temAdultoDeDupla =
    mentores.length + especialistas.length + supervisores.length > 0;

  /** Etiqueta de estado da dupla do contato — só quando não está ativa. */
  function seloDe(c: JovemContato): string | null {
    const d = c.dupla_id ? porDupla.get(c.dupla_id) : undefined;
    if (!d?.status || d.status === "ativa") return null;
    const base = d.trilha === "especialista" ? "trilha" : "mentoria";
    return `${base} ${d.status}`;
  }

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pessoas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A equipe que caminha com você e os colegas da sua turma.
        </p>
      </header>

      {/* Os adultos — contato direto por default (jovem_contatos): mentor e
          supervisor de CADA dupla, especialistas das trilhas ativas e
          concluídas, e a coordenação */}
      <section aria-labelledby="equipe-titulo">
        <h2
          id="equipe-titulo"
          className="mb-3 flex items-center gap-2 font-semibold"
        >
          <Handshake size={18} className="text-muted-foreground" aria-hidden />
          Quem caminha com você
        </h2>
        <Card className="animate-enter">
          <CardContent>
            <ul className="divide-y divide-border/60">
              {mentores.map((c) => (
                <ContatoLinha
                  key={`mentor-${c.id}`}
                  c={c}
                  papel="Seu mentor"
                  selo={seloDe(c)}
                  nomeJovem={nomeTela}
                />
              ))}
              {especialistas.map((c) => (
                <ContatoLinha
                  key={`esp-${c.id}`}
                  c={c}
                  papel="Seu especialista"
                  selo={seloDe(c)}
                  nomeJovem={nomeTela}
                />
              ))}
              {supervisores.map((c) => (
                <ContatoLinha
                  key={`sup-${c.id}`}
                  c={c}
                  papel="Supervisor(a) da dupla"
                  selo={seloDe(c)}
                  nomeJovem={nomeTela}
                />
              ))}
              {coordenacao.map((c) => (
                <ContatoLinha
                  key={`coord-${c.id}`}
                  c={c}
                  papel="Coordenação do programa"
                  nomeJovem={nomeTela}
                />
              ))}
              {!temAdultoDeDupla && coordenacao.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">
                  A equipe aparece aqui quando a coordenação conectar seu
                  cadastro à plataforma.
                </li>
              )}
            </ul>
            {!temAdultoDeDupla && coordenacao.length > 0 && (
              <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                Quando sua dupla for formada, seu mentor e supervisor
                aparecem aqui — e o especialista, quando você tiver uma
                trilha.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

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

/** Adulto da equipe — avatar + papel (com o estado da dupla quando não é
 *  ativa) + WhatsApp/e-mail diretos. */
function ContatoLinha({
  c,
  papel,
  selo,
  nomeJovem,
}: {
  c: JovemContato;
  papel: string;
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
        <p className="text-xs text-muted-foreground">
          {papel}
          {selo ? ` · ${selo}` : ""}
        </p>
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
