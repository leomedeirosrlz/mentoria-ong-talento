"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { deleteMaterial, salvarMaterial } from "@/lib/actions";
import { TRILHA_LEN } from "@/lib/ciclo";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
// pílula de escolha exclusiva (arquivo × link): radio nativo sr-only dentro
// do label — setas do teclado e leitor de tela de graça. Ativo = pill
// escuro, mesmo idioma de OpcaoPilula em registros-filtros
const PILULA_CLS = cn(
  "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2.5 text-sm transition-colors sm:min-h-9",
  "hover:bg-muted has-checked:border-foreground has-checked:bg-foreground has-checked:font-medium has-checked:text-background",
  "has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background"
);
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

export function NovoMaterialDialog({
  maxEncontro,
  defaultEncontro,
  triggerLabel = "Novo material",
  triggerVariant = "default",
}: {
  maxEncontro: number;
  /** "Adicionar aqui" do hub por encontro (REALIZA-173): o nº já vem
   *  preenchido — segue editável, é só ponto de partida. */
  defaultEncontro?: number;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [destino, setDestino] = useState<"link" | "arquivo">("arquivo");
  // audiência controlada — o teto de "encontro relacionado" segue a trilha
  // dela (5 no especialista, N do ciclo nas demais)
  const [audiencia, setAudiencia] = useState("todos");
  // encontro controlado pelo mesmo motivo (defaultValue deixaria o valor
  // digitado sobreviver ao fechar/reabrir; defaultEncontro é o reset)
  const [encontroNum, setEncontroNum] = useState(
    defaultEncontro?.toString() ?? ""
  );
  // nome do arquivo escolhido — o input real é hidden (padrão dos anexos
  // do app); sem o state o nome ficaria invisível até o submit
  const [fileNome, setFileNome] = useState<string | null>(null);
  const maxEncontroSel =
    audiencia === "especialista" ? TRILHA_LEN.especialista : maxEncontro;
  const [pending, start] = useTransition();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const titulo = String(fd.get("titulo") ?? "").trim();
    const file = destino === "arquivo" ? fileRef.current?.files?.[0] : undefined;

    if (destino === "arquivo" && !file) {
      toast.error("Escolha o arquivo (PDF ou imagem). Ou mude o destino para link.");
      return;
    }
    if (file) {
      if (!TIPOS_ACEITOS.includes(file.type)) {
        toast.error("Formato não aceito. Use PDF, PNG, JPG ou WebP.");
        return;
      }
      if (file.size > LIMITE_BYTES) {
        toast.error("O arquivo passa de 20 MB. Envie uma versão menor.");
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
            toast.error("Falha ao enviar o arquivo. O material não foi salvo.");
            return;
          }
        }
        toast.success(titulo ? `"${titulo}" adicionado aos materiais.` : "Material adicionado.");
        setOpen(false);
        // fecha programático não passa pelo onOpenChange — reseta aqui também
        setDestino("arquivo");
        setAudiencia("todos");
        setEncontroNum(defaultEncontro?.toString() ?? "");
        setFileNome(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // fechou → destino e audiência voltam pro padrão e o arquivo
        // escolhido não fica preso (o Select é defaultValue — sem reset o
        // estado sobrevive e dessincroniza do que ele exibe na reabertura)
        if (!o) {
          setDestino("arquivo");
          setAudiencia("todos");
          setEncontroNum(defaultEncontro?.toString() ?? "");
          setFileNome(null);
          if (fileRef.current) fileRef.current.value = "";
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant={triggerVariant}><Plus size={16} /> {triggerLabel}</Button>} />
      {/* lg: a linha tipo×audiência é grid de 2 colunas — abaixo disso
          os selects lado a lado ficavam apertados */}
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Adicionar material</DialogTitle>
          <DialogDescription>
            O material entra na biblioteca e fica disponível pra quem
            acompanha a trilha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" name="titulo" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              name="descricao"
              rows={2}
              placeholder="O que a pessoa encontra nesse material"
            />
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
              <Select
                name="audiencia"
                defaultValue="todos"
                items={AUDIENCIA_LABEL}
                onValueChange={(v) => setAudiencia(v ?? "todos")}
              >
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
              <label className={PILULA_CLS}>
                <input
                  type="radio"
                  name="destino"
                  value="arquivo"
                  checked={destino === "arquivo"}
                  onChange={() => setDestino("arquivo")}
                  className="sr-only"
                />
                Arquivo
              </label>
              <label className={PILULA_CLS}>
                <input
                  type="radio"
                  name="destino"
                  value="link"
                  checked={destino === "link"}
                  onChange={() => setDestino("link")}
                  className="sr-only"
                />
                Link externo
              </label>
            </div>
            {destino === "arquivo" ? (
              <>
                {/* input real fora da tab order — o botão é o controle
                    (mesmo padrão de anexos-registro/foto-field); o nome do
                    arquivo escolhido aparece ao lado dele */}
                <input
                  ref={fileRef}
                  id="arquivo"
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) =>
                    setFileNome(e.target.files?.[0]?.name ?? null)
                  }
                />
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip data-icon="inline-start" aria-hidden />
                    Escolher arquivo
                  </Button>
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      fileNome ? "text-foreground" : "text-muted-foreground"
                    )}
                    aria-live="polite"
                  >
                    {fileNome ?? "Nenhum arquivo escolhido"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  PDF ou imagem, até 20 MB. O arquivo é servido por link temporário. Só quem tem acesso ao material abre.
                </p>
              </>
            ) : (
              <Input id="url" name="url" type="url" required placeholder="https://…" />
            )}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="encontro_num">Encontro (nº)</Label>
            <Input
              id="encontro_num"
              name="encontro_num"
              type="number"
              min={1}
              max={maxEncontroSel}
              inputMode="numeric"
              value={encontroNum}
              onChange={(e) => setEncontroNum(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Agrupa o material na seção daquele encontro na biblioteca
              {audiencia === "especialista" ? " (a trilha tem 5)" : ""}.
              {audiencia === "todos"
                ? " Pro jovem, libera quando a dupla chegar nele."
                : ""}
            </p>
          </div>
          <DialogFooter sticky>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
