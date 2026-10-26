import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getMe, getMeuMentorProfile, getMeusDadosPessoais } from "@/lib/queries";
import { getMinhaAssinaturaTermo } from "@/lib/queries-assinaturas";
import { getMinhaGrade, getMinhasExcecoes } from "@/lib/queries-especialista";
import { avatarPublicUrl, gravatarUrl } from "@/lib/avatar";
import { temPapel } from "@/lib/types";
import { TEMA_COOKIE, temaValido } from "@/lib/tema";
import { EspecialistaHorarios } from "@/components/especialista-horarios";
import { PerfilForm } from "./perfil-form";

export const metadata: Metadata = {
  title: "Meu perfil",
};

export default async function PerfilPage() {
  const [me, mentorProfile, pessoal, assinaturaTermo] = await Promise.all([
    getMe(),
    getMeuMentorProfile(),
    // os 4 sensíveis da 0034 ficam fora do grant de coluna — nem o próprio
    // usuário os recebe via getMe. A RPC meus_dados_pessoais (0048) é
    // self-scoped e devolve pra qualquer papel, então os inputs sensíveis
    // nascem pré-preenchidos pra todo mundo e a detecção
    // pendente×preenchido do form reflete o cadastro de verdade.
    getMeusDadosPessoais(),
    getMinhaAssinaturaTermo(),
  ]);
  if (!me) redirect("/login");
  // a agenda do especialista (grade semanal + exceções) edita no perfil
  // (REALIZA-207) — só se busca pra quem tem o papel, híbrido incluso
  const souEspecialista = temPapel(me, "mentor_especialista");
  const [grade, excecoes] = souEspecialista
    ? await Promise.all([getMinhaGrade(), getMinhasExcecoes()])
    : [[], []];
  const perfil = pessoal ? { ...me, ...pessoal } : me;
  // o toggle nasce marcado com a preferência do cookie — sem flash de
  // "Sistema" esperando a hidratação
  const tema = temaValido((await cookies()).get(TEMA_COOKIE)?.value);
  return (
    <PerfilForm
      me={perfil}
      tema={tema}
      mentorProfile={mentorProfile}
      avatarUrl={me.avatar_path ? avatarPublicUrl(me.avatar_path) : null}
      gravatarUrl={gravatarUrl(me.email)}
      assinaturaTermo={assinaturaTermo}
      horarios={
        souEspecialista ? (
          <EspecialistaHorarios grade={grade} excecoes={excecoes} />
        ) : undefined
      }
    />
  );
}
