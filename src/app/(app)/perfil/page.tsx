import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMe } from "@/lib/queries";
import { avatarPublicUrl, gravatarUrl } from "@/lib/avatar";
import { PerfilForm } from "./perfil-form";

export const metadata: Metadata = {
  title: "Meu perfil",
};

export default async function PerfilPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  return (
    <PerfilForm
      me={me}
      avatarUrl={me.avatar_path ? avatarPublicUrl(me.avatar_path) : null}
      gravatarUrl={gravatarUrl(me.email)}
    />
  );
}
