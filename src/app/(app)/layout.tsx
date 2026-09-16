import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getMe } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");

  if (!me.role) {
    return (
      <div className="min-h-[100dvh] grid place-items-center px-4">
        <div className="max-w-sm rounded-xl border bg-card p-6 text-center">
          <p className="font-medium">Cadastro recebido</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Seu acesso foi criado, mas a coordenacao ainda nao definiu o seu papel
            no programa. Assim que liberar, entre de novo por aqui.
          </p>
          <a href="/login" className="mt-4 inline-block text-sm underline text-muted-foreground">
            Voltar ao login
          </a>
        </div>
      </div>
    );
  }

  return <AppShell me={me}>{children}</AppShell>;
}
