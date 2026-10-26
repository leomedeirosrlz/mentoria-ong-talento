"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarBlank,
  CircleNotch,
  GraduationCap,
  HandHeart,
  Info,
  Lightning,
  Monitor,
  Tag,
  Warning,
} from "@phosphor-icons/react";
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

/** Grade de categorias do mock v5: card com ícone + rótulo + dica curta, e a
 *  linha de contexto muda conforme a escolha (urgência avisa todo mundo,
 *  plataforma fica com a coordenação). */
const CAT_DICA: Record<ChamadoCategoria, string> = {
  agenda: "encontro, remarcação, local",
  metodologia: "condução, guia, materiais",
  plataforma: "algo no app não funciona",
  urgencia: "precisa de resposta hoje",
  outro: "qualquer outro assunto",
};

const CAT_ICONE = {
  agenda: CalendarBlank,
  metodologia: GraduationCap,
  plataforma: Monitor,
  urgencia: Lightning,
  outro: Tag,
} as const;

const CAT_AVISO: Record<ChamadoCategoria, string> = {
  agenda: "Entra na fila: quem assumir primeiro trata.",
  metodologia: "Entra na fila: quem assumir primeiro trata.",
  plataforma: "Vai direto pra coordenação. Conteúdo técnico não passa pela supervisão.",
  urgencia: "Coordenação e supervisão são avisadas na hora.",
  outro: "Entra na fila: quem assumir primeiro trata.",
};

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
          ? "Pedido enviado. A equipe foi avisada e responde em até 1 dia útil."
          : `Chamado ${r.numero ?? ""} aberto. A equipe foi avisada.`
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
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandHeart size={19} aria-hidden className="text-foreground" />
            {jovem ? "Pedir ajuda" : "Novo chamado"}
          </DialogTitle>
          <DialogDescription>
            {jovem
              ? "Conta pra equipe o que tá acontecendo. A equipe recebe na hora e responde em até 1 dia útil."
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
              {opcaoJovem === "mentor" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Seu mentor não vê este pedido. Só a equipe da Realiza.vc.
                </p>
              )}
              {opcaoJovem === "urgente" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {CAT_AVISO.urgencia}
                </p>
              )}
            </fieldset>
          ) : (
            <fieldset>
              <legend className="text-sm font-medium">Categoria</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATS_STAFF.map((c) => {
                  const Icone = CAT_ICONE[c];
                  const urg = c === "urgencia";
                  return (
                    <label
                      key={c}
                      className={cn(
                        "relative flex min-h-20 cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-ring",
                        cat === c
                          ? urg
                            ? "border-destructive/50 bg-destructive/5"
                            : "border-foreground/40 bg-muted/60"
                          : "border-border bg-card hover:bg-muted/40"
                      )}
                    >
                      <input
                        type="radio"
                        name="chamado-cat"
                        value={c}
                        checked={cat === c}
                        onChange={() => setCat(c)}
                        className="sr-only"
                      />
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <Icone
                          size={14}
                          aria-hidden
                          className={urg ? "text-destructive" : "text-muted-foreground"}
                        />
                        {CHAMADO_CATEGORIA_LABEL[c]}
                      </span>
                      <span className="text-[11px] leading-tight text-muted-foreground">
                        {CAT_DICA[c]}
                      </span>
                    </label>
                  );
                })}
              </div>
              {cat && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {CAT_AVISO[cat]}
                </p>
              )}
            </fieldset>
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
                  ? "Escreve com suas palavras. A equipe lê tudo."
                  : "Contexto, o que já tentou, o que espera…"
              }
            />
          </div>

          {/* autonote do mock — anti-duplicidade: quem escreve registro de
              encontro (o mentor) não precisa abrir chamado à mão pra pedir
              apoio — o flag já abre um sozinho */}
          {papel === "mentor_dpp" && (
            <p className="flex items-start gap-2.5 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--info-text)]">
              <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                <strong>Dica:</strong> ao marcar{" "}
                <strong>“Preciso de apoio”</strong> no registro de um
                encontro, um chamado é aberto automaticamente: você não
                precisa abrir outro.
              </span>
            </p>
          )}
        </div>

        <DialogFooter sticky>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={pending || !pronto}>
            {pending && <CircleNotch size={15} className="animate-spin" aria-hidden />}
            {jovem ? "Enviar pedido" : "Abrir chamado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
