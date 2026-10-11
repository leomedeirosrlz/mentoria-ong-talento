"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { updateMeuPerfil } from "@/lib/actions";
import { maskWhatsApp } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoInteresses, CampoUf } from "@/components/campos-pessoais";
import type { Profile } from "@/lib/types";

/** Form do jovem — subconjunto honesto do /perfil de staff: nome de uso,
 *  WhatsApp, cidade/UF e interesses (profiles é o canônico de contato —
 *  plano D1). updateMeuPerfil é patch parcial: só estas chaves vão; e-mail,
 *  papel e os dados civis nem são renderizados. */
export function JovemPerfilForm({ me }: { me: Profile }) {
  const [pending, start] = useTransition();
  const [whatsapp, setWhatsapp] = useState(me.whatsapp ?? "");
  const [interesses, setInteresses] = useState<string[]>(me.interesses ?? []);
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await updateMeuPerfil(fd);
        if (res?.error) toast.error(res.error);
        else {
          toast.success("Dados salvos.");
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="jf-nome-social">Como quer ser chamado(a)</Label>
          <Input
            id="jf-nome-social"
            name="nome_social"
            maxLength={150}
            defaultValue={me.nome_social ?? ""}
            placeholder="Apelido ou nome social"
            autoComplete="nickname"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jf-whatsapp">Seu WhatsApp</Label>
          <Input
            id="jf-whatsapp"
            name="whatsapp"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 91234-5678"
            value={whatsapp}
            onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jf-cidade">Cidade</Label>
          <Input
            id="jf-cidade"
            name="cidade"
            maxLength={100}
            defaultValue={me.cidade ?? ""}
            autoComplete="address-level2"
          />
        </div>
        <CampoUf defaultValue={me.uf ?? ""} />
      </div>
      <CampoInteresses value={interesses} onChange={setInteresses} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending && <CircleNotch size={16} className="animate-spin" aria-hidden />}
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
