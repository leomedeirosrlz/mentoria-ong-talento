"use client";

import Link from "next/link";
import {
  CalendarCheck,
  CaretDown,
  MapPin,
} from "@phosphor-icons/react";
import type { JovemEspecialista } from "@/lib/types";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A anatomia rica do card de especialista (mock v6), extraída do
 *  JovemEspecialistaCard pra toda superfície que lista a projeção do
 *  catálogo (diretório do jovem, faceta "Especialistas" da /pessoas e os
 *  pools de sugestão/solicitação do staff): foto+nome → cargo·empresa →
 *  cidade/UF → chips de área 4+N → bio em clamp → recolhível "Experiência
 *  e formação" → "Atende: períodos" → rodapé. A superfície decide o
 *  rodapé (CTA "Selecionar" no pool, "Ver perfil" no diretório, as
 *  variantes de estado no cardápio do jovem) e o badge de contexto.
 *  `href` envolve o bloco avatar+nome num Link único (aria-label "Abrir
 *  perfil de …", prefetch off) — o card navega sem perder os CTAs. */
export function EspecialistaCatalogoCard({
  e,
  badge,
  href,
  rodape,
}: {
  e: JovemEspecialista;
  /** Chip de contexto no topo ("Seu especialista", "Sem vagas",
   *  "Selecionado") — a superfície resolve o texto e o tom. */
  badge?: { texto: string; cls?: string } | null;
  /** Ficha da pessoa — o bloco nome/avatar vira link quando presente. */
  href?: string;
  /** Ação de pé do card — a superfície decide; sem ela o bloco some. */
  rodape?: React.ReactNode;
}) {
  const nome = e.nome_social || e.nome;
  const linha = [e.cargo, e.empresa].filter(Boolean).join(" · ");
  const lugar = [e.cidade, e.uf].filter(Boolean).join(", ");
  const formacao = [
    ["Experiência", e.experiencia_previa],
    ["Formação", e.formacao_externa],
    ["Voluntariado", e.voluntariado],
  ].filter((kv): kv is [string, string] => !!kv[1]);

  const blocoTopo = (
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
  );

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 py-4">
        {href ? (
          <Link
            href={href}
            prefetch={false}
            aria-label={`Abrir perfil de ${nome}`}
            className="-mx-1 -mt-1 rounded-lg px-1 pt-1 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {blocoTopo}
          </Link>
        ) : (
          blocoTopo
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

        {rodape != null && <div className="mt-auto space-y-2 pt-1">{rodape}</div>}
      </CardContent>
    </Card>
  );
}
