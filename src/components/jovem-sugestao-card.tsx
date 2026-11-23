"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretRight, Check, Sparkle, X } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import {
  confirmarSugestaoEspecialista,
  dispensarSugestaoEspecialista,
} from "@/lib/actions-jovem";
import { avatarPublicUrl } from "@/lib/avatar";
import type { JovemEspecialista, SolicitacaoEspecialista } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const QUALQUER = "qualquer";

/** Prévia do especialista indicado (REALIZA-515) — foto, profissão/áreas e
 *  experiência, o mesmo recorte público da view `jovem_especialistas` (sem
 *  documentos nem contato: isso só abre depois que a trilha começa). O
 *  bloco inteiro leva ao perfil em /jovem/pessoas — decidir sem ver quem
 *  é era apostar às cegas. */
function EspecialistaPreview({ e }: { e: JovemEspecialista }) {
  const nome = e.nome_social || e.nome;
  const atuacao = [e.cargo, e.empresa].filter(Boolean).join(" · ");
  const experiencia = e.experiencia_previa ?? e.bio;
  return (
    <Link
      href={`/jovem/pessoas/${e.id}`}
      aria-label={`Ver perfil de ${nome}`}
      className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/60 p-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar
        nome={nome}
        src={e.avatar_path ? avatarPublicUrl(e.avatar_path) : null}
        size={40}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-tight">
          {nome}
        </span>
        {atuacao && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {atuacao}
          </span>
        )}
        {!!e.areas?.length && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {e.areas.slice(0, 3).map((a) => (
              <Badge key={a} variant="secondary" className="font-normal">
                {a}
              </Badge>
            ))}
            {e.areas.length > 3 && (
              <Badge variant="secondary" className="font-normal">
                +{e.areas.length - 3}
              </Badge>
            )}
          </span>
        )}
        {experiencia && (
          <span className="mt-1.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
            {experiencia}
          </span>
        )}
      </span>
      <CaretRight
        size={15}
        aria-hidden
        className="mt-0.5 shrink-0 text-muted-foreground"
      />
    </Link>
  );
}

/** Card da sugestão registrada pelo mentor DPP (WP6): a demanda é do jovem —
 *  confirmar vira pedido de verdade ('aberta', entra nos tetos e no mural);
 *  dispensar cancela e some. Antes de confirmar ele pode ajustar tema,
 *  objetivo e o especialista de destino. */
export function SugestaoEspecialistaCard({
  s,
  catalogo,
}: {
  s: SolicitacaoEspecialista;
  catalogo: JovemEspecialista[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [demanda, setDemanda] = useState(s.demanda ?? "");
  const [objetivo, setObjetivo] = useState(s.motivo ?? "");
  const [esp, setEsp] = useState(s.especialista_desejado_id ?? QUALQUER);
  const router = useRouter();

  const autor = s.solicitante?.nome ?? "Seu mentor";
  const escolhido = catalogo.find((e) => e.id === esp);
  const sugerido = s.especialista_desejado_id
    ? catalogo.find((e) => e.id === s.especialista_desejado_id)
    : undefined;

  function confirmar() {
    start(async () => {
      try {
        const res = await confirmarSugestaoEspecialista({
          id: s.id,
          especialistaId: esp === QUALQUER ? null : esp,
          demanda,
          objetivo,
        });
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Pedido enviado. O especialista já pode responder.");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function dispensar() {
    start(async () => {
      try {
        const res = await dispensarSugestaoEspecialista(s.id);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Sugestão dispensada.");
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-[var(--role-mentorado)]/40 bg-[var(--role-mentorado)]/10 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--role-mentorado)] text-[var(--destaque-foreground)]"
        >
          <Sparkle size={18} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {autor} sugeriu um especialista pra você
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {s.demanda}
          </p>
          {s.motivo && (
            <p className="mt-1.5 text-sm leading-relaxed">
              <span className="font-medium">Objetivo:</span> {s.motivo}
            </p>
          )}
          {sugerido ? (
            <div className="mt-1.5">
              <p className="text-sm font-medium">Pensando em:</p>
              <div className="mt-1.5">
                <EspecialistaPreview e={sugerido} />
              </div>
            </div>
          ) : s.desejado?.nome ? (
            // indicado fora do catálogo (inativo/removido): nome sem ficha
            // inventada — o resto o diálogo resolve na seleção
            <p className="mt-1.5 text-sm">
              <span className="font-medium">Pensando em:</span>{" "}
              {s.desejado.nome}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sem nome ainda: a coordenação conecta você com quem faz
              sentido pro tema.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setOpen(true)} disabled={pending}>
              <Check size={15} aria-hidden />
              Quero seguir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={dispensar}
              disabled={pending}
            >
              <X size={15} aria-hidden />
              Agora não
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Confirmar pedido de especialista</DialogTitle>
            <DialogDescription>
              A sugestão é do seu mentor, mas a demanda é sua. Ajuste o que
              quiser antes de enviar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sug-demanda">Tema</Label>
              <Textarea
                id="sug-demanda"
                value={demanda}
                onChange={(e) => setDemanda(e.target.value)}
                minLength={10}
                maxLength={1000}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sug-objetivo">Objetivo (opcional)</Label>
              <Textarea
                id="sug-objetivo"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="O que você quer destravar com essa trilha?"
              />
            </div>
            <div className="space-y-2">
              <Label id="sug-esp-label">Especialista (opcional)</Label>
              <Select
                value={esp}
                onValueChange={(v) => setEsp(v ?? QUALQUER)}
                items={{
                  [QUALQUER]: "Qualquer especialista disponível",
                  ...Object.fromEntries(
                    catalogo.map((e) => [e.id, e.nome_social || e.nome])
                  ),
                }}
              >
                <SelectTrigger
                  id="sug-esp"
                  aria-labelledby="sug-esp-label sug-esp"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={QUALQUER}>
                    Qualquer especialista disponível
                  </SelectItem>
                  {catalogo.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <Avatar
                          nome={e.nome_social || e.nome}
                          src={
                            e.avatar_path ? avatarPublicUrl(e.avatar_path) : null
                          }
                          size={20}
                        />
                        {e.nome_social || e.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {escolhido ? (
                <EspecialistaPreview e={escolhido} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sem nome ainda: a coordenação conecta você com quem faz
                  sentido pro tema.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              disabled={pending || demanda.trim().length < 10}
            >
              {pending ? "Enviando…" : "Enviar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
