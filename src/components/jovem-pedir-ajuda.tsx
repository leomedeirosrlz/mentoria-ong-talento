import { CaretRight, HandHeart, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";

/** "Preciso de ajuda" do jovem — 0084: o canal de segurança abre um chamado
 *  (opções na linguagem dele, "É urgente" sempre à mão) em vez de uma
 *  notificação solta. O pedido fica com dono, estado e trilha de resposta —
 *  e o mentor dele NÃO vê: o canal pode ser justamente sobre a dupla. */
export function PedirAjudaDialog({
  trigger,
}: {
  /** Elemento do trigger — cada ponto da UI escolhe a aparência. */
  trigger: React.ReactElement;
}) {
  return <NovoChamadoDialog papel="mentorado" trigger={trigger} />;
}

/** Linha discreta de ajuda da home: sempre visível, sem disputar com o
 *  encontro. O texto inteiro abre o mesmo chamado; o WhatsApp da coordenação
 *  segue ao lado, pra quem prefere falar direto. */
export function PedirAjudaLinha({ waCoord }: { waCoord: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <PedirAjudaDialog
        trigger={
          <button
            type="button"
            className="group flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md text-left text-sm font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <HandHeart size={18} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">Precisa de ajuda? Fale com a equipe</span>
            <CaretRight
              size={14}
              aria-hidden
              className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </button>
        }
      />
      {waCoord && (
        <a
          href={waCoord}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <WhatsappLogo size={16} aria-hidden />
          WhatsApp
          <span className="sr-only"> da coordenação (abre em nova aba)</span>
        </a>
      )}
    </div>
  );
}
