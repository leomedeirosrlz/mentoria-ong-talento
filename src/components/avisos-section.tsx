import { Flag, Megaphone, Siren, Trash } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { excluirComunicado } from "@/lib/actions";
import { formatDiaMes } from "@/lib/ciclo";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ReenviarComunicadoEmailButton } from "@/components/enviar-email-dialog";
import { NovoComunicadoDialog } from "@/components/novo-comunicado-dialog";
import { cn } from "@/lib/utils";
import type { Comunicado } from "@/lib/types";

const AUDIENCIA_LABEL = {
  todos: "Todos",
  dpp: "Mentores DPP",
  especialista: "Mentores especialistas",
  equipe: "Equipe",
  coordenacao: "Só a coordenação",
} as const;

/** Três canais pra urgência, cor nunca sozinha: superfície tingida do
 *  article + badge com ícone e rótulo — 'normal' é null e fica linha
 *  plana de texto (a diferença é estrutural, não só hue). Lime fica fora
 *  da escala: é marca/navegação, não urgência. */
const PRIORIDADE = {
  urgente: {
    tinte: "bg-[var(--danger)]/8",
    icone: Siren,
    texto: "Urgente",
    cls: "border-[var(--danger)]/50 text-[var(--danger)]",
  },
  importante: {
    tinte: "bg-[var(--warn)]/10",
    icone: Flag,
    texto: "Importante",
    cls: "border-[var(--warn)]/50 text-[var(--warn-text)]",
  },
  normal: null,
} as const;

/** Avisos gerais da coordenação — seção compartilhada da home. O /#avisos do
 *  sino aterrissa aqui (scroll-mt-20 compensa a topbar). A ordem vem do
 *  servidor (prioridade + recência) — não reordenar no cliente. Sem avisos:
 *  só a coord vê o convite; demais papéis não pagam custo de layout nenhum.
 *  `className` recebe o placement do grid da home (rail no topo em lg+). */
export function AvisosSection({
  avisos,
  souCoord,
  className,
}: {
  avisos: Comunicado[];
  souCoord: boolean;
  /** placement no grid da home — merge no <section> raiz */
  className?: string;
}) {
  if (!avisos.length && !souCoord) return null;

  return (
    <section
      id="avisos"
      aria-labelledby="avisos-titulo"
      className={cn("scroll-mt-20", className)}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="avisos-titulo" className="flex items-center gap-2 font-semibold">
          <Megaphone size={18} className="text-muted-foreground" aria-hidden />
          Avisos
        </h2>
        {souCoord && <NovoComunicadoDialog />}
      </div>
      {avisos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2.5 py-6 text-center text-sm text-muted-foreground">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <Megaphone size={18} aria-hidden />
            </span>
            <p>
              Nenhum aviso publicado. O primeiro chega a quem você escolher no
              campo Quem recebe.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border/60 p-0">
            {avisos.map((a) => {
              const prio = PRIORIDADE[a.prioridade];
              const Icone = prio?.icone;
              return (
                <article
                  key={a.id}
                  className={cn(
                    "px-4 py-3 sm:px-5",
                    // o overflow-hidden do Card apara o tinte no rounded-xl
                    prio?.tinte
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {prio && Icone && (
                      <Badge variant="outline" className={prio.cls}>
                        <Icone data-icon="inline-start" aria-hidden />
                        {prio.texto}
                      </Badge>
                    )}
                    {/* título nunca trunca: basis-40 garante ~160px mínimos e
                        flex-wrap joga ele pra linha própria quando badge+data
                        disputam — rail de 300px e mobile leem o título todo */}
                    <p className="min-w-0 flex-1 basis-40 text-sm font-medium">
                      {a.titulo}
                    </p>
                    <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                      {formatDiaMes(a.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {a.corpo}
                  </p>
                  {/* meta-linha: chip de audiência minúsculo + ações da coord
                      no rodapé — no mobile a coluna fixa de ações esmagava o
                      corpo em ~170px; aqui o texto usa a largura toda */}
                  {(a.audiencia !== "todos" || souCoord) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {a.audiencia !== "todos" && (
                        <span className="rounded-full border border-border px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {AUDIENCIA_LABEL[a.audiencia]}
                        </span>
                      )}
                      {souCoord && (
                        <div className="ms-auto flex items-center gap-1">
                          {/* sutil: o aviso já sai por e-mail na publicação —
                              aqui é reenvio manual (quem entrou depois, caixa
                              perdida); o label some <sm e vira ícone */}
                          <ReenviarComunicadoEmailButton comunicadoId={a.id} />
                          {/* .bind gera a server reference serializável —
                              closure inline quebra a serialização no payload
                              do router.refresh() */}
                          <ConfirmDeleteButton
                            titulo={`Excluir "${a.titulo}"?`}
                            descricao="O aviso sai da home de todo mundo e as notificações dele são removidas. Para corrigir, publique um novo."
                            sucesso="Aviso excluído."
                            onConfirm={excluirComunicado.bind(null, a.id)}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Excluir aviso "${a.titulo}"`}
                              >
                                <Trash size={15} />
                              </Button>
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
