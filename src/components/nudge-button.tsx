import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { waLink } from "@/lib/ciclo";

export function NudgeButton({
  telefone,
  mensagem,
  label = "Chamar no WhatsApp",
}: {
  telefone: string | null | undefined;
  mensagem: string;
  label?: string;
}) {
  const href = waLink(telefone, mensagem);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-[oklch(0.7_0.11_165/0.12)] hover:text-foreground hover:border-[oklch(0.7_0.11_165/0.4)]"
    >
      <WhatsappLogo size={15} />
      {label}
    </a>
  );
}
