import Link from "next/link";
import { EnvelopeSimple, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/avatar";
import { buttonVariants } from "@/components/ui/button";
import { avatarPublicUrl } from "@/lib/avatar";
import { waLink } from "@/lib/ciclo";
import { msgApresentacaoJovem } from "@/lib/whatsapp-msgs";
import type { JovemContato } from "@/lib/types";
import { cn } from "@/lib/utils";

// As linhas da rede do jovem — a seção "Sua rede" do /jovem/perfil
// (spec 023). Colega de turma não entra: REALIZA-525 tirou a turma da
// seção (ela mora na faceta "Colegas" do diretório), então a linha de
// colega foi junto — o avatar+cidade+opt-in voltariam com ela.

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
