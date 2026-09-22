import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMe, getMeuMentorProfile, getPessoalMap } from "@/lib/queries";
import { avatarPublicUrl, gravatarUrl } from "@/lib/avatar";
import { PerfilForm } from "./perfil-form";

export const metadata: Metadata = {
  title: "Meu perfil",
};

export default async function PerfilPage() {
  const [me, mentorProfile] = await Promise.all([getMe(), getMeuMentorProfile()]);
  if (!me) redirect("/login");
  // os 4 sensíveis da 0034 ficam fora do grant de coluna — nem a própria
  // coordenação os recebe via getMe. Pra ela o form vem pré-preenchido pela
  // view (branco = limpar no action); pros demais papéis os inputs nascem
  // vazios e "em branco" significa "manter o que já está cadastrado".
  const pessoal =
    me.role === "coordenacao"
      ? (await getPessoalMap("profiles_pessoal")).get(me.id)
      : undefined;
  const perfil = pessoal ? { ...me, ...pessoal } : me;
  return (
    <PerfilForm
      me={perfil}
      mentorProfile={mentorProfile}
      avatarUrl={me.avatar_path ? avatarPublicUrl(me.avatar_path) : null}
      gravatarUrl={gravatarUrl(me.email)}
    />
  );
}
