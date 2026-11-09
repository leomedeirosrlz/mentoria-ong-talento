"use client";

import { useState, useTransition } from "react";
import {
  CaretDown,
  ChatsCircle,
  CircleNotch,
  Lightning,
  Monitor,
  Tag,
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
import { CAT_ICON } from "@/components/chamados-shared";

// Dialog de abertura de chamado — mesmo canal pros 4 papéis. O jovem vê
// opções na linguagem dele; mentor/equipe veem as 5 categorias. No celular
// abre como folha de baixo, com o envio sempre à mão.

const CATS_STAFF: ChamadoCategoria[] = [
  "agenda",
  "metodologia",
  "plataforma",
  "outro",
  "urgencia",
];

type OpcaoJovem = "mentor" | "plataforma" | "outra" | "urgente";
const OPCOES_JOVEM: {
  v: OpcaoJovem;
  rotulo: string;
  Icone: typeof Tag;
}[] = [
  { v: "mentor", rotulo: "Com meu mentor", Icone: ChatsCircle },
  { v: "plataforma", rotulo: "Com o app", Icone: Monitor },
  { v: "outra", rotulo: "Outra coisa", Icone: Tag },
  { v: "urgente", rotulo: "É urgente", Icone: Lightning },
];

/** Chip de categoria: urgência ganha tinta própria (ícone + borda) pra ser
 *  vista de longe; o resto é neutro, ativo em tinta escura. */
function chipCls(ativo: boolean, urgente: boolean) {
  return cn(
    "h-auto min-h-11 gap-1.5 rounded-full px-3 font-medium sm:min-h-8",
    ativo
      ? urgente
        ? "border-destructive bg-destructive text-white hover:bg-destructive hover:text-white"
        : "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background"
      : urgente
        ? "border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
        : "text-muted-foreground"
  );
}

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
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const jovem = papel === "mentorado";
  const [cat, setCat] = useState<ChamadoCategoria | "">("");
  const [opcaoJovem, setOpcaoJovem] = useState<OpcaoJovem | "">("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [dupla, setDupla] = useState(duplaId ?? "");
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const temDuplas = !jovem && !duplaId && !!duplas && duplas.length > 0;

  const categoriaFinal: ChamadoCategoria | null = jovem
    ? opcaoJovem === "urgente"
      ? "urgencia"
      : opcaoJovem === "plataforma"
        ? "plataforma"
        : opcaoJovem === "mentor" || opcaoJovem === "outra"
          ? "outro"
          : null
    : cat || null;

  // o CHECK do banco exige descricao_outro em "outro": em vez de pedir o
  // assunto duas vezes, ele mesmo vira a descrição ("com meu mentor" tem
  // a dele fixa, que a equipe usa pra triar)
  const descricaoFinal =
    categoriaFinal !== "outro"
      ? undefined
      : jovem && opcaoJovem === "mentor"
        ? "Sobre o meu mentor / a mentoria"
        : assunto.trim();

  const pronto = !!categoriaFinal && assunto.trim().length >= 2;

  function limpar() {
    setCat("");
    setOpcaoJovem("");
    setAssunto("");
    setMensagem("");
    setMaisOpcoes(false);
    if (!duplaId) setDupla("");
  }

  function enviar() {
    if (!pronto) return;
    start(async () => {
      const r = await abrirChamado({
        categoria: categoriaFinal!,
        assunto: assunto.trim(),
        mensagem: mensagem.trim() || undefined,
        descricaoOutro: descricaoFinal || undefined,
        duplaId: jovem ? undefined : dupla || undefined,
      }).catch(() => null);
      // rede caída: o texto fica no form pra tentar de novo
      if (!r) {
        toast.error("Sem conexão. Tente de novo.");
        return;
      }
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
      limpar();
      onAberto?.(r);
      // abrirChamado revalida as telas de chamado: a resposta da action já
      // traz a página atual re-renderizada
    });
  }

  const duplaLabel = duplas?.find((d) => d.id === dupla)?.label;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as never} />
      <DialogContent
        size="lg"
        className={cn(
          // celular: folha presa embaixo, cantos só em cima, desliza da borda
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[92dvh] max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:data-open:zoom-in-100 max-sm:data-open:slide-in-from-bottom max-sm:data-closed:zoom-out-100 max-sm:data-closed:slide-out-to-bottom"
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {jovem ? "Pedir ajuda" : "Novo chamado"}
          </DialogTitle>
        </DialogHeader>

        <form
          id="novo-chamado-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="chamado-assunto">
              {jovem ? "O que aconteceu?" : "Assunto"}
            </Label>
            <Input
              id="chamado-assunto"
              autoFocus
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              maxLength={200}
              placeholder={
                jovem
                  ? "Ex.: não consigo falar com meu mentor"
                  : "Ex.: registro do encontro 5 não abre"
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chamado-mensagem">
              Detalhes{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="chamado-mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder={
                jovem
                  ? "Conte do seu jeito. A equipe lê tudo."
                  : "Contexto, o que já tentou, o que espera"
              }
            />
          </div>

          <fieldset>
            <legend className="text-sm font-medium">
              {jovem ? "Sobre o quê?" : "Categoria"}
            </legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {jovem
                ? OPCOES_JOVEM.map(({ v, rotulo, Icone }) => (
                    <Button
                      key={v}
                      type="button"
                      variant="outline"
                      aria-pressed={opcaoJovem === v}
                      onClick={() => setOpcaoJovem(v)}
                      className={chipCls(opcaoJovem === v, v === "urgente")}
                    >
                      <Icone
                        weight={v === "urgente" ? "fill" : "regular"}
                        aria-hidden
                      />
                      {rotulo}
                    </Button>
                  ))
                : CATS_STAFF.map((c) => {
                    const Icone = CAT_ICON[c];
                    const urg = c === "urgencia";
                    return (
                      <Button
                        key={c}
                        type="button"
                        variant="outline"
                        aria-pressed={cat === c}
                        onClick={() => setCat(c)}
                        className={chipCls(cat === c, urg)}
                      >
                        <Icone weight={urg ? "fill" : "regular"} aria-hidden />
                        {CHAMADO_CATEGORIA_LABEL[c]}
                      </Button>
                    );
                  })}
            </div>
            {/* confiança do jovem: o mentor não lê o que ele escreve aqui */}
            {jovem && opcaoJovem === "mentor" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Seu mentor não vê este pedido. Só a equipe da Realiza.vc.
              </p>
            )}
          </fieldset>

          {temDuplas && (
            <div>
              {!maisOpcoes ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={false}
                  onClick={() => setMaisOpcoes(true)}
                  className="-ml-2.5 text-muted-foreground"
                >
                  {duplaLabel ? `Dupla: ${duplaLabel}` : "Mais opções"}
                  <CaretDown aria-hidden />
                </Button>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="chamado-dupla">
                    Dupla relacionada{" "}
                    <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Select
                    value={dupla}
                    // sem items o trigger fechado mostra o value cru (uuid)
                    items={Object.fromEntries(duplas!.map((d) => [d.id, d.label]))}
                    onValueChange={(v) => setDupla(v ?? "")}
                  >
                    <SelectTrigger id="chamado-dupla" className="w-full">
                      <SelectValue placeholder="Sem dupla específica" />
                    </SelectTrigger>
                    <SelectContent>
                      {duplas!.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </form>

        <DialogFooter
          sticky
          className="max-sm:-mx-4 max-sm:rounded-none max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <Button
            type="button"
            variant="outline"
            className="max-sm:hidden"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="novo-chamado-form"
            disabled={pending || !pronto}
          >
            {pending && <CircleNotch className="animate-spin" aria-hidden />}
            {jovem ? "Enviar pedido" : "Abrir chamado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
