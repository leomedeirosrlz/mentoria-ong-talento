"use client";

import {
  CalendarCheck,
  CaretDown,
  Check,
  MapPin,
  Sparkle,
  UserCheck,
} from "@phosphor-icons/react";
import type { JovemEspecialista } from "@/lib/types";
import type { VarianteCardEsp } from "@/lib/jovem-especialista";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Card do cardápio de especialistas do jovem (WP6-R2, mock v6): a anatomia
 *  rica (foto+nome → cargo·empresa·cidade → chips de áreas → bio → recolhível
 *  "Experiência e formação" → "Atende: períodos" → CTA) com uma variante de
 *  estado por especialista — resolvida pelo caller via varianteDoCard. O
 *  card em si nunca abre o dialog: chama `onPedir(preEspId)` e o wrapper
 *  (`catalogo-jovem`) dispara o PedirEspecialistaDialog compartilhado — assim
 *  a preferência marcada aqui chega ao CTA "Pedir trilha" da página. */
export function JovemEspecialistaCard({
  e,
  variante,
  preferido,
  onTogglePreferencia,
  onPedir,
  lotado,
}: {
  e: JovemEspecialista;
  /** Estado do card pra ESTE jovem — resolve quem é o especialista pra ele
   *  (trilha ativa > pedido em andamento > sem vagas > agenda fechada >
   *  disponível). */
  variante: VarianteCardEsp;
  /** Marcado como preferência no wrapper — vira chip "Sua preferência". */
  preferido: boolean;
  onTogglePreferencia: () => void;
  /** Abre o dialog do pedido — `null` = broadcast pro mural. */
  onPedir: (preEspId: string | null) => void;
  /** teto de pedidos em aberto já batido — o CTA sai de todos os cards */
  lotado: boolean;
}) {
  const nome = e.nome_social || e.nome;
  const primeiro = nome.split(" ")[0];
  const linha = [e.cargo, e.empresa].filter(Boolean).join(" · ");
  const lugar = [e.cidade, e.uf].filter(Boolean).join(", ");
  const formacao = [
    ["Experiência", e.experiencia_previa],
    ["Formação", e.formacao_externa],
    ["Voluntariado", e.voluntariado],
  ].filter((kv): kv is [string, string] => !!kv[1]);

  const badge: { texto: string; cls: string } | null =
    variante === "sua"
      ? {
          texto: "Sua especialista",
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
          {badge && (
            <Badge variant="outline" className={cn("shrink-0", badge.cls)}>
              {badge.texto}
            </Badge>
          )}
        </div>

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

        {e.bio && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground sm:line-clamp-3">
            {e.bio}
          </p>
        )}

        {/* ficha curta recolhível — campo vazio não renderiza (a bio segue
            sendo a linha editorial; aqui é o detalhe de currículo) */}
        {formacao.length > 0 && (
          <details className="group/exp rounded-lg border border-border/60">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 [&::-webkit-details-marker]:hidden">
              Experiência e formação
              <CaretDown
                size={12}
                aria-hidden
                className="ml-auto transition-transform group-open/exp:rotate-180"
              />
            </summary>
            <dl className="space-y-1.5 border-t border-border/60 px-3 py-2.5">
              {formacao.map(([rotulo, texto]) => (
                <div key={rotulo}>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {rotulo}
                  </dt>
                  <dd className="text-xs leading-relaxed">{texto}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}

        {e.grade_resumo && e.grade_resumo.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <CalendarCheck size={13} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground/80">Atende:</span>{" "}
              {e.grade_resumo.join(" · ")}
            </span>
          </p>
        )}

        <div className="mt-auto space-y-2 pt-1">
          {variante === "andamento" ? (
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
              Você já tem 3 pedidos em aberto, o máximo por ciclo. Espere
              uma resposta antes de pedir de novo.
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
          )}
        </div>
      </CardContent>
    </Card>
  );
}
