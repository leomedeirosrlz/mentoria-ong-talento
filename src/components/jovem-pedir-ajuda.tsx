import Link from "next/link";
import { CaretRight, HandHeart, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { EquipeWaDialog } from "@/components/jovem-equipe-wa";
import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";
import { Button } from "@/components/ui/button";
import type { ChamadoPendencia } from "@/lib/pendencias-jovem";
import type { JovemContato } from "@/lib/types";

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
 *  encontro, e ciente do pedido em curso — sem pedido vivo o texto inteiro
 *  é o gesto de abrir um; com pedido, o texto vira o andamento e linka a
 *  conversa na âncora #apoio, com o "Pedir ajuda" encolhido ao lado. A régua
 *  é a mesma do motor (chamadoPendencia): "resposta" e "cuidando" chegam
 *  prontos; o pedido ativo sem dono (andamento null) é a espera em aberto.
 *  O WhatsApp ao lado abre a equipe (cada membro com o próprio número). */
export function PedirAjudaLinha({
  equipe,
  nomeJovem,
  pedido,
}: {
  equipe: JovemContato[];
  nomeJovem: string;
  /** Pedido vivo (aberto/em atendimento) já projetado na página — o mais
   *  relevante primeiro (resposta > cuidando > espera), null = nenhum. */
  pedido?: ChamadoPendencia | null;
}) {
  const comWa = equipe.some((c) => c.whatsapp?.trim());
  // "respondeu" usa só o primeiro nome — mesma regra do motor e da linha
  // da pendência (o sobrenome inteiro não cabe numa linha de status)
  const titulo = !pedido
    ? "Pedir ajuda"
    : pedido.andamento === "resposta"
      ? `${pedido.respondeuNome?.trim().split(" ")[0] || "A equipe"} respondeu seu pedido`
      : pedido.andamento === "cuidando"
        ? "A equipe está cuidando do seu pedido"
        : "Pedido em aberto";
  const sub = !pedido
    ? "Precisa de ajuda? Fale com a equipe"
    : pedido.andamento == null
      ? "Aguardando a equipe"
      : pedido.assunto?.trim() || null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {pedido ? (
        <Link
          href={`/jovem?c=${pedido.id}#apoio`}
          prefetch={false}
          className="group flex min-h-11 min-w-0 flex-1 basis-52 items-center gap-2.5 rounded-md text-left outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <HandHeart size={18} className="shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{titulo}</span>
            {sub && (
              <span className="block truncate text-xs text-muted-foreground">
                {sub}
              </span>
            )}
          </span>
          <CaretRight
            size={14}
            aria-hidden
            className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      ) : (
        <PedirAjudaDialog
          trigger={
            <button
              type="button"
              className="group flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md text-left outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <HandHeart size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {sub}
                </span>
              </span>
              <CaretRight
                size={14}
                aria-hidden
                className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </button>
          }
        />
      )}
      <span className="ms-auto flex shrink-0 items-center">
        {pedido && (
          <PedirAjudaDialog
            trigger={
              <Button
                variant="ghost"
                className="min-h-11 shrink-0 gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Pedir ajuda
              </Button>
            }
          />
        )}
        {comWa && (
          <EquipeWaDialog
            equipe={equipe}
            nomeJovem={nomeJovem}
            trigger={
              <Button
                variant="ghost"
                className="min-h-11 shrink-0 gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <WhatsappLogo size={16} aria-hidden />
                WhatsApp
              </Button>
            }
          />
        )}
      </span>
    </div>
  );
}
