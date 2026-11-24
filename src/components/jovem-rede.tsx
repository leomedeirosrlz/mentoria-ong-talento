import Link from "next/link";
import { EnvelopeSimple, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { avatarPublicUrl } from "@/lib/avatar";
import { waLink } from "@/lib/ciclo";
import { msgApresentacaoJovem } from "@/lib/whatsapp-msgs";
import type { ColegaTurma, JovemContato } from "@/lib/types";
import { cn } from "@/lib/utils";

// As linhas da rede do jovem — componente compartilhado entre a página
// /jovem/pessoas e a seção "Sua rede" do /jovem/perfil (spec 023): a
// mesma pessoa, o mesmo canal, os dois lugares. Server-safe (Phosphor
// dist/ssr), pra render em qualquer pai.

/** Adulto da rede — avatar + nome (com vínculo e o estado da dupla quando
 *  não é ativa) + WhatsApp/e-mail diretos. */
export function ContatoLinha({
  c,
  selo,
  vinculo,
  nomeJovem,
}: {
  c: JovemContato;
  /** "trilha concluída", "mentoria pausada"… — null quando a dupla vive */
  selo?: string | null;
  /** "Seu mentor", "Auxiliar executivo da sua dupla"… — o vínculo na voz
   *  do jovem; quando a linha mora num grupo por papel, o grupo já diz. */
  vinculo?: string | null;
  nomeJovem: string;
}) {
  const nome = c.nome_social || c.nome || "?";
  const wa = waLink(c.whatsapp, msgApresentacaoJovem(nomeJovem));
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Link
        href={`/jovem/pessoas/${c.id}`}
        prefetch={false}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar
          nome={nome}
          src={c.avatar_path ? avatarPublicUrl(c.avatar_path) : null}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{nome}</p>
          {(vinculo || selo) && (
            <p className="truncate text-xs text-muted-foreground">
              {[vinculo, selo].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </Link>
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

/** Colega de turma — foto quando o cadastro tem (a mesma decisão do
 *  diretório: jovem com conta aparece com imagem); cidade/UF e
 *  interesses pra ter ideia de quem é; WhatsApp só quando o colega
 *  compartilhou. */
export function ColegaLinha({
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
      <Link
        href={`/jovem/pessoas/${c.id}`}
        prefetch={false}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar
          nome={nome}
          papel="mentorado"
          src={c.avatar_path ? avatarPublicUrl(c.avatar_path) : null}
          size={40}
        />
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
      </Link>
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
