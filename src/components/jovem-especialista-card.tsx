import { CalendarCheck, MapPin, Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { JovemEspecialista } from "@/lib/types";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PedirEspecialistaDialog } from "./pedir-especialista-dialog";

/** Card do cardápio de especialistas do jovem (WP6): bio/cargo/origem
 *  self-authored + a disponibilidade como períodos ("seg de manhã"), nunca
 *  slot exato — a agenda de verdade só aparece na mesa de negociação depois
 *  do pedido. `vagas` vira estado ("agenda aberta"/"agenda cheia"), nunca
 *  número — a meta é convite, não ranking. */
export function JovemEspecialistaCard({
  e,
  trilhasAtivas,
  slotsPorEsp,
  semDuplaDpp,
  lotado,
}: {
  e: JovemEspecialista;
  trilhasAtivas: string[];
  slotsPorEsp: Record<string, string[]>;
  semDuplaDpp: boolean;
  /** teto de pedidos em aberto já batido — o CTA sai de todos os cards */
  lotado: boolean;
}) {
  const nome = e.nome_social || e.nome;
  const primeiro = nome.split(" ")[0];
  const comAgenda = (e.vagas ?? 0) > 0;
  const linha = [e.cargo, e.empresa].filter(Boolean).join(" · ");
  const lugar = [e.cidade, e.uf].filter(Boolean).join(", ");

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 py-4">
        <div className="flex items-start gap-3">
          <Avatar
            nome={nome}
            src={e.avatar_path ? avatarPublicUrl(e.avatar_path) : null}
            size={44}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={nome}>
              {nome}
            </p>
            {linha && (
              <p className="truncate text-sm text-muted-foreground" title={linha}>
                {linha}
              </p>
            )}
            {lugar && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={12} aria-hidden className="shrink-0" />
                <span className="truncate">{lugar}</span>
              </p>
            )}
          </div>
          <Badge
            variant="outline"
            className={
              comAgenda
                ? "shrink-0 border-[var(--brand-lime)]/50 text-[var(--brand-ink)]"
                : "shrink-0 text-muted-foreground"
            }
          >
            {comAgenda ? "Agenda aberta" : "Agenda cheia"}
          </Badge>
        </div>

        {e.bio && (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {e.bio}
          </p>
        )}

        {e.areas && e.areas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {e.areas.slice(0, 4).map((a) => (
              <Badge key={a} variant="secondary" className="font-normal">
                {a}
              </Badge>
            ))}
            {e.areas.length > 4 && (
              <Badge variant="secondary" className="font-normal">
                +{e.areas.length - 4}
              </Badge>
            )}
          </div>
        )}

        {(e.voluntariado || e.experiencia_previa) && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {e.experiencia_previa ?? e.voluntariado}
          </p>
        )}

        {e.grade_resumo && e.grade_resumo.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <CalendarCheck size={13} aria-hidden className="mt-0.5 shrink-0" />
            <span>{e.grade_resumo.join(" · ")}</span>
          </p>
        )}

        <div className="mt-auto pt-1">
          {lotado ? (
            <p className="text-xs text-muted-foreground">
              Você já tem pedidos em aberto — espera uma resposta antes de
              pedir de novo.
            </p>
          ) : (
            <PedirEspecialistaDialog
              especialistas={[e]}
              trilhasAtivas={trilhasAtivas}
              slotsPorEsp={slotsPorEsp}
              semDuplaDpp={semDuplaDpp}
              preEspId={e.id}
              trigger={
                <Button size="sm" variant="outline" className="w-full">
                  <Sparkle size={15} aria-hidden />
                  Pedir sessão com {primeiro}
                </Button>
              }
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
