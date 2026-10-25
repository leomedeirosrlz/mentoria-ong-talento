"use client";

import { useState } from "react";
import { ChatsCircle, Sparkle } from "@phosphor-icons/react";
import { varianteDoCard } from "@/lib/jovem-especialista";
import type {
  JovemEspecialista,
  SolicitacaoEspecialista,
} from "@/lib/types";
import { JovemEspecialistaCard } from "@/components/jovem-especialista-card";
import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";
import { PedirEspecialistaDialog } from "@/components/pedir-especialista-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Wrapper client do cardápio de especialistas (WP6-R2, mock v6): segura o
 *  estado vivo da página — a preferência marcada no card ("Prefiro esta
 *  pessoa" → chip "Sua preferência") e UM PedirEspecialistaDialog
 *  compartilhado, aberto com o preEspId de quem chamou (ou com a
 *  preferência, no CTA "Pedir trilha"). O envio fecha o dialog e o
 *  `onEnviado` limpa a preferência — o router.refresh sozinho preserva o
 *  useState daqui, então a limpeza é explícita.
 *
 *  Também hospeda o rodapé "Falar com a coordenação": o gesto abre um
 *  chamado (NovoChamadoDialog é client — precisa morar num wrapper, a página
 *  é server). */
export function CatalogoJovem({
  catalogo,
  trilhasAtivas,
  slotsPorEsp,
  semDuplaDpp,
  lotado,
  pedidosAbertos,
}: {
  catalogo: JovemEspecialista[];
  /** profile_ids dos especialistas com trilha ativa/pausada do jovem. */
  trilhasAtivas: string[];
  slotsPorEsp: Record<string, string[]>;
  semDuplaDpp: boolean;
  /** Teto da RPC batido (3 pedidos em aberto) — CTA some da página toda. */
  lotado: boolean;
  /** Pedidos em aberto do jovem — insumo do varianteDoCard. */
  pedidosAbertos: SolicitacaoEspecialista[];
}) {
  // a preferência é "de quem eu gostaria" — não é pedido; só entra no envio
  const [preferenciaId, setPreferenciaId] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [preEspId, setPreEspId] = useState<string | null>(null);

  function abrirPedido(espId: string | null) {
    setPreEspId(espId);
    setDialogAberto(true);
  }

  // variante resolvida uma vez por render — dirige a preferência e o CTA
  const variantes = new Map(
    catalogo.map((e) => [
      e.id,
      varianteDoCard(e, { trilhasAtivas, pedidosAbertos }),
    ])
  );
  // a preferência só vale enquanto o card dela está "disponivel" — se ele
  // lotou/fechou a agenda depois de marcada, dirigir a ele prometeria o que
  // o próprio card nega ("seu pedido vai pro mural"); vira broadcast
  const prefValida =
    preferenciaId != null && variantes.get(preferenciaId) === "disponivel"
      ? preferenciaId
      : null;

  return (
    <>
      {catalogo.length === 0 ? (
        <Card>
          <CardContent className="py-5 text-sm text-muted-foreground">
            Ainda não tem especialista disponível. A coordenação avisa
            quando entrar alguém.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {catalogo.map((e) => (
            <JovemEspecialistaCard
              key={e.id}
              e={e}
              variante={variantes.get(e.id) ?? "disponivel"}
              preferido={preferenciaId === e.id}
              onTogglePreferencia={() =>
                setPreferenciaId((p) => (p === e.id ? null : e.id))
              }
              onPedir={abrirPedido}
              lotado={lotado}
            />
          ))}
        </div>
      )}

      {/* o CTA broadcast herda a preferência marcada no cardápio — com ela
          o dialog já abre dirigido a ela; sem preferência é o fluxo normal */}
      {!lotado && catalogo.length > 0 && (
        <div className="mt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => abrirPedido(prefValida)}
          >
            <Sparkle size={15} aria-hidden />
            Pedir trilha
          </Button>
        </div>
      )}

      <PedirEspecialistaDialog
        especialistas={catalogo}
        trilhasAtivas={trilhasAtivas}
        slotsPorEsp={slotsPorEsp}
        semDuplaDpp={semDuplaDpp}
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        preEspId={preEspId}
        onEnviado={() => setPreferenciaId(null)}
      />

      {/* rodapé do mock v6 — "pedir trilha" e "agendar sessão" não cobrem
          trava de agenda/método/plataforma: isso é chamado, outro sistema */}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-4">
        <span className="min-w-0 flex-1 basis-52 text-xs text-muted-foreground">
          Algo travou na agenda, no método ou na plataforma?
        </span>
        <NovoChamadoDialog
          papel="mentorado"
          trigger={
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
            >
              <ChatsCircle size={15} aria-hidden />
              Falar com a coordenação (abre um chamado)
            </Button>
          }
        />
      </div>
    </>
  );
}
