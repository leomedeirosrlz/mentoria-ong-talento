import { Megaphone, Trash } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { excluirComunicado } from "@/lib/actions";
import { formatDiaMes } from "@/lib/ciclo";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { NovoComunicadoDialog } from "@/components/novo-comunicado-dialog";
import type { Comunicado } from "@/lib/types";

const AUDIENCIA_LABEL = {
  todos: "Todos",
  dpp: "Mentores DPP",
  especialista: "Mentores especialistas",
  equipe: "Equipe",
  coordenacao: "Só a coordenação",
} as const;

/** Avisos gerais da coordenação — seção compartilhada da home. O /#avisos do
 *  sino aterrissa aqui. Sem avisos: só a coord vê o convite; demais papéis não
 *  pagam custo de layout nenhum. */
export function AvisosSection({
  avisos,
  souCoord,
}: {
  avisos: Comunicado[];
  souCoord: boolean;
}) {
  if (!avisos.length && !souCoord) return null;

  return (
    <section id="avisos" aria-labelledby="avisos-titulo" className="scroll-mt-20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="avisos-titulo" className="flex items-center gap-2 font-semibold">
          <Megaphone size={18} className="text-muted-foreground" aria-hidden />
          Avisos
        </h2>
        {souCoord && <NovoComunicadoDialog />}
      </div>
      {avisos.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Nenhum aviso publicado — o primeiro chega a quem você escolher no
            campo Quem recebe.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border/60 p-0">
            {avisos.map((a) => (
              <article key={a.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {/* a 390px título + badge de audiência + data disputavam
                        ~300px — o título truncava em ~10 caracteres. Linha
                        própria no mobile; sm+ volta a dividir a linha */}
                    <p className="min-w-0 basis-full truncate text-sm font-medium sm:basis-auto">
                      {a.titulo}
                    </p>
                    {a.audiencia !== "todos" && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {AUDIENCIA_LABEL[a.audiencia]}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatDiaMes(a.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {a.corpo}
                  </p>
                </div>
                {souCoord && (
                  // .bind gera a server reference serializável — closure
                  // inline quebra a serialização no payload do router.refresh()
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
                )}
              </article>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
