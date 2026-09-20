"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { setPessoaRole } from "@/lib/actions";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ROLE_LABEL: Record<string, string> = {
  sem_papel: "sem papel",
  mentor_dpp: "mentor DPP",
  mentor_especialista: "mentor especialista",
  supervisor: "supervisor",
  coordenacao: "coordenação",
};

export function RoleSelect({ profileId, role, nome }: { profileId: string; role: string | null; nome?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Select
      value={role ?? "sem_papel"}
      disabled={pending}
      // sem items o trigger fechado mostra o enum cru ("mentor_especialista")
      items={ROLE_LABEL}
      onValueChange={(v) =>
        start(async () => {
          try {
            const res = await setPessoaRole(profileId, !v || v === "sem_papel" ? null : v);
            if (res?.error) toast.error(res.error);
            else {
              // papel aplica na hora — o toast declara o efeito junto com o novo papel
              const quem = nome ? `${nome} agora é` : "Papel atualizado para";
              toast.success(`${quem} ${ROLE_LABEL[v ?? "sem_papel"] ?? v} — o acesso muda na hora.`);
              router.refresh();
            }
          } catch {
            toast.error("Sem conexão — tente de novo.");
          }
        })
      }
    >
      <SelectTrigger aria-label="Papel" aria-busy={pending} className="h-11 text-xs md:h-8">
        {pending && <CircleNotch size={13} className="animate-spin text-muted-foreground" />}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sem_papel">Sem papel</SelectItem>
        <SelectItem value="mentor_dpp">Mentor DPP</SelectItem>
        <SelectItem value="mentor_especialista">Mentor especialista</SelectItem>
        <SelectItem value="supervisor">Supervisor</SelectItem>
        <SelectItem value="coordenacao">Coordenação</SelectItem>
      </SelectContent>
    </Select>
  );
}
