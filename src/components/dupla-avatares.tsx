import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { avatarPublicUrl, gravatarUrl } from "@/lib/avatar";

type Pessoa = {
  id: string;
  nome: string;
  avatar_path?: string | null;
  email?: string | null;
};

/** Os dois discos sobrepostos que representam a dupla como unidade visual
 *  (mentor em lime à frente, mentorado em amarelo atrás). Com `linkar`, cada
 *  avatar abre o perfil da pessoa; sem, é só o símbolo decorativo. */
export function DuplaAvatares({
  mentor,
  mentorado,
  size = 32,
  linkar = false,
}: {
  mentor: Pessoa;
  mentorado: Pessoa;
  size?: number;
  linkar?: boolean;
}) {
  const discos = [
    {
      pessoa: mentor,
      el: (
        <Avatar
          nome={mentor.nome}
          src={mentor.avatar_path ? avatarPublicUrl(mentor.avatar_path) : null}
          fallbackSrc={mentor.email ? gravatarUrl(mentor.email) : undefined}
          size={size}
          className="ring-2 ring-background"
        />
      ),
    },
    {
      pessoa: mentorado,
      el: (
        <Avatar
          papel="mentorado"
          nome={mentorado.nome}
          src={mentorado.avatar_path ? avatarPublicUrl(mentorado.avatar_path) : null}
          size={size}
          className="ring-2 ring-background"
        />
      ),
    },
  ];
  return (
    <span className="inline-flex shrink-0 -space-x-2.5">
      {discos.map(({ pessoa, el }) =>
        linkar ? (
          <Link
            key={pessoa.id}
            href={`/pessoas/${pessoa.id}`}
            aria-label={`Abrir perfil de ${pessoa.nome}`}
            className="relative rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {el}
          </Link>
        ) : (
          <span key={pessoa.id} className="relative rounded-full">
            {el}
          </span>
        )
      )}
    </span>
  );
}
