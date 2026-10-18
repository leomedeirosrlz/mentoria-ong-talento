"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, HandHeart, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { abrirChamado } from "@/lib/actions-chamados";
import { CHAMADO_CATEGORIA_LABEL } from "@/lib/ciclo";
import type { ChamadoCategoria } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Dialog de abertura de chamado — mesmo canal pros 4 papéis (mock v4).
// O jovem vê opções na linguagem dele; mentor/equipe veem as 5 categorias.

const CATS_STAFF: ChamadoCategoria[] = [
  "agenda",
  "metodologia",
  "plataforma",
  "urgencia",
  "outro",
];

type OpcaoJovem = "mentor" | "plataforma" | "outra" | "urgente";
const OPCOES_JOVEM: { v: OpcaoJovem; rotulo: string; dica: string }[] = [
  { v: "mentor", rotulo: "Com meu mentor", dica: "algo na mentoria não tá legal" },
  { v: "plataforma", rotulo: "Com a plataforma", dica: "algo aqui no app não funciona" },
  { v: "outra", rotulo: "Outra coisa", dica: "qualquer outro assunto" },
  { v: "urgente", rotulo: "É urgente", dica: "preciso de ajuda agora" },
];

export function NovoChamadoDialog({
  papel,
  trigger,
  duplaId,
  duplas,
  onAberto,
}: {
  papel: string;
  trigger: React.ReactNode;
  /** Dupla travada (ficha da dupla) ou select quando vier lista. */
  duplaId?: string;
  duplas?: { id: string; label: string }[];
  onAberto?: (r: { id?: string; numero?: string }) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const jovem = papel === "mentorado";
  const [cat, setCat] = useState<ChamadoCategoria | "">("");
  const [opcaoJovem, setOpcaoJovem] = useState<OpcaoJovem | "">("");
  const [descricaoOutro, setDescricaoOutro] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [dupla, setDupla] = useState(duplaId ?? "");

  const categoriaFinal: ChamadoCategoria | null = jovem
    ? opcaoJovem === "urgente"
      ? "urgencia"
      : opcaoJovem === "plataforma"
        ? "plataforma"
        : opcaoJovem === "mentor" || opcaoJovem === "outra"
          ? "outro"
          : null
    : cat || null;

  // "com meu mentor" → outro com descrição pré-fixada (o "descreva em poucas
  // palavras" do CHECK); "outra coisa" pede o campo
  const descricaoFinal = jovem
    ? opcaoJovem === "mentor"
      ? "Sobre o meu mentor / a mentoria"
      : opcaoJovem === "outra"
        ? descricaoOutro
        : null
    : descricaoOutro;

  const pronto =
    !!categoriaFinal &&
    assunto.trim().length >= 2 &&
    (categoriaFinal !== "outro" || (descricaoFinal?.trim().length ?? 0) >= 2);

  function enviar() {
    start(async () => {
      const r = await abrirChamado({
        categoria: categoriaFinal!,
        assunto: assunto.trim(),
        mensagem: mensagem.trim() || undefined,
        descricaoOutro: descricaoFinal?.trim() || undefined,
        duplaId: jovem ? undefined : dupla || undefined,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        jovem
          ? "Pedido enviado — a equipe foi avisada e responde em até 1 dia útil."
          : `Chamado ${r.numero ?? ""} aberto — a equipe foi avisada.`
      );
      setOpen(false);
      setCat(""); setOpcaoJovem(""); setDescricaoOutro("");
      setAssunto(""); setMensagem("");
      if (!duplaId) setDupla("");
      onAberto?.(r);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as never} />
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandHeart size={19} aria-hidden className="text-[var(--brand-ink)]" />
            {jovem ? "Pedir ajuda" : "Novo chamado"}
          </DialogTitle>
          <DialogDescription>
            {jovem
              ? "Conta pra equipe o que tá acontecendo. Eles respondem em até 1 dia útil — se for urgente, marca a opção."
              : "O pedido entra na fila da equipe com dono e trilha de resposta."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {jovem ? (
            <fieldset>
              <legend className="text-sm font-medium">Sobre o que você precisa?</legend>
              <div className="mt-2 grid gap-2">
                {OPCOES_JOVEM.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setOpcaoJovem(o.v)}
                    aria-pressed={opcaoJovem === o.v}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      opcaoJovem === o.v
                        ? o.v === "urgente"
                          ? "border-destructive/60 bg-destructive/10"
                          : "border-foreground/40 bg-muted/60"
                        : "border-border bg-card hover:bg-muted/40"
                    )}
                  >
                    {o.v === "urgente" && (
                      <Warning size={17} aria-hidden className="shrink-0 text-destructive" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{o.rotulo}</span>
                      <span className="block text-xs text-muted-foreground">{o.dica}</span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="chamado-categoria">Categoria</Label>
              <Select
                value={cat}
                onValueChange={(v) => setCat(v as ChamadoCategoria)}
              >
                <SelectTrigger id="chamado-categoria" className="w-full">
                  <SelectValue placeholder="Escolha a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATS_STAFF.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CHAMADO_CATEGORIA_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {categoriaFinal === "outro" && (!jovem || opcaoJovem === "outra") && (
            <div className="space-y-1.5">
              <Label htmlFor="chamado-outro">Em poucas palavras, sobre o quê?</Label>
              <Input
                id="chamado-outro"
                value={descricaoOutro}
                onChange={(e) => setDescricaoOutro(e.target.value)}
                maxLength={280}
                placeholder="Ex.: devolutiva do especialista"
              />
            </div>
          )}

          {!jovem && duplas && duplas.length > 0 && !duplaId && (
            <div className="space-y-1.5">
              <Label htmlFor="chamado-dupla">Dupla relacionada (opcional)</Label>
              <Select value={dupla} onValueChange={(v) => setDupla(v ?? "")}>
                <SelectTrigger id="chamado-dupla" className="w-full">
                  <SelectValue placeholder="Sem dupla específica" />
                </SelectTrigger>
                <SelectContent>
                  {duplas.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="chamado-assunto">
              {jovem ? "Resumindo, o que aconteceu?" : "Assunto"}
            </Label>
            <Input
              id="chamado-assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              maxLength={200}
              placeholder={
                jovem ? "Ex.: não consigo falar com meu mentor" : "Ex.: registro do encontro 5 não abre"
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chamado-mensagem">
              Detalhes {jovem ? "(pode escrever do seu jeito)" : "(opcional)"}
            </Label>
            <Textarea
              id="chamado-mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              maxLength={5000}
              placeholder={
                jovem
                  ? "Escreve com suas palavras — a equipe lê tudo."
                  : "Contexto, o que já tentou, o que espera…"
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={enviar} disabled={pending || !pronto}>
            {pending && <CircleNotch size={15} className="animate-spin" aria-hidden />}
            {jovem ? "Enviar pedido" : "Abrir chamado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
