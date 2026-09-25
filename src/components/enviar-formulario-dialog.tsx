"use client";

import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import type { ReactElement } from "react";
import { CircleNotch, PaperPlaneTilt } from "@phosphor-icons/react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import {
  gerarLinksParaDupla,
  type LinkPronto,
} from "@/lib/actions-formularios";
import { DestinoCheckRow } from "@/components/forms/destino-check-row";
import {
  LinksProntos,
  type LinkProntoItem,
} from "@/components/forms/links-prontos";
import { ValidadeLinks } from "@/components/forms/validade-links";
import {
  msgLinkWhatsApp,
  useOrigem,
} from "@/components/forms/link-shared";
import { fade, T } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { normaliza } from "@/lib/utils";
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
  // origem do deploy depois do mount — SSR/hidratação emitem o texto do
  // WhatsApp com URL relativa e o absoluto entra na re-render seguinte
  const origem = useOrigem();

  const formSel = formularios.find((f) => f.id === formId) ?? null;
  const nDestinos = Number(para.mentor) + Number(para.mentorado);

  const itensProntos = useMemo<LinkProntoItem[]>(
    () =>
      (links ?? []).map((l) => {
        const p = l.tipo === "profile" ? mentor : mentorado;
        return {
          key: l.token,
          nome: p.nome,
          token: l.token,
          whatsapp: p.whatsapp,
          mensagem: msgLinkWhatsApp(
            formSel?.titulo ?? "o formulário",
            p.nome,
            l.token,
            origem
          ),
          validade: l.expira_em
            ? `até ${new Date(l.expira_em).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                timeZone: "America/Sao_Paulo",
              })}`
            : null,
          duplaId,
          t: "contato",
        };
      }),
    [links, mentor, mentorado, formSel, duplaId, origem]
  );

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
        toast.error("Sem conexão. Tente de novo.");
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
            Cada destinatário recebe um link único e de uso único. A resposta
            fica vinculada a essa dupla.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait" initial={false}>
          {links ? (
            <motion.div key="prontos" {...fade} transition={T.enter}>
              <LinksProntos
                itens={itensProntos}
                onOutros={() => setLinks(null)}
              />
            </motion.div>
          ) : formularios.length === 0 ? (
            <motion.p
              key="vazio"
              {...fade}
              transition={T.enter}
              className="text-sm text-muted-foreground"
            >
              Nenhum formulário ativo. Crie um em{" "}
              <Link
                href="/formularios"
                className="underline underline-offset-2"
              >
                Formulários
              </Link>{" "}
              e volte pra enviar daqui.
            </motion.p>
          ) : (
            <motion.div
              key="form"
              {...fade}
              transition={T.enter}
              className="space-y-4"
            >
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
                          <Badge
                            variant="outline"
                            className="ml-1.5 border-[var(--brand-lime)]/60 bg-[var(--brand-lime)]/10"
                          >
                            oficial · {SISTEMA_LABEL[f.sistema]}
                          </Badge>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
                      <DestinoCheckRow
                        nome={d.p.nome}
                        detalhe={d.rotulo}
                        checked={para[d.k]}
                        onToggle={() =>
                          setPara((s) => ({ ...s, [d.k]: !s[d.k] }))
                        }
                      />
                    </li>
                  ))}
                </ul>
              </fieldset>

              <ValidadeLinks value={validade} onChange={setValidade} />

              <DialogFooter>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
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
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
