import { redirect } from "next/navigation";
import { getMe, getMentorados, getPessoas } from "@/lib/queries";
import { papelLabel } from "@/components/app-shell";
import { NovaPessoaDialog, NovoMentoradoDialog } from "@/components/pessoas-dialogs";
import { RoleSelect } from "@/components/role-select";
import { Badge } from "@/components/ui/badge";

export default async function PessoasPage() {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  const [pessoas, mentorados] = await Promise.all([getPessoas(), getMentorados()]);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pessoas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mentores, supervisores e equipe com acesso a plataforma
          </p>
        </div>
        <div className="flex gap-2">
          <NovoMentoradoDialog />
          <NovaPessoaDialog />
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Com acesso ({pessoas.length})
        </h2>
        <div className="rounded-xl border bg-card divide-y divide-border overflow-hidden">
          {pessoas.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{p.nome}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </div>
              {!p.user_id && (
                <Badge variant="outline" className="text-xs shrink-0">ainda nao entrou</Badge>
              )}
              <div className="w-52 shrink-0">
                <RoleSelect profileId={p.id} role={p.role} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Mentorados ({mentorados.length})
        </h2>
        <div className="rounded-xl border bg-card divide-y divide-border overflow-hidden">
          {mentorados.map((m) => (
            <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {m.ong_origem ?? "origem nao informada"}
                  {m.whatsapp ? ` · ${m.whatsapp}` : ""}
                </p>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">jovem realizador</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
