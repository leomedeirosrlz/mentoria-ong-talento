"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setContatoCompartilhado } from "@/lib/actions-jovem";
import { cn } from "@/lib/utils";

/** Card "Privacidade" do /jovem/perfil (0076) — o opt-in que libera o
 *  WhatsApp da ficha pros colegas de turma com conta (view
 *  mentorados_turma). Sem WhatsApp na ficha o controle aparece desligado
 *  e explicado, nunca escondido: a preferência é dele e passa a valer
 *  quando o número existir. */
export function PrivacidadeCard({
  compartilhado,
  temWhatsapp,
}: {
  /** estado inicial — jovem_perfil.contato_compartilhado */
  compartilhado: boolean;
  /** a view compartilha mentorados.whatsapp (a ficha, mantida pela
   *  coordenação) — sem ele o toggle não teria efeito */
  temWhatsapp: boolean;
}) {
  const [ligado, setLigado] = useState(compartilhado);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(v: boolean) {
    const anterior = ligado;
    setLigado(v); // otimista — o banco é a fronteira; desfaz em erro
    start(async () => {
      try {
        const r = await setContatoCompartilhado(v);
        if (r.error) {
          setLigado(anterior);
          toast.error(r.error);
        } else {
          toast.success(
            v
              ? "Seu WhatsApp agora aparece pros colegas da turma."
              : "Seu WhatsApp voltou a ficar só com a equipe."
          );
          router.refresh();
        }
      } catch {
        setLigado(anterior);
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Privacidade
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Você escolhe se os colegas veem seu contato.
      </p>
      <div className="mt-4 space-y-4">
        <label
          className={cn(
            "flex items-start gap-3 rounded-lg border border-border px-3.5 py-3 text-sm",
            (pending || !temWhatsapp) && "opacity-60"
          )}
        >
          <Switch
            checked={ligado}
            onCheckedChange={toggle}
            disabled={pending || !temWhatsapp}
            aria-label="Compartilhar meu WhatsApp com os colegas"
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">
              Compartilhar meu WhatsApp com os colegas
            </span>{" "}
            <span className="text-muted-foreground">
              {temWhatsapp
                ? "— ligado, os colegas da sua turma que têm conta na plataforma veem o número do seu cadastro em Pessoas; desligado, ninguém vê."
                : "— seu cadastro no programa ainda não tem WhatsApp (a coordenação mantém a ficha). Quando ele estiver lá, ligar aqui compartilha com os colegas."}
            </span>
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          Do outro lado é igual: um colega só mostra o WhatsApp dele se
          escolher compartilhar no próprio perfil.
        </p>
      </div>
    </section>
  );
}
