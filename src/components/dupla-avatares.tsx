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
  sobrePapel = false,
}: {
  mentor: Pessoa;
  mentorado: Pessoa;
  size?: number;
  linkar?: boolean;
  /** os discos vivem em bg-card quase sempre — só o h1 da ficha fica sobre
   *  o papel do fundo, onde o anel precisa casar com --background */
  sobrePapel?: boolean;
}) {
  const anel = sobrePapel ? "ring-2 ring-background" : "ring-2 ring-card";
  const discos = [
    {
      pessoa: mentor,
      el: (
        <Avatar
          nome={mentor.nome}
          src={mentor.avatar_path ? avatarPublicUrl(mentor.avatar_path) : null}
          fallbackSrc={mentor.email ? gravatarUrl(mentor.email) : undefined}
          size={size}
          className={anel}
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
          className={anel}
        />
      ),
    },
  ];
  return (
    <span className="inline-flex shrink-0">
      {discos.map(({ pessoa, el }, i) => {
        // overlap ~30% do disco — proporcional pra leitura de "unidade"
        // ficar igual em qualquer size (classe fixa variava de 20% a 40%)
        const overlap =
          i === 0 ? undefined : { marginInlineStart: -Math.round(size * 0.3) };
        return linkar ? (
          <Link
            key={pessoa.id}
            href={`/pessoas/${pessoa.id}`}
            aria-label={`Abrir perfil de ${pessoa.nome}`}
            style={overlap}
            className="relative rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {el}
          </Link>
        ) : (
          <span key={pessoa.id} style={overlap} className="relative rounded-full">
            {el}
          </span>
        );
      })}
    </span>
  );
}
