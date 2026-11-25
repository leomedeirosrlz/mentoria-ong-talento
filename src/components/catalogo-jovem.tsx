"use client";

import { useState } from "react";
import { ChatsCircle, Megaphone, Sparkle } from "@phosphor-icons/react";
import { varianteDoCard } from "@/lib/jovem-especialista";
import type {
  JovemEspecialista,
  SolicitacaoEspecialista,
} from "@/lib/types";
import { JovemEspecialistaCard } from "@/components/jovem-especialista-card";
import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";
import { PedirEspecialistaPainel } from "@/components/pedir-especialista-painel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** O card "Qualquer especialista" no fim da grade — a seleção dele é o
 *  pedido broadcast (esp null pro painel/ação). Sentinela local: o id
 *  nunca colide com profile_id real. */
const MURAL = "__mural__";

/** Wrapper client do cardápio de especialistas (WP6-R2 + 023): segura o
 *  estado vivo da página — a preferência marcada no card ("Prefiro esta
 *  pessoa" → chip "Sua preferência") e a SELEÇÃO da grade: o pedido saiu
 *  do modal, quem inicia "Pedir trilha" escolhe um card (selo
 *  "Selecionado" + aria-pressed) e o PedirEspecialistaPainel monta sob a
 *  grade com horário+texto. O envio limpa seleção e preferência — o
 *  router.refresh sozinho preserva o useState daqui, então a limpeza é
 *  explícita. O pending do painel trava a seleção até a resposta.
 *
 *  Também hospeda o rodapé "Falar com a coordenação": o gesto abre um
 *  chamado (NovoChamadoDialog é client — precisa morar num wrapper, a página
 *  é server). */
export function CatalogoJovem({
  catalogo,
  trilhasAtivas,
  slotsPorEsp,
  lotado,
  pedidosAbertos,
}: {
  catalogo: JovemEspecialista[];
  /** profile_ids dos especialistas com trilha ativa/pausada do jovem. */
  trilhasAtivas: string[];
  slotsPorEsp: Record<string, string[]>;
  /** Teto da RPC batido (3 pedidos em aberto) — a seleção desliga com a
   *  explicação, no lugar dos CTAs. */
  lotado: boolean;
  /** Pedidos em aberto do jovem — insumo do varianteDoCard. */
  pedidosAbertos: SolicitacaoEspecialista[];
}) {
  // a preferência é "de quem eu gostaria" — não é pedido; só entra no envio
  const [preferenciaId, setPreferenciaId] = useState<string | null>(null);
  // o alvo do painel aberto — id do catálogo ou MURAL; null = fechado
  const [selecionado, setSelecionado] = useState<string | null>(null);
  // o submit do painel trava a seleção dos cards até a resposta (spec 023)
  const [enviando, setEnviando] = useState(false);

  // re-tocar o card selecionado desmarca — o painel desmonta junto
  const selecionar = (espId: string | null) => {
    if (enviando) return;
    const alvo = espId ?? MURAL;
    setSelecionado((s) => (s === alvo ? null : alvo));
  };

  // o foco volta ao CTA do card que abriu o painel — o id é estável por
  // alvo e o card re-renderiza no lugar
  const devolveFoco = (alvo: string | null) => {
    if (alvo == null) return;
    document
      .getElementById(alvo === MURAL ? "cta-pedir-mural" : `cta-pedir-${alvo}`)
      ?.focus();
  };
  const fecharPainel = () => {
    const alvo = selecionado;
    setSelecionado(null);
    devolveFoco(alvo);
  };
  const aoEnviar = () => {
    const alvo = selecionado;
    setSelecionado(null);
    setPreferenciaId(null);
    devolveFoco(alvo);
  };

  // variante resolvida uma vez por render — dirige a preferência e o CTA
  const variantes = new Map(
    catalogo.map((e) => [
      e.id,
      varianteDoCard(e, { trilhasAtivas, pedidosAbertos }),
    ])
  );

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
              selecionado={selecionado === e.id}
              travado={enviando}
              idCta={`cta-pedir-${e.id}`}
              onSelecionar={selecionar}
              lotado={lotado}
              href={`/jovem/pessoas/${e.id}`}
            />
          ))}
          {/* o broadcast é um card da grade (023): "Qualquer especialista"
              fecha a linha e seleciona como qualquer card — sem ele o
              mural ficaria escondido num segundo gesto */}
          <Card className="h-full">
            <CardContent className="flex h-full flex-col gap-3 py-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                >
                  <Megaphone size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Qualquer especialista</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    Sem preferência de pessoa: seu pedido aparece no mural
                    de todos e quem puder te atender aceita.
                  </p>
                </div>
                {selecionado === MURAL && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-[var(--ok)]/50 bg-[var(--ok)]/10 font-normal text-[var(--ok-text)]"
                  >
                    Selecionado
                  </Badge>
                )}
              </div>
              <div className="mt-auto pt-1">
                {lotado ? (
                  <p className="text-xs text-muted-foreground">
                    Você já tem 3 pedidos em aberto, o máximo por ciclo.
                    Espere uma resposta antes de pedir de novo.
                  </p>
                ) : (
                  <Button
                    id="cta-pedir-mural"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    aria-pressed={selecionado === MURAL}
                    disabled={enviando}
                    onClick={() => selecionar(null)}
                  >
                    <Sparkle size={15} aria-hidden />
                    Pedir pro mural
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* a etapa horário+texto monta inline sob a grade (023) — key por
          alvo remonta texto/slots/erro a cada seleção */}
      {selecionado != null && (
        <PedirEspecialistaPainel
          key={selecionado}
          esp={
            selecionado === MURAL
              ? null
              : (catalogo.find((e) => e.id === selecionado) ?? null)
          }
          trilhasAtivas={trilhasAtivas}
          slotsIniciais={
            selecionado === MURAL ? undefined : slotsPorEsp[selecionado]
          }
          onFechar={fecharPainel}
          onEnviado={aoEnviar}
          onPendingChange={setEnviando}
        />
      )}

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
              Falar com a coordenação
            </Button>
          }
        />
      </div>
    </>
  );
}
