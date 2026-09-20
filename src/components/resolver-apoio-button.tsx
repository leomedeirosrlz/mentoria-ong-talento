"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandHeart } from "@phosphor-icons/react";
import { toast } from "sonner";
import { resolverApoio } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function ResolverApoioButton({ registroId, duplaId }: { registroId: string; duplaId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="outline"
      className="border-[var(--danger)]/50 text-[var(--danger)] shrink-0"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await resolverApoio(registroId, duplaId);
          if (res?.error) toast.error(res.error);
          else {
            toast.success("Pedido de apoio atendido.");
            router.refresh();
          }
        })
      }
    >
      <HandHeart size={14} /> Marcar apoio como atendido
    </Button>
  );
}
