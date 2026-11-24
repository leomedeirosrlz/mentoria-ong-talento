"use client";

import { useState } from "react";
import { CaretDown, Check, Megaphone } from "@phosphor-icons/react";
import { EspecialistaCatalogoCard } from "@/components/especialista-catalogo-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { JovemEspecialista } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Pool de seleção por cards do catálogo staff (023): substitui o Select
 *  de nomes dos forms de sugestão/solicitação — a anatomia rica do
 *  EspecialistaCatalogoCard com CTA "Selecionar", estado "Selecionado"
 *  visível + aria-pressed e o card "qualquer" no topo da lista.
 *  `selecionado = null` é a escolha sem nome (mural/direcionamento). */
export function EspecialistaSeletor({
  catalogo,
  selecionado,
  onSelecionar,
  label,
  rotuloQualquer,
  descricaoQualquer,
  idBase,
  linkPerfil,
}: {
  catalogo: JovemEspecialista[];
  selecionado: string | null;
  onSelecionar: (id: string | null) => void;
  label: string;
  rotuloQualquer: string;
  descricaoQualquer?: string;
  idBase: string;
  /** Ficha da pessoa — o bloco nome/avatar dos cards vira link (o jovem
   *  conhece quem escolhe; no staff a ficha segue outro caminho). */
  linkPerfil?: (e: JovemEspecialista) => string;
}) {
  const [aberto, setAberto] = useState(false);
  const espSel = selecionado
    ? (catalogo.find((e) => e.id === selecionado) ?? null)
    : null;

  const escolher = (id: string | null) => {
    onSelecionar(id === selecionado ? null : id);
    setAberto(false);
  };

  return (
    <div className="space-y-2">
      <Label id={`${idBase}-label`}>{label}</Label>
      {espSel && !aberto ? (
        // resumo da escolha: o card completo da pessoa escolhida
        <EspecialistaCatalogoCard
          e={espSel}
          href={linkPerfil?.(espSel)}
          badge={{
            texto: "Selecionado",
            cls: "border-[var(--ok)]/50 bg-[var(--ok)]/10 text-[var(--ok-text)]",
          }}
          rodape={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setAberto(true)}
              aria-expanded={false}
              aria-controls={`${idBase}-pool`}
            >
              Trocar
            </Button>
          }
        />
      ) : (
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls={`${idBase}-pool`}
          aria-labelledby={`${idBase}-label ${idBase}-valor`}
          onClick={() => setAberto(!aberto)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
        >
          <span id={`${idBase}-valor`} className="truncate text-left">
            {aberto ? "Fechar a lista" : rotuloQualquer}
          </span>
          <CaretDown
            size={14}
            className={cn("shrink-0 transition-transform", aberto && "rotate-180")}
          />
        </button>
      )}
      {aberto && (
        <ul
          id={`${idBase}-pool`}
          role="list"
          className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2"
        >
          <li>
            <Card>
              <CardContent className="flex items-center gap-3 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Megaphone size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{rotuloQualquer}</p>
                  {descricaoQualquer && (
                    <p className="text-xs text-muted-foreground">
                      {descricaoQualquer}
                    </p>
                  )}
                </div>
                {selecionado === null && (
                  <Badge
                    variant="outline"
                    className="border-[var(--ok)]/50 text-[var(--ok-text)]"
                  >
                    Selecionado
                  </Badge>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={selecionado === null ? "default" : "outline"}
                  aria-pressed={selecionado === null}
                  onClick={() => escolher(null)}
                >
                  {selecionado === null ? (
                    <>
                      <Check size={14} /> Selecionado
                    </>
                  ) : (
                    "Selecionar"
                  )}
                </Button>
              </CardContent>
            </Card>
          </li>
          {catalogo.map((e) => (
            <li key={e.id}>
              <EspecialistaCatalogoCard
                e={e}
                href={linkPerfil?.(e)}
                badge={
                  selecionado === e.id
                    ? {
                        texto: "Selecionado",
                        cls: "border-[var(--ok)]/50 bg-[var(--ok)]/10 text-[var(--ok-text)]",
                      }
                    : null
                }
                rodape={
                  <Button
                    type="button"
                    size="sm"
                    variant={selecionado === e.id ? "default" : "outline"}
                    className="w-full"
                    aria-pressed={selecionado === e.id}
                    onClick={() => escolher(e.id)}
                  >
                    {selecionado === e.id ? (
                      <>
                        <Check size={14} /> Selecionado
                      </>
                    ) : (
                      "Selecionar"
                    )}
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
