"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setPessoaRole } from "@/lib/actions";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function RoleSelect({ profileId, role }: { profileId: string; role: string | null }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Select
      value={role ?? "sem_papel"}
      disabled={pending}
      onValueChange={(v) =>
        start(async () => {
          const res = await setPessoaRole(profileId, !v || v === "sem_papel" ? "" : v);
          if (res?.error) toast.error(res.error);
          else router.refresh();
        })
      }
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sem_papel">Sem papel</SelectItem>
        <SelectItem value="mentor_dpp">Mentor DPP</SelectItem>
        <SelectItem value="mentor_especialista">Mentor especialista</SelectItem>
        <SelectItem value="supervisor">Supervisor</SelectItem>
        <SelectItem value="coordenacao">Coordenacao</SelectItem>
      </SelectContent>
    </Select>
  );
}
