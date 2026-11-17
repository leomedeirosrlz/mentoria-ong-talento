"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Desktop, DeviceMobile, Eye } from "@phosphor-icons/react";
import type { FormularioCampo, FormularioSistema } from "@/lib/forms/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

// o form público inteiro só é útil quando o dialog abre — chunk sob demanda
const FormularioPublico = dynamic(() =>
  import("@/app/f/[token]/formulario-publico").then(
    (m) => m.FormularioPublico
  )
);

/** Pré-visualização do form público na ficha — o coord manda links pra
 *  dezenas de pessoas sem nunca ter visto a página. Renderiza o próprio
 *  FormularioPublico com `preview` (campos vivos, envio desligado).
 *  Quem recebe o link abre quase sempre no celular: o toggle fixa a
 *  moldura em ~390px e o form se mede pelo container (as regras
 *  responsivas dele são container queries, não viewport). */
export function FormularioPreview({
  titulo,
  descricao,
  campos,
  sistema,
}: {
  titulo: string;
  descricao: string | null;
  campos: FormularioCampo[];
  sistema?: FormularioSistema | null;
}) {
  const [celular, setCelular] = useState(true);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Eye aria-hidden />
            Pré-visualizar
          </Button>
        }
      />
      <DialogContent size="2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>Pré-visualização</DialogTitle>
              <DialogDescription>
                É assim que a página aparece pra quem recebe o link. Os
                campos respondem, mas o envio fica desligado nesta prévia.
              </DialogDescription>
            </div>
            {/* moldura do aparelho: celular é o caso real (WhatsApp);
                os breakpoints internos do form leem o container */}
            <div
              role="group"
              aria-label="Tamanho da tela da prévia"
              className="flex shrink-0 rounded-full bg-muted p-0.5"
            >
              {(
                [
                  ["celular", "Celular", DeviceMobile],
                  ["desktop", "Computador", Desktop],
                ] as const
              ).map(([modo, rotulo, Icone]) => (
                <button
                  key={modo}
                  type="button"
                  aria-pressed={celular === (modo === "celular")}
                  onClick={() => setCelular(modo === "celular")}
                  className={cn(
                    "flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                    celular === (modo === "celular")
                      ? "bg-card text-foreground shadow-[var(--shadow-border)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icone size={14} aria-hidden />
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>
        {/* @container + min-w-0: o conteúdo do instrumento se mede pelo
            espaço do dialog, não pela viewport (o popup é grid — sem o
            min-w-0 o item adota o min-content do texto e estoura a 390px).
            O form público é o mesmo do /f, que também é container. */}
        <div className="@container min-w-0">
          <div
            className={cn(
              "mx-auto w-full transition-[max-width] duration-200",
              celular && "max-w-[390px]"
            )}
          >
            {/* o chrome da página real — o link abre com a marca no topo */}
            <header className="mb-5">
              <Logo size="sm" />
              <p className="mt-1 text-xs text-muted-foreground">
                Programa de Mentoria Social
              </p>
            </header>
            <FormularioPublico
              token="preview"
              titulo={titulo}
              descricao={descricao}
              campos={campos}
              // nome de exemplo pra saudação "Olá, …" aparecer como no link real
              destinatario="Ana"
              sistema={sistema}
              preview
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
