"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { deleteMaterial, salvarMaterial } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// labels registradas nos Selects — sem elas o trigger fechado mostra o valor
// cru do enum ("dpp", "coordenacao")
const TIPO_LABEL = {
  guia: "Guia",
  template: "Modelo",
  conteudo: "Conteúdo",
  link: "Link",
} as const;
const AUDIENCIA_LABEL = {
  todos: "Todos",
  dpp: "Mentores DPP",
  especialista: "Mentores especialistas",
  coordenacao: "Coordenação",
} as const;

const LIMITE_BYTES = 20 * 1024 * 1024;
const BUCKET = "materiais";
// allowlist explícita — image/* admitiria SVG (conteúdo ativo) e HEIC (não renderiza)
const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const ACCEPT = TIPOS_ACEITOS.join(",");

/** Nome do arquivo entra no path do storage — fica em ASCII seguro. */
function saneiaNome(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpo || "arquivo";
}

export function NovoMaterialDialog({ maxEncontro }: { maxEncontro: number }) {
  const [open, setOpen] = useState(false);
  const [destino, setDestino] = useState<"link" | "arquivo">("arquivo");
  const [pending, start] = useTransition();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const titulo = String(fd.get("titulo") ?? "").trim();
    const file = destino === "arquivo" ? fileRef.current?.files?.[0] : undefined;

    if (destino === "arquivo" && !file) {
      toast.error("Escolha o arquivo (PDF ou imagem) — ou mude o destino para link.");
      return;
    }
    if (file) {
      if (!TIPOS_ACEITOS.includes(file.type)) {
        toast.error("Formato não aceito — use PDF, PNG, JPG ou WebP.");
        return;
      }
      if (file.size > LIMITE_BYTES) {
        toast.error("O arquivo passa de 20 MB — envie uma versão menor.");
        return;
      }
      // path antes do submit: a row de materiais precisa nascer com ele — a
      // policy de INSERT do storage só aceita objeto com path = name na row
      fd.set("path", `materiais/${crypto.randomUUID()}-${saneiaNome(file.name)}`);
    }

    start(async () => {
      try {
        const res = await salvarMaterial(fd);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        if (file) {
          const path = fd.get("path") as string;
          const supabase = createClient();
          const { error: upError } = await supabase.storage
            .from(BUCKET)
            .upload(path, file);
          if (upError) {
            // sem o arquivo a row ficaria com um path morto — desfaz
            if (res?.id) await deleteMaterial(res.id);
            toast.error("Falha ao enviar o arquivo — o material não foi salvo.");
            return;
          }
        }
        toast.success(titulo ? `"${titulo}" adicionado aos materiais.` : "Material adicionado.");
        setOpen(false);
        // fecha programático não passa pelo onOpenChange — reseta aqui também
        setDestino("arquivo");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // fechou → destino volta pro padrão e o arquivo escolhido não fica preso
        if (!o) {
          setDestino("arquivo");
          if (fileRef.current) fileRef.current.value = "";
        }
      }}
    >
      <DialogTrigger render={<Button size="sm"><Plus size={16} /> Novo material</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar material</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" name="titulo" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" name="descricao" rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label id="mat-tipo-label">Tipo</Label>
              <Select name="tipo" defaultValue="guia" items={TIPO_LABEL}>
                <SelectTrigger id="mat-tipo-select" aria-labelledby="mat-tipo-label mat-tipo-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label id="mat-audiencia-label">Quem recebe</Label>
              <Select name="audiencia" defaultValue="todos" items={AUDIENCIA_LABEL}>
                <SelectTrigger id="mat-audiencia-select" aria-labelledby="mat-audiencia-label mat-audiencia-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AUDIENCIA_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-none">Como publicar</legend>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={destino === "arquivo" ? "secondary" : "outline"}
                aria-pressed={destino === "arquivo"}
                onClick={() => setDestino("arquivo")}
              >
                Arquivo
              </Button>
              <Button
                type="button"
                variant={destino === "link" ? "secondary" : "outline"}
                aria-pressed={destino === "link"}
                onClick={() => setDestino("link")}
              >
                Link externo
              </Button>
            </div>
            {destino === "arquivo" ? (
              <>
                {/* sem name: o arquivo não vai no FormData — sobe direto pro storage */}
                <Input
                  ref={fileRef}
                  id="arquivo"
                  type="file"
                  accept={ACCEPT}
                  aria-label="Arquivo do material (PDF ou imagem)"
                  className="h-auto cursor-pointer py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-medium"
                />
                <p className="text-xs text-muted-foreground">
                  PDF ou imagem, até 20 MB. O arquivo é servido por link temporário — só quem tem acesso ao material abre.
                </p>
              </>
            ) : (
              <Input id="url" name="url" type="url" required placeholder="https://…" />
            )}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="encontro_num">Encontro relacionado</Label>
            <Input id="encontro_num" name="encontro_num" type="number" min={1} max={maxEncontro} inputMode="numeric" placeholder="-" />
            <p className="text-xs text-muted-foreground">
              Opcional — agrupa o material na seção daquele encontro na biblioteca.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : "Adicionar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
