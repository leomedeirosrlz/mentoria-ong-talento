"use client";

import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import {
  Check,
  CircleNotch,
  CopySimple,
  EnvelopeSimple,
  PaperPlaneTilt,
  Signature,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import {
  emitirAssinaturasEmLote,
  enviarLinksAssinatura,
  type ItemEmissao,
} from "@/lib/actions-assinaturas";
import {
  msgLinkAssinatura,
  TEMPLATES_POR_TIPO,
  type TipoAlvoAssinatura,
} from "@/lib/documentos/texto";
import type { DocsPessoa } from "@/components/pessoas-listas";
import { useOrigem } from "@/components/forms/use-origem";
import { CopiarLink } from "@/components/forms/copiar-link";
import { NudgeButton } from "@/components/nudge-button";
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
import { cn } from "@/lib/utils";

/** Pessoa elegível como alvo de um documento — o que o checklist precisa:
 *  nome na linha, contatos pra onde o link sai (WhatsApp agora, e-mail no
 *  disparo em massa). */
export type PessoaAlvo = {
  id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
};

/** Os documentos do fluxo de link derivam de TEMPLATES_POR_TIPO (fonte
 *  única em documentos/texto.ts) — o select filtra por pool: termo do
 *  voluntário vai pra profiles, os dois do jovem pra mentorados. */
const DOCS: { slug: string; rotulo: string; tipo: TipoAlvoAssinatura }[] =
  (Object.keys(TEMPLATES_POR_TIPO) as TipoAlvoAssinatura[]).flatMap((tipo) =>
    TEMPLATES_POR_TIPO[tipo].map((t) => ({ slug: t.slug, rotulo: t.rotulo, tipo }))
  );

/** "dd/mm/aaaa" — "emitido em…" da tela de resultado. */
const fmtDia = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));

/** Linha do checklist — mais rica que DestinoCheckRow: carrega o status do
 *  documento ("assinado" trava a linha, "link emitido" reusa) e o badge de
 *  faltantes civis, que é o alerta pra completar a ficha. */
function TermoCheckRow({
  nome,
  status,
  faltantes,
  fichaHref,
  checked,
  onToggle,
}: {
  nome: string;
  /** assinado = travado; pendente = reuso; emitir = ainda não tem link */
  status: "assinado" | "pendente" | "emitir";
  /** labels do que falta na ficha — nunca valores (a página calcula no
   *  servidor dentro do escopo coord) */
  faltantes: string[];
  fichaHref: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const disabled = status === "assinado";
  return (
    <div
      className={cn(
        "min-h-11 rounded-lg px-2 py-1.5 text-sm transition-colors sm:min-h-10",
        disabled
          ? "text-muted-foreground"
          : "cursor-pointer hover:bg-muted"
      )}
    >
      <div className="flex items-center gap-3">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 data-[disabled]:cursor-default">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onToggle}
            className="size-4 shrink-0 accent-primary"
          />
          <span className="min-w-0 flex-1 truncate">{nome}</span>
        </label>
        <span className="flex shrink-0 items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              status === "assinado" &&
                "border-[var(--ok)]/60 text-[var(--ok-text)]",
              status === "pendente" &&
                "border-[var(--warn)]/60 text-[var(--warn-text)]",
              status === "emitir" && "text-muted-foreground"
            )}
          >
            {status === "assinado"
              ? "assinado"
              : status === "pendente"
                ? "link emitido"
                : "emitir"}
          </Badge>
          <Link
            href={fichaHref}
            title="Abrir a ficha pra completar os dados"
            className="inline-flex min-h-8 items-center rounded-md px-1.5 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            <span className="text-xs">ficha</span>
          </Link>
        </span>
      </div>
      {/* lacuna da ficha vira linha própria — na linha do nome ela
          competia por espaço e escondia quem é a pessoa */}
      {status !== "assinado" && faltantes.length > 0 && (
        <p
          title={`Falta: ${faltantes.join(" · ")} — quem assina completa na hora`}
          className="mt-0.5 truncate pl-7 text-xs text-[var(--warn-text)]"
        >
          falta: {faltantes.join(" · ")}
        </p>
      )}
    </div>
  );
}

/** Emissão em massa de termos de assinatura — irmão do EnviarFormularioDialog,
 *  mas o checklist é por pessoa (não por dupla) e a tela de resultado já dá
 *  saída por WhatsApp e e-mail. Montado no header de /pessoas (coord-only):
 *  quem abre já tem pessoas/mentorados + status de docs + faltantes na mão. */
export function EnviarTermosDialog({
  pessoas,
  mentorados,
  docs,
  faltantes,
}: {
  pessoas: PessoaAlvo[];
  mentorados: PessoaAlvo[];
  /** id → status por slug (assinado/pendente) — mesmo mapa dos badges da lista */
  docs: Record<string, DocsPessoa>;
  /** id → slug → labels de faltante — calculado no servidor, nunca valores */
  faltantes: Record<string, Record<string, string[]>>;
}) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const docLabelId = `${uid}-doc`;
  const origem = useOrigem();
  const [pending, start] = useTransition();
  const [enviando, setEnviando] = useState(false);
  /** true depois do disparo de e-mail do lote atual — trava o botão e
   *  vira "Enviado por e-mail" na tela de resultado */
  const [enviado, setEnviado] = useState(false);

  // esconde documento sem pool — coord com zero mentorados não precisa ver
  // "autorização do responsável" girando em tela vazia
  const docsDisponiveis = useMemo(
    () =>
      DOCS.filter((d) =>
        d.tipo === "profile" ? pessoas.length > 0 : mentorados.length > 0
      ),
    [pessoas.length, mentorados.length]
  );
  const [slug, setSlug] = useState("");
  const docSel =
    docsDisponiveis.find((d) => d.slug === slug) ?? docsDisponiveis[0] ?? null;

  const pool = useMemo(
    () => (docSel?.tipo === "profile" ? pessoas : mentorados),
    [docSel, pessoas, mentorados]
  );

  const statusDe = (id: string): "assinado" | "pendente" | "emitir" => {
    const d = docs[id];
    if (!docSel || !d) return "emitir";
    if (d.assinado[docSel.slug]) return "assinado";
    if (d.pendente.includes(docSel.slug)) return "pendente";
    return "emitir";
  };

  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<{
    docTitulo: string;
    itens: ItemEmissao[];
  } | null>(null);

  /** Marca todo mundo que ainda pode receber link — emissão em lote assume
   *  "todos menos quem eu desmarcar" (já-assinado nunca entra). */
  function preencherMarcados(docSlug: string, tipo: TipoAlvoAssinatura) {
    const lista = tipo === "profile" ? pessoas : mentorados;
    setMarcados(
      new Set(
        lista
          .filter((p) => !docs[p.id]?.assinado[docSlug])
          .map((p) => p.id)
      )
    );
  }

  function aoAbrir(o: boolean) {
    setOpen(o);
    if (o) {
      setResultado(null);
      setEnviado(false);
      const d = docsDisponiveis[0] ?? null;
      setSlug(d?.slug ?? "");
      if (d) preencherMarcados(d.slug, d.tipo);
    }
  }

  function trocarDoc(novoSlug: string) {
    setSlug(novoSlug);
    const d = docsDisponiveis.find((x) => x.slug === novoSlug);
    if (d) preencherMarcados(d.slug, d.tipo);
  }

  function toggle(id: string) {
    setMarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function emitir() {
    if (!docSel || marcados.size === 0) return;
    const alvos = [...marcados].map((id) => ({ tipo: docSel.tipo, id }));
    start(async () => {
      let r;
      try {
        r = await emitirAssinaturasEmLote({ slug: docSel.slug, alvos });
      } catch {
        toast.error("Sem conexão. Tente de novo.");
        return;
      }
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setResultado({ docTitulo: r.docTitulo, itens: r.itens });
      setEnviado(false);
      const novos = r.itens.filter((i) => i.link && !i.existente).length;
      const reusos = r.itens.filter((i) => i.link && i.existente).length;
      const partes = [];
      if (novos) partes.push(`${novos} ${novos === 1 ? "link gerado" : "links gerados"}`);
      if (reusos)
        partes.push(`${reusos} ${reusos === 1 ? "reuso" : "reusos"} de link já emitido`);
      if (partes.length) toast.success(partes.join(" · ") + ".");
      else toast.error("Nenhum link emitido — veja cada item na lista.");
    });
  }

  // disparo em massa por e-mail — só pra quem tem link pronto e e-mail
  // cadastrado; quem ficou de fora segue com copiar/WhatsApp manual
  const comEmail = (resultado?.itens ?? []).filter((i) => i.link && i.email);

  async function enviarPorEmail() {
    if (!docSel || !resultado || !comEmail.length) return;
    setEnviando(true);
    try {
      const r = await enviarLinksAssinatura({
        slug: docSel.slug,
        envios: comEmail.map((i) => ({
          para: i.email as string,
          nome: i.nome,
          link: i.link as string,
          destinatario: i.destinatario,
        })),
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setEnviado(true);
      toast.success(
        `${r.enviados} de ${r.destinatarios} ${
          r.destinatarios === 1 ? "e-mail enviado" : "e-mails enviados"
        }.${r.falhas.length ? ` Falha em: ${r.falhas.join(", ")}.` : ""}`
      );
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const [copiouTodos, setCopiouTodos] = useState(false);
  async function copiarTodos() {
    const itens = (resultado?.itens ?? []).filter((i) => i.link);
    if (!itens.length) return;
    try {
      await navigator.clipboard.writeText(
        itens
          .map((i) => `${i.nome}: ${origem}${i.link}`)
          .join("\n")
      );
      setCopiouTodos(true);
      setTimeout(() => setCopiouTodos(false), 2000);
    } catch {
      toast.error("Não consegui copiar. Copie os links um a um.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={aoAbrir}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Signature aria-hidden />
            Enviar termos
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar termos pra assinar</DialogTitle>
          <DialogDescription>
            Cada pessoa recebe um link único por e-mail ou WhatsApp. O link
            vale 30 dias e abre a página de assinatura sem login.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait" initial={false}>
          {resultado ? (
            <motion.div
              key="prontos"
              {...fade}
              transition={T.enter}
              className="min-w-0 space-y-3"
            >
              <p className="text-sm font-medium">
                {resultado.docTitulo} — links prontos
              </p>
              <ul className="scroll-fina max-h-64 space-y-2 overflow-y-auto pr-1">
                {resultado.itens.map((i) => (
                  <li
                    key={i.id}
                    className="rounded-lg border border-input px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {i.assinado
                            ? "já assinado — nada a emitir"
                            : i.link
                              ? `${i.existente ? "link reutilizado" : "link emitido"}${
                                  i.criado_em
                                    ? ` · emitido em ${fmtDia(i.criado_em)}`
                                    : ""
                                }`
                              : "não foi possível emitir"}
                        </p>
                        {i.faltantes.length > 0 && (
                          <p className="mt-0.5 truncate text-xs text-[var(--warn-text)]">
                            falta: {i.faltantes.join(" · ")}
                          </p>
                        )}
                      </div>
                      {i.link && (
                        <CopiarLink
                          token={i.link.split("/").pop() ?? ""}
                          caminho="/assinar"
                        />
                      )}
                    </div>
                    {i.link && (
                      <div className="mt-2">
                        <NudgeButton
                          telefone={i.whatsapp}
                          mensagem={msgLinkAssinatura(
                            docSel?.slug,
                            i.nome,
                            `${origem}${i.link}`
                          )}
                          label="Enviar no WhatsApp"
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* e-mail em massa — um envelope por pessoa, cada um com seu
                  link; quem não tem e-mail cadastrado sai por copiar/WhatsApp */}
              {comEmail.length > 0 && (
                <div className="rounded-lg border border-input bg-muted/40 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    {comEmail.length}{" "}
                    {comEmail.length === 1
                      ? "pessoa tem e-mail cadastrado"
                      : "pessoas têm e-mail cadastrado"}
                    {enviado ? " — enviado." : "."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 w-full sm:w-auto"
                    disabled={enviando || enviado}
                    aria-busy={enviando}
                    onClick={enviarPorEmail}
                  >
                    {enviando ? (
                      <CircleNotch className="animate-spin" aria-hidden />
                    ) : enviado ? (
                      <Check aria-hidden className="text-[var(--ok)]" />
                    ) : (
                      <EnvelopeSimple aria-hidden />
                    )}
                    {enviado
                      ? "Enviado por e-mail"
                      : `Enviar por e-mail (${comEmail.length})`}
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copiarTodos}
                >
                  {copiouTodos ? (
                    <Check aria-hidden className="text-[var(--ok)]" />
                  ) : (
                    <CopySimple aria-hidden />
                  )}
                  {copiouTodos ? "Copiados" : "Copiar todos"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResultado(null);
                    setEnviado(false);
                  }}
                >
                  Emitir pra mais pessoas
                </Button>
              </div>
            </motion.div>
          ) : docsDisponiveis.length === 0 ? (
            <motion.p
              key="vazio"
              {...fade}
              transition={T.enter}
              className="text-sm text-muted-foreground"
            >
              Ninguém cadastrado ainda. Cadastre pessoas e jovens primeiro e
              volte pra enviar daqui.
            </motion.p>
          ) : (
            <motion.div
              key="form"
              {...fade}
              transition={T.enter}
              className="min-w-0 space-y-4"
            >
              <div className="space-y-1.5">
                <Label id={docLabelId}>Documento</Label>
                <Select
                  value={docSel?.slug ?? ""}
                  onValueChange={(v) => trocarDoc(v ?? "")}
                  items={Object.fromEntries(
                    docsDisponiveis.map((d) => [d.slug, d.rotulo])
                  )}
                >
                  <SelectTrigger aria-labelledby={docLabelId} className="w-full">
                    <SelectValue placeholder="Escolha o documento" />
                  </SelectTrigger>
                  <SelectContent>
                    {docsDisponiveis.map((d) => (
                      <SelectItem key={d.slug} value={d.slug}>
                        {d.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <fieldset className="min-w-0">
                <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {docSel?.tipo === "profile" ? "Pessoas" : "Jovens"}
                </legend>
                <ul className="scroll-fina max-h-60 space-y-0.5 overflow-y-auto pr-1">
                  {pool.map((p) => (
                    <li key={p.id}>
                      <TermoCheckRow
                        nome={p.nome}
                        status={statusDe(p.id)}
                        faltantes={
                          docSel ? (faltantes[p.id]?.[docSel.slug] ?? []) : []
                        }
                        fichaHref={`/pessoas/${p.id}`}
                        checked={marcados.has(p.id)}
                        onToggle={() => toggle(p.id)}
                      />
                    </li>
                  ))}
                </ul>
              </fieldset>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Dados faltantes não bloqueiam a emissão — a pessoa completa na
                hora de assinar. Quem já assinou não recebe link de novo.
              </p>

              <DialogFooter>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={emitir}
                  disabled={pending || !docSel || marcados.size === 0}
                  aria-busy={pending}
                >
                  {pending ? (
                    <CircleNotch className="animate-spin" aria-hidden />
                  ) : (
                    <PaperPlaneTilt aria-hidden />
                  )}
                  {marcados.size
                    ? `Gerar ${marcados.size} ${
                        marcados.size === 1 ? "link" : "links"
                      }`
                    : "Escolha as pessoas"}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
