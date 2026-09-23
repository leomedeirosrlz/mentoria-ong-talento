import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMe, getMeuMentorProfile, getMeusDadosPessoais } from "@/lib/queries";
import { avatarPublicUrl, gravatarUrl } from "@/lib/avatar";
import { PerfilForm } from "./perfil-form";

export const metadata: Metadata = {
  title: "Meu perfil",
};

export default async function PerfilPage() {
  const [me, mentorProfile, pessoal] = await Promise.all([
    getMe(),
    getMeuMentorProfile(),
    // os 4 sensíveis da 0034 ficam fora do grant de coluna — nem o próprio
    // usuário os recebe via getMe. A RPC meus_dados_pessoais (0048) é
    // self-scoped e devolve pra qualquer papel, então os inputs sensíveis
    // nascem pré-preenchidos pra todo mundo e a detecção
    // pendente×preenchido do form reflete o cadastro de verdade.
    getMeusDadosPessoais(),
  ]);
  if (!me) redirect("/login");
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
