"use client";

import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import type { ReactElement } from "react";
import {
  Check,
  CircleNotch,
  CopySimple,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  gerarLinksParaDupla,
  type LinkPronto,
} from "@/lib/actions-formularios";
import { NudgeButton } from "@/components/nudge-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, normaliza } from "@/lib/utils";
import { SISTEMA_LABEL, type FormularioSistema } from "@/lib/forms/schema";

export type FormularioOpcao = {
  id: string;
  titulo: string;
  /** instrumento oficial do programa (0042) — ganha selo no select e casa
   *  com a sugestão pelo rótulo ("360" acha o sistema avaliacao_360) */
  sistema?: FormularioSistema | null;
};
export type PessoaDestino = {
  id: string;
  nome: string;
  whatsapp: string | null;
};

const VALIDADE_OPCOES = [
  { v: "0", l: "Sem validade" },
  { v: "7", l: "Expira em 7 dias" },
  { v: "15", l: "Expira em 15 dias" },
  { v: "30", l: "Expira em 30 dias" },
  { v: "60", l: "Expira em 60 dias" },
] as const;

const primeiroNome = (n: string) => n.split(" ")[0];

/** URL absoluta do link público — montada no client porque o servidor não
 *  sabe a origem de deploy (mesmo padrão de formulario-links). */
function urlPublica(token: string): string {
  return `${window.location.origin}/f/${token}`;
}

function CopiarLink({ token }: { token: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(urlPublica(token));
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          toast.error("Não consegui copiar — selecione o link manualmente.");
        }
      }}
    >
      {copiado ? (
        <Check aria-hidden className="text-[var(--ok)]" />
      ) : (
        <CopySimple aria-hidden />
      )}
      {copiado ? "Copiado" : "Copiar"}
    </Button>
  );
}

/** Dialog "Enviar formulário" da ficha da dupla — escolhe o form entre os
 *  ativos, marca mentor e/ou mentorado como destinatários e devolve os links
 *  prontos pra copiar ou mandar no WhatsApp. `sugestao` ordena/pré-marca o
 *  form pelo título (o botão "Gerar link de avaliação" do encerramento passa
 *  "360"; o genérico do header não passa nada). */
export function EnviarFormularioDialog({
  formularios,
  duplaId,
  mentor,
  mentorado,
  sugestao,
  trigger,
}: {
  formularios: FormularioOpcao[];
  duplaId: string;
  mentor: PessoaDestino;
  mentorado: PessoaDestino;
  /** trecho do título pra sugerir (ex.: "360") — os que casam vêm primeiro e
   *  o primeiro é pré-selecionado */
  sugestao?: string;
  /** trigger custom — sem ela cai no botão padrão "Enviar formulário" */
  trigger?: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  // ids únicos por instância — o dialog aparece 2x na ficha (header + 360º)
  const uid = useId();
  const formLabelId = `${uid}-form`;
  const validadeLabelId = `${uid}-validade`;
  const ordenados = useMemo(() => {
    if (!sugestao) return formularios;
    const n = normaliza(sugestao);
    // casa pelo título OU pelo selo do instrumento oficial ("360" acha a
    // avaliacao_360 mesmo que o título não traga o número)
    const casam = (f: FormularioOpcao) =>
      normaliza(f.titulo).includes(n) ||
      (f.sistema ? normaliza(SISTEMA_LABEL[f.sistema]).includes(n) : false);
    return [...formularios].sort((a, b) => Number(casam(b)) - Number(casam(a)));
  }, [formularios, sugestao]);
  const [formId, setFormId] = useState("");
  const [para, setPara] = useState({ mentor: true, mentorado: true });
  const [validade, setValidade] = useState("0");
  const [links, setLinks] = useState<LinkPronto[] | null>(null);
  const [pending, start] = useTransition();

  const formSel = formularios.find((f) => f.id === formId) ?? null;
  const nDestinos = Number(para.mentor) + Number(para.mentorado);

  function aoAbrir(o: boolean) {
    setOpen(o);
    if (o) {
      // reabre limpo, com a sugestão (ou o 1º ativo) pré-selecionada
      setLinks(null);
      setFormId(ordenados[0]?.id ?? "");
      setPara({ mentor: true, mentorado: true });
    }
  }

  function gerar() {
    const destinos = (["mentor", "mentorado"] as const).filter((k) => para[k]);
    if (!formId || !destinos.length) return;
    start(async () => {
      let r;
      try {
        r = await gerarLinksParaDupla({
          formularioId: formId,
          duplaId,
          destinos: [...destinos],
          diasValidade: validade === "0" ? null : Number(validade),
        });
      } catch {
        toast.error("Sem conexão — tente de novo.");
        return;
      }
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setLinks(r.links);
      const partes = [];
      if (r.criados)
        partes.push(`${r.criados} ${r.criados === 1 ? "link gerado" : "links gerados"}`);
      if (r.reutilizados)
        partes.push(
          `${r.reutilizados} já ${r.reutilizados === 1 ? "tinha link" : "tinham links"}`
        );
      toast.success(partes.join(" · ") + ".");
    });
  }

  const msgWhatsApp = (p: PessoaDestino, token: string) =>
    `Olá, ${primeiroNome(p.nome)}! A equipe Realiza.vc te convida pra responder "${formSel?.titulo ?? "o formulário"}" — leva poucos minutos: ${urlPublica(token)}`;

  return (
    <Dialog open={open} onOpenChange={aoAbrir}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              <PaperPlaneTilt aria-hidden />
              Enviar formulário
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar formulário</DialogTitle>
          <DialogDescription>
            Cada destinatário recebe um link único e de uso único — a resposta
            fica vinculada a essa dupla.
          </DialogDescription>
        </DialogHeader>

        {links ? (
          <div className="space-y-3">
            <ul className="space-y-2">
              {links.map((l) => {
                const pessoa = l.tipo === "profile" ? mentor : mentorado;
                return (
                  <li
                    key={l.token}
                    className="rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {pessoa.nome}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          /f/{l.token.slice(0, 14)}…
                        </p>
                      </div>
                      <CopiarLink token={l.token} />
                    </div>
                    <div className="mt-2">
                      <NudgeButton
                        telefone={pessoa.whatsapp}
                        mensagem={msgWhatsApp(pessoa, l.token)}
                        duplaId={duplaId}
                        t="contato"
                        label="Enviar no WhatsApp"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLinks(null)}
              >
                Gerar outros links
              </Button>
            </div>
          </div>
        ) : formularios.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum formulário ativo — crie um em{" "}
            <Link href="/formularios" className="underline underline-offset-2">
              Formulários
            </Link>{" "}
            e volte pra enviar daqui.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label id={formLabelId}>Formulário</Label>
              <Select
                value={formId}
                onValueChange={(v) => setFormId(v ?? "")}
                items={Object.fromEntries(
                  ordenados.map((f) => [f.id, f.titulo])
                )}
              >
                <SelectTrigger
                  aria-labelledby={formLabelId}
                  className="w-full"
                >
                  <SelectValue placeholder="Escolha o formulário" />
                </SelectTrigger>
                <SelectContent>
                  {ordenados.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.titulo}
                      {f.sistema && (
                        <span className="ml-1.5 rounded-full bg-[var(--brand-lime)]/20 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                          oficial · {SISTEMA_LABEL[f.sistema]}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Destinatários
              </legend>
              <ul className="space-y-0.5">
                {(
                  [
                    { k: "mentorado", p: mentorado, rotulo: "Mentorado" },
                    { k: "mentor", p: mentor, rotulo: "Mentor" },
                  ] as const
                ).map((d) => (
                  <li key={d.k}>
                    <label
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm transition-colors",
                        "cursor-pointer hover:bg-muted"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={para[d.k]}
                        onChange={() =>
                          setPara((s) => ({ ...s, [d.k]: !s[d.k] }))
                        }
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {d.p.nome}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {d.rotulo}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            <div className="space-y-1.5">
              <Label id={validadeLabelId}>Validade dos links</Label>
              <Select
                value={validade}
                onValueChange={(v) => setValidade(v ?? "0")}
                items={Object.fromEntries(
                  VALIDADE_OPCOES.map((o) => [o.v, o.l])
                )}
              >
                <SelectTrigger
                  aria-labelledby={validadeLabelId}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALIDADE_OPCOES.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={gerar}
                disabled={pending || !formId || nDestinos === 0}
              >
                {pending && (
                  <CircleNotch className="animate-spin" aria-hidden />
                )}
                {nDestinos
                  ? `Gerar ${nDestinos} ${nDestinos === 1 ? "link" : "links"}`
                  : "Escolha os destinatários"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
