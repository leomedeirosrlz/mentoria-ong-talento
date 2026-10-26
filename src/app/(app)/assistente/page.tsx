import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { demoRole } from "@/lib/demo/mode";
import { providerConfigurado } from "@/lib/ia/provider";
import { getMe } from "@/lib/queries";
import type { AppRole } from "@/lib/types";
import { AssistenteChat } from "./assistente-chat";

export const metadata = { title: "Assistente" };

export default async function AssistentePage() {
  const [me, demo] = await Promise.all([getMe(), demoRole()]);
  if (!me) redirect("/login");
  // o jovem tem shell próprio — a página dele entra quando o chat abrir
  // praquele papel (o (app) layout já o desvia pra /jovem de qualquer forma)
  if (me.role === "mentorado") redirect("/jovem");

  const papeis: AppRole[] = (
    me.papeis?.length ? me.papeis : me.role ? [me.role] : []
  ) as AppRole[];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <PageHeader
        title="Assistente"
        meta="Pergunte sobre a operação — duplas, encontros e registros — ou sobre o programa."
      />
      <AssistenteChat
        papeis={papeis}
        demo={demo != null}
        configurado={providerConfigurado()}
      />
    </div>
  );
}
