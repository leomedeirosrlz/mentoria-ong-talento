"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  CircleNotch,
  DotsThreeVertical,
  EnvelopeSimple,
  LinkSimple,
  Paperclip,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  anexarArquivoMaterial,
  deleteMaterial,
  editarMaterial,
  removerArquivoMaterial,
} from "@/lib/actions";
import { linkSeguro, TRILHA_LEN } from "@/lib/ciclo";
import { createClient } from "@/lib/supabase/client";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EnviarEmailDialog } from "@/components/enviar-email-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

/** Destino do material — o mesmo das linhas/cards: "doc:<slug>" é o
 *  documento nativo (a base muda por casa: /materiais no staff, /jovem no
 *  mentorado); arquivo oficial ganha da url externa; sem os três não há
 *  link pra abrir/copiar. */
function hrefMaterial(m: Material, docBase = "/materiais/documento"): string | null {
  if (m.path?.startsWith("doc:")) return `${docBase}/${m.path.slice(4)}`;
  return m.path ? `/api/material/${m.id}` : linkSeguro(m.url);
}

/** Link compartilhável: material com path copia a rota interna absoluta
 *  (ela 302→signed URL exige login do papel certo — compartilhar com quem
 *  não é da audiência cai no 404 honesto); url externa copia como está.
 *  Mesma régua de erro do CopiarLinkAvaliacao: sem clipboard API (contexto
 *  não-seguro/permissão negada) ou falha → toast de erro, não silêncio. */
async function copiarLinkMaterial(m: Material, docBase?: string) {
  const href = hrefMaterial(m, docBase);
  if (!href) return;
  const texto = m.path ? `${window.location.origin}${href}` : href;
  if (!navigator.clipboard?.writeText) {
    toast.error("Não consegui copiar o link.");
    return;
  }
  try {
    await navigator.clipboard.writeText(texto);
    toast.success("Link copiado.");
  } catch {
    toast.error("Não consegui copiar o link.");
  }
}

/** Gatilho ⋯ — padrão pdm-arvore: ghost icon size-11 (toque) → size-8. */
function TriggerAcoes({ titulo, pending }: { titulo: string; pending?: boolean }) {
  return (
    <DropdownMenuTrigger
      aria-label={`Ações de "${titulo}"`}
      aria-busy={pending || undefined}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "size-11 shrink-0 sm:size-8"
      )}
    >
      {pending ? (
        <CircleNotch size={18} className="animate-spin" aria-hidden />
      ) : (
        <DotsThreeVertical size={18} weight="bold" aria-hidden />
      )}
    </DropdownMenuTrigger>
  );
}

/** ⋯ somente-leitura do material — mentor/supervisor/especialista no hub e
 *  o jovem nos cards do acervo: a linha/card inteiro já é o "Abrir"; aqui
 *  ficam os gestos secundários. Sem destino ("em breve") não renderiza —
 *  não há link pra abrir nem copiar. */
export function MaterialMenu({
  material,
  docBase,
}: {
  material: Material;
  /** casa do documento nativo — "/jovem/materiais/documento" pro acervo do
   *  jovem (a rota do staff expulsa o papel dele); default é a do app. */
  docBase?: string;
}) {
  const href = hrefMaterial(material, docBase);
  if (!href) return null;
  return (
    <DropdownMenu>
      <TriggerAcoes titulo={material.titulo} />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
        >
          <ArrowSquareOut size={16} data-icon="inline-start" aria-hidden />
          Abrir em nova aba
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copiarLinkMaterial(material, docBase)}>
          <LinkSimple size={16} data-icon="inline-start" aria-hidden />
          Copiar link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MaterialActions({ material, maxEncontro }: { material: Material; maxEncontro?: number }) {
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  // excluir via item do menu — o dialog de confirmação é controlado (mesmo
  // padrão dos encaminhamentos: o ConfirmDeleteButton sem trigger próprio)
  const [excluindo, setExcluindo] = useState(false);
  // audiência controlada — o teto de "encontro" segue a trilha dela
  const [audiencia, setAudiencia] = useState(material.audiencia);
  const maxEncontroSel =
    audiencia === "especialista" ? TRILHA_LEN.especialista : (maxEncontro ?? 99);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const href = hrefMaterial(material);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // limpa o input pra escolher o mesmo arquivo de novo disparar onChange
    e.target.value = "";
    if (!file) return;

    if (!TIPOS_ACEITOS.includes(file.type)) {
      toast.error("Formato não aceito. Use PDF, PNG, JPG ou WebP.");
      return;
    }
    if (file.size > LIMITE_BYTES) {
      toast.error("O arquivo passa de 20 MB. Envie uma versão menor.");
      return;
    }

    start(async () => {
      try {
        const supabase = createClient();
        const pathAntigo = material.path;
        const path = `materiais/${crypto.randomUUID()}-${saneiaNome(file.name)}`;

        // 1) o path entra na row ANTES do upload — a policy de INSERT do storage
        //    só aceita objeto cujo name já exista como path em materiais
        const res = await anexarArquivoMaterial(material.id, path);
        if (res?.error) {
          toast.error(res.error);
          return;
        }

        // 2) o arquivo em si
        const { error: upError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file);
        if (upError) {
          // restaura a referência anterior — sem o objeto o path novo ficaria morto
          const rest = pathAntigo
            ? await anexarArquivoMaterial(material.id, pathAntigo)
            : await removerArquivoMaterial(material.id);
          toast.error(
            rest?.error
              ? "Falha ao enviar o arquivo. Anexe de novo."
              : "Falha ao enviar o arquivo. Tente de novo."
          );
          return;
        }

        // 3) troca concluída — remove o objeto antigo pra não ficar órfão no bucket
        if (pathAntigo) await supabase.storage.from(BUCKET).remove([pathAntigo]);

        toast.success(pathAntigo ? "Arquivo substituído." : "Arquivo anexado.");
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  async function remover(m: Material): Promise<{ error?: string; ok?: boolean }> {
    // objeto primeiro: o delete da row depois não deixa arquivo órfão no bucket
    if (m.path) {
      const supabase = createClient();
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([m.path]);
      if (storageError) return { error: "Não foi possível remover o arquivo." };
    }
    return deleteMaterial(m.id);
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPick}
      />
      {/* um ⋯ só no lugar da fileira de botões (REALIZA-185): a linha/card
          já é o "Abrir"; as secundárias vivem aqui — mesmo padrão da árvore
          do PDM (ação perigosa por último) */}
      <DropdownMenu>
        <TriggerAcoes titulo={material.titulo} pending={pending} />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <PencilSimple size={16} data-icon="inline-start" aria-hidden />
            Editar material
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip size={16} data-icon="inline-start" aria-hidden />
            {material.path ? "Trocar arquivo" : "Anexar arquivo"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEmailOpen(true)}>
            <EnvelopeSimple size={16} data-icon="inline-start" aria-hidden />
            Enviar por e-mail
          </DropdownMenuItem>
          {href && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  window.open(href, "_blank", "noopener,noreferrer")
                }
              >
                <ArrowSquareOut size={16} data-icon="inline-start" aria-hidden />
                Abrir em nova aba
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copiarLinkMaterial(material)}>
                <LinkSimple size={16} data-icon="inline-start" aria-hidden />
                Copiar link
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setExcluindo(true)}
          >
            <Trash size={16} data-icon="inline-start" aria-hidden />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteButton
        open={excluindo}
        onOpenChange={setExcluindo}
        titulo={`Excluir "${material.titulo}"?`}
        descricao={
          material.path
            ? "O material e o arquivo anexado saem da biblioteca de todos os perfis. A exclusão é definitiva."
            : "O material sai da biblioteca de todos os perfis. A exclusão é definitiva."
        }
        sucesso={`Material "${material.titulo}" excluído.`}
        onConfirm={() => remover(material)}
      />

      {/* metadados do material — o arquivo em si troca pelo clip do menu */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          // Select de audiência é defaultValue — sem o reset o estado fica
          // à frente do que ele exibe quando o dialog reabre
          if (!o) setAudiencia(material.audiencia);
        }}
      >
        {/* mesmo teto do dialog de criação — os dois grids de 2 colunas
            (tipo×audiência, encontro×url) respiram melhor que no md */}
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Editar material</DialogTitle>
            <DialogDescription>
              Título, descrição, tipo e o encontro a que o material pertence.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                try {
                  const res = await editarMaterial(material.id, fd);
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success("Material atualizado.");
                    setEditOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
                }
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="mat-titulo">Título</Label>
              <Input id="mat-titulo" name="titulo" required defaultValue={material.titulo} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mat-descricao">Descrição</Label>
              <Textarea id="mat-descricao" name="descricao" rows={2} defaultValue={material.descricao ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label id="mat-tipo-label">Tipo</Label>
                <Select name="tipo" defaultValue={material.tipo}>
                  <SelectTrigger aria-labelledby="mat-tipo-label"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label id="mat-aud-label">Quem recebe</Label>
                <Select
                  name="audiencia"
                  defaultValue={material.audiencia}
                  onValueChange={(v) => setAudiencia((v ?? material.audiencia) as Material["audiencia"])}
                >
                  <SelectTrigger aria-labelledby="mat-aud-label"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIENCIA_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mat-encontro">Encontro (nº, opcional)</Label>
                <Input
                  id="mat-encontro" name="encontro_num" type="number"
                  inputMode="numeric"
                  min={1} max={maxEncontroSel}
                  defaultValue={material.encontro_num ?? ""}
                />
                {audiencia === "todos" && (
                  <p className="text-xs text-muted-foreground">
                    Pro jovem, libera quando a dupla chegar no encontro.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mat-url">Link externo</Label>
                <Input
                  id="mat-url" name="url" type="url"
                  placeholder="https://…"
                  defaultValue={material.url ?? ""}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* envio manual por e-mail — a audiência natural do material vem
          marcada; MaterialActions só renderiza pra coordenação */}
      <EnviarEmailDialog
        materialId={material.id}
        tituloMaterial={material.titulo}
        audienciaPadrao={material.audiencia}
        tipoMaterial={material.tipo}
        encontroNum={material.encontro_num}
        open={emailOpen}
        onOpenChange={setEmailOpen}
      />
    </>
  );
}
