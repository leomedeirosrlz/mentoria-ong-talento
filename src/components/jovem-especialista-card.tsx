"use client";

import { Check, Sparkle, UserCheck } from "@phosphor-icons/react";
import type { JovemEspecialista } from "@/lib/types";
import type { VarianteCardEsp } from "@/lib/jovem-especialista";
import { EspecialistaCatalogoCard } from "@/components/especialista-catalogo-card";
import { Button } from "@/components/ui/button";

/** Card do cardápio de especialistas do jovem (WP6-R2, mock v6): a anatomia
 *  rica mora no EspecialistaCatalogoCard compartilhado; aqui ficam a
 *  variante de estado por especialista (resolvida pelo caller via
 *  varianteDoCard) e o rodapé com a preferência/pedido. O card em si
 *  nunca abre o dialog: chama `onPedir(preEspId)` e o wrapper
 *  (`catalogo-jovem`) dispara o fluxo compartilhado — assim a preferência
 *  marcada aqui chega ao CTA "Pedir trilha" da página. */
export function JovemEspecialistaCard({
  e,
  variante,
  preferido,
  onTogglePreferencia,
  onPedir,
  lotado,
  href,
}: {
  e: JovemEspecialista;
  /** Estado do card pra ESTE jovem — resolve quem é o especialista pra ele
   *  (trilha ativa > pedido em andamento > sem vagas > agenda fechada >
   *  disponível). */
  variante: VarianteCardEsp;
  /** Marcado como preferência no wrapper — vira chip "Sua preferência". */
  preferido: boolean;
  onTogglePreferencia: () => void;
  /** Abre o fluxo do pedido — `null` = broadcast pro mural. */
  onPedir: (preEspId: string | null) => void;
  /** teto de pedidos em aberto já batido — o CTA sai de todos os cards */
  lotado: boolean;
  /** Ficha da pessoa no diretório — o bloco nome/avatar vira link. */
  href?: string;
}) {
  const primeiro = (e.nome_social || e.nome).split(" ")[0];

  const badge: { texto: string; cls: string } | null =
    variante === "sua"
      ? {
          texto: "Seu especialista",
          cls: "border-[var(--ok)]/50 text-[var(--ok-text)]",
        }
      : variante === "andamento"
        ? {
            texto: "Pedido em andamento",
            cls: "border-[var(--warn)]/60 text-[var(--warn-text)]",
          }
        : variante === "sem_vagas"
          ? { texto: "Sem vagas", cls: "text-muted-foreground" }
          : variante === "sem_agenda"
            ? { texto: "Agenda não aberta", cls: "text-muted-foreground" }
            : preferido
              ? {
                  texto: "Sua preferência",
                  cls: "border-[var(--warn)]/60 text-[var(--warn-text)]",
                }
              : null;

  const rodape =
    variante === "andamento" ? (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Seu pedido já está em aberto.{" "}
        <a
          href="#pedidos"
          className="font-medium text-foreground underline underline-offset-2"
        >
          Ver meus pedidos
        </a>
      </p>
    ) : lotado ? (
      <p className="text-xs text-muted-foreground">
        Você já tem 3 pedidos em aberto, o máximo por ciclo. Espere uma
        resposta antes de pedir de novo.
      </p>
    ) : variante === "sua" ? (
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => onPedir(e.id)}
      >
        <Sparkle size={15} aria-hidden />
        Pedir próxima sessão
      </Button>
    ) : variante === "sem_vagas" || variante === "sem_agenda" ? (
      <>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {variante === "sem_vagas"
            ? "Agenda cheia no momento. Seu pedido vai pro mural."
            : "Ainda não liberou horários. Seu pedido vai pro mural."}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => onPedir(null)}
        >
          <Sparkle size={15} aria-hidden />
          Pedir pro mural
        </Button>
      </>
    ) : preferido ? (
      <div className="space-y-2">
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={onTogglePreferencia}
            aria-pressed
            title="Tocar de novo desmarca a preferência"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--warn)]/60 bg-[var(--role-mentorado)]/15 px-3 font-medium text-[var(--warn-text)] transition-colors hover:bg-[var(--role-mentorado)]/25"
          >
            <Check size={12} weight="bold" aria-hidden />
            Sua preferência
          </button>
          <span className="text-muted-foreground">
            falta enviar o pedido
          </span>
        </p>
        <Button
          size="sm"
          className="w-full"
          onClick={() => onPedir(e.id)}
        >
          <Sparkle size={15} aria-hidden />
          Continuar pedido com {primeiro}
        </Button>
      </div>
    ) : (
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={onTogglePreferencia}
      >
        <UserCheck size={15} aria-hidden />
        Prefiro esta pessoa
      </Button>
    );

  return (
    <EspecialistaCatalogoCard
      e={e}
      badge={badge}
      href={href}
      rodape={rodape}
    />
  );
}
