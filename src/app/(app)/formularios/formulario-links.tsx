"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowClockwise,
  CircleNotch,
  Link as LinkIcon,
  MagnifyingGlass,
  PaperPlaneTilt,
  Trash,
} from "@phosphor-icons/react";
import {
  excluirLinkFormulario,
  gerarLinksFormulario,
  reemitirLinkFormulario,
  type DestinoLink,
  type LinkEmitido,
} from "@/lib/forms/actions";
import {
  linkStatus,
  LINK_STATUS_LABEL,
  type FormularioSistema,
} from "@/lib/forms/schema";
import type { LinkResolvido } from "@/lib/forms/queries";
import type { AppRole } from "@/lib/types";
import { NudgeButton } from "@/components/nudge-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CopiarLink } from "@/components/forms/copiar-link";
import { DestinoCheckRow } from "@/components/forms/destino-check-row";
import {
  LinksProntos,
  type LinkProntoItem,
} from "@/components/forms/links-prontos";
import { ValidadeLinks } from "@/components/forms/validade-links";
import {
  msgLinkWhatsApp,
  primeiroNome,
  urlPublica,
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
import { Input } from "@/components/ui/input";
import { cn, normaliza } from "@/lib/utils";

export type DestinoOpcao = {
  tipo: "profile" | "mentorado";
  id: string;
  nome: string;
  whatsapp: string | null;
  /** role do profile ("mentorado" pros jovens) — agrupa o dialog por papel;
   *  a coordenação nem chega aqui (a página a tira dos elegíveis) */
  papel: AppRole | "mentorado" | null;
  /** papel (profiles) ou contexto (mentorado) — chip discreto na lista */
  detalhe: string | null;
};

const keyDe = (d: DestinoOpcao) =>
  `${d.tipo === "profile" ? "p" : "m"}:${d.id}`;

/** Destinatários agrupados por papel (pedido da coordenação: gerar por
 *  cargo). Profiles pré-cadastrados sem papel ainda podem receber form —
 *  caem no último grupo; coordenação não é reconhecida por nenhum. */
const GRUPOS_DESTINO: {
  key: string;
  titulo: string;
  match: (d: DestinoOpcao) => boolean;
}[] = [
  {
    key: "mentor_dpp",
    titulo: "Mentores DPP",
    match: (d) => d.tipo === "profile" && d.papel === "mentor_dpp",
  },
  {
    key: "mentor_especialista",
    titulo: "Mentores especialistas",
    match: (d) => d.tipo === "profile" && d.papel === "mentor_especialista",
  },
  {
    key: "supervisor",
    titulo: "Supervisores",
    match: (d) => d.tipo === "profile" && d.papel === "supervisor",
  },
  {
    key: "mentorado",
    titulo: "Mentorados",
    match: (d) => d.tipo === "mentorado",
  },
  {
    key: "sem_papel",
    titulo: "Sem papel definido",
    match: (d) => d.tipo === "profile" && d.papel == null,
  },
];

const DATA_CURTA = {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
} as const;

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", DATA_CURTA);

/** Reemissão inline de link expirado — mesmo destino, token novo (a action
 *  devolve o token e ele já cai no clipboard). */
function ReemitirLinkButton({
  linkId,
  formularioId,
}: {
  linkId: string;
  formularioId: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await reemitirLinkFormulario(linkId, formularioId);
          if (r.error || !r.token) {
            toast.error(r.error ?? "Não consegui reemitir — tente de novo.");
            return;
          }
          try {
            await navigator.clipboard.writeText(urlPublica(r.token));
            toast.success("Link reemitido e copiado.");
          } catch {
            toast.success("Link reemitido — copie o novo endereço na lista.");
          }
          router.refresh();
        })
      }
    >
      {pending ? (
        <CircleNotch className="animate-spin" aria-hidden />
      ) : (
        <ArrowClockwise aria-hidden />
      )}
      Reemitir
    </Button>
  );
}

export function FormularioLinks({
  formularioId,
  formularioTitulo,
  formularioAtivo,
  formularioSistema,
  links,
  destinatarios,
}: {
  formularioId: string;
  formularioTitulo: string;
  formularioAtivo: boolean;
  /** instrumento oficial (0042) — a 360º ganha nota do wiring no checklist */
  formularioSistema?: FormularioSistema | null;
  links: LinkResolvido[];
  destinatarios: DestinoOpcao[];
}) {
  const [open, setOpen] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [validade, setValidade] = useState<string>("0");
  // links emitidos na sessão do dialog — o estado "links prontos" (A2)
  const [prontos, setProntos] = useState<LinkEmitido[] | null>(null);
  // linha recém-emitida pisca na lista (link genérico)
  const [destaqueId, setDestaqueId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const destaqueTimer = useRef<ReturnType<typeof setTimeout>>(null);
  // origem do deploy depois do mount — SSR/hidratação emitem o texto do
  // WhatsApp com URL relativa e o absoluto entra na re-render seguinte
  const origem = useOrigem();

  useEffect(
    () => () => {
      if (destaqueTimer.current) clearTimeout(destaqueTimer.current);
    },
    []
  );

  // quem já tem link pendente segue selecionável — a action reusa o token e
  // o chip "já tem link" avisa que gerar de novo não cria outro endereço
  const comLinkVigente = useMemo(() => {
    const s = new Set<string>();
    for (const l of links) {
      if (linkStatus(l) !== "pendente") continue;
      if (l.dest_profile_id) s.add(`p:${l.dest_profile_id}`);
      if (l.dest_mentorado_id) s.add(`m:${l.dest_mentorado_id}`);
    }
    return s;
  }, [links]);

  const filtrados = useMemo(() => {
    const n = normaliza(busca.trim());
    if (!n) return destinatarios;
    return destinatarios.filter(
      (d) =>
        normaliza(d.nome).includes(n) || normaliza(d.detalhe).includes(n)
    );
  }, [destinatarios, busca]);

  const grupos = useMemo(
    () =>
      GRUPOS_DESTINO.map((g) => ({ ...g, itens: filtrados.filter(g.match) }))
        .filter((g) => g.itens.length > 0),
    [filtrados]
  );

  // pendentes primeiro — respondidos e expirados fecham a lista
  const linksOrdenados = useMemo(
    () =>
      [...links].sort(
        (a, b) =>
          Number(linkStatus(a) !== "pendente") -
          Number(linkStatus(b) !== "pendente")
      ),
    [links]
  );

  const itensProntos = useMemo<LinkProntoItem[]>(
    () =>
      (prontos ?? []).map((l) => {
        const d = destinatarios.find(
          (x) => x.id === l.dest_id && x.tipo === l.tipo
        );
        const nome =
          d?.nome ?? (l.tipo === "generico" ? "Link genérico" : "Destinatário");
        return {
          key: l.id,
          nome,
          token: l.token,
          whatsapp: d?.whatsapp ?? null,
          mensagem: msgLinkWhatsApp(formularioTitulo, d?.nome, l.token, origem),
          validade: l.expira_em ? `até ${dataCurta(l.expira_em)}` : null,
        };
      }),
    [prontos, destinatarios, formularioTitulo, origem]
  );

  function aoAbrir(o: boolean) {
    setOpen(o);
    if (!o) {
      // fechar limpa a sessão de escolha — reabrir começa do zero
      setSelecionados(new Set());
      setBusca("");
      setProntos(null);
    }
  }

  function toggle(key: string) {
    setSelecionados((s) => {
      const out = new Set(s);
      if (out.has(key)) out.delete(key);
      else out.add(key);
      return out;
    });
  }

  function toggleGrupo(itens: DestinoOpcao[], marcar: boolean) {
    setSelecionados((s) => {
      const out = new Set(s);
      for (const d of itens) {
        const key = keyDe(d);
        if (marcar) out.add(key);
        else out.delete(key);
      }
      return out;
    });
  }

  function toastResultado(r: { criados?: number; reutilizados?: number }) {
    const partes = [];
    if (r.criados)
      partes.push(
        `${r.criados} ${r.criados === 1 ? "link gerado" : "links gerados"}`
      );
    if (r.reutilizados)
      partes.push(
        `${r.reutilizados} já ${r.reutilizados === 1 ? "tinha link" : "tinham links"}`
      );
    if (partes.length) toast.success(partes.join(" · ") + ".");
  }

  function gerarSelecionados() {
    const destinos: DestinoLink[] = destinatarios
      .filter((d) => selecionados.has(keyDe(d)))
      .map((d) => ({ tipo: d.tipo, id: d.id }) as DestinoLink);
    if (!destinos.length) return;
    start(async () => {
      const r = await gerarLinksFormulario({
        formularioId,
        destinos,
        diasValidade: validade === "0" ? null : Number(validade),
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toastResultado(r);
      setSelecionados(new Set());
      setBusca("");
      // o dialog segue aberto no estado "links prontos" — cada destinatário
      // com Copiar + WhatsApp sem perseguir a lista embaixo
      if (r.links?.length) setProntos(r.links);
      else setOpen(false);
      router.refresh();
    });
  }

  function gerarGenerico() {
    start(async () => {
      const r = await gerarLinksFormulario({
        formularioId,
        destinos: [{ tipo: "generico" }],
        diasValidade: null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const link = r.links?.[0];
      if (link) {
        // um genérico pendente por form — clicar de novo reusa o token; o
        // endereço já cai no clipboard e a linha pisca na lista
        try {
          await navigator.clipboard.writeText(urlPublica(link.token));
          toast.success(
            r.criados
              ? "Link genérico copiado."
              : "O genérico já existia — link copiado de novo."
          );
        } catch {
          toast.success("Link genérico gerado — copie na lista abaixo.");
        }
        if (destaqueTimer.current) clearTimeout(destaqueTimer.current);
        setDestaqueId(link.id);
        destaqueTimer.current = setTimeout(() => setDestaqueId(null), 3200);
      } else {
        toastResultado(r);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={open} onOpenChange={aoAbrir}>
          <DialogTrigger render={<Button size="sm" />}>
            <LinkIcon aria-hidden />
            Gerar links
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gerar links de resposta</DialogTitle>
              <DialogDescription>
                Cada pessoa recebe um link único — a resposta fica vinculada a
                ela (e à dupla, quando houver).
              </DialogDescription>
            </DialogHeader>

            <AnimatePresence mode="wait" initial={false}>
              {prontos ? (
                <motion.div key="prontos" {...fade} transition={T.enter}>
                  <LinksProntos
                    itens={itensProntos}
                    onOutros={() => setProntos(null)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  {...fade}
                  transition={T.enter}
                  className="space-y-4"
                >
                  {!formularioAtivo && (
                    <p className="rounded-lg bg-[var(--warn)]/10 px-3 py-2 text-xs text-[var(--warn-text)]">
                      O formulário está encerrado — os links gerados só
                      aceitam resposta depois que você reativar.
                    </p>
                  )}
                  {formularioSistema === "avaliacao_360" && (
                    <p className="rounded-lg bg-[var(--brand-lime)]/10 px-3 py-2 text-xs text-foreground">
                      Quando uma resposta 360º chega por um link com dupla, o
                      item do checklist de encerramento marca sozinho.
                    </p>
                  )}

                  <div className="relative">
                    <MagnifyingGlass
                      aria-hidden
                      size={16}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="search"
                      aria-label="Buscar destinatário"
                      placeholder="Buscar por nome"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  <div className="scroll-fina max-h-64 space-y-4 overflow-y-auto pr-1">
                    {grupos.map((g) => {
                      const selNoGrupo = g.itens.filter((d) =>
                        selecionados.has(keyDe(d))
                      ).length;
                      const todos = selNoGrupo === g.itens.length;
                      const alguns = selNoGrupo > 0 && !todos;
                      return (
                        <fieldset key={g.key}>
                          <legend className="sr-only">{g.titulo}</legend>
                          <label className="flex min-h-9 cursor-pointer flex-wrap items-center gap-x-3 rounded-lg px-2 transition-colors hover:bg-muted">
                            <input
                              type="checkbox"
                              checked={todos}
                              ref={(el) => {
                                if (el) el.indeterminate = alguns;
                              }}
                              onChange={() => toggleGrupo(g.itens, !todos)}
                              aria-label={`Selecionar todos — ${g.titulo}`}
                              className="size-4 shrink-0 accent-primary"
                            />
                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {g.titulo}
                            </span>
                            <span className="ml-auto basis-full pl-7 text-xs text-muted-foreground sm:basis-auto sm:pl-0">
                              Selecionar todos ·{" "}
                              <span className="tabular-nums">
                                {selNoGrupo} de {g.itens.length} selecionados
                              </span>
                            </span>
                          </label>
                          <ul className="mt-0.5 space-y-0.5">
                            {g.itens.map((d) => {
                              const key = keyDe(d);
                              const vigente = comLinkVigente.has(key);
                              return (
                                <li key={key}>
                                  <DestinoCheckRow
                                    nome={d.nome}
                                    detalhe={
                                      vigente ? "já tem link" : d.detalhe
                                    }
                                    checked={selecionados.has(key)}
                                    onToggle={() => toggle(key)}
                                  />
                                </li>
                              );
                            })}
                          </ul>
                        </fieldset>
                      );
                    })}
                    {destinatarios.length > 0 && filtrados.length === 0 && (
                      <p className="px-2 text-sm text-muted-foreground">
                        Nenhum destinatário encontrado pra essa busca.
                      </p>
                    )}
                    {destinatarios.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma pessoa cadastrada — cadastre em{" "}
                        <Link
                          href="/pessoas"
                          className="underline underline-offset-2"
                        >
                          Pessoas
                        </Link>{" "}
                        ou gere um link genérico.
                      </p>
                    )}
                  </div>

                  <ValidadeLinks value={validade} onChange={setValidade} />

                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={gerarSelecionados}
                      disabled={pending || selecionados.size === 0}
                    >
                      {pending && (
                        <CircleNotch className="animate-spin" aria-hidden />
                      )}
                      {selecionados.size
                        ? `Gerar ${selecionados.size} ${selecionados.size === 1 ? "link" : "links"}`
                        : "Escolha os destinatários"}
                    </Button>
                  </DialogFooter>
                </motion.div>
              )}
            </AnimatePresence>
          </DialogContent>
        </Dialog>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={gerarGenerico}
        >
          {pending ? (
            <CircleNotch className="animate-spin" aria-hidden />
          ) : (
            <PaperPlaneTilt aria-hidden />
          )}
          Link genérico
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum link gerado ainda — gere links individuais ou um genérico pra
          divulgar.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {linksOrdenados.map((l) => {
            const status = linkStatus(l);
            return (
              <li
                key={l.id}
                className={cn(
                  "px-4 py-3 transition-colors duration-700 sm:px-5",
                  l.id === destaqueId && "bg-[var(--brand-lime)]/15"
                )}
              >
                {/* a 390px o wrap jogava nome, badge e ações em 3 linhas
                    desalinhadas — agora são 2 linhas deliberadas: nome+badge
                    (token/meta abaixo) e as ações encostadas à direita; a
                    partir de sm: volta à linha única */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {l.dest_nome ?? "Link genérico"}
                      </span>
                      <Badge
                        variant={
                          status === "respondido"
                            ? "default"
                            : status === "expirado"
                              ? "secondary"
                              : "outline"
                        }
                        className={cn(
                          "shrink-0",
                          status === "respondido" &&
                            "bg-[var(--ok)]/15 text-[var(--ok-text)]",
                          status === "expirado" &&
                            "bg-[var(--warn)]/15 text-[var(--warn-text)]"
                        )}
                      >
                        {LINK_STATUS_LABEL[status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      /f/{l.token.slice(0, 14)}…
                      {l.dupla && (
                        <span className="font-sans">
                          {" · "}
                          {primeiroNome(l.dupla.mentor_nome)} ↔{" "}
                          {primeiroNome(l.dupla.mentorado_nome)}
                        </span>
                      )}
                      {status === "pendente" && l.expira_em && (
                        <span className="font-sans">
                          {" · até "}
                          {dataCurta(l.expira_em)}
                        </span>
                      )}
                      {status === "expirado" && l.expira_em && (
                        <span className="font-sans">
                          {" · expirou "}
                          {dataCurta(l.expira_em)}
                        </span>
                      )}
                      {status === "respondido" && l.usado_em && (
                        <span className="font-sans">
                          {" · "}
                          {dataCurta(l.usado_em)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex basis-full items-center justify-end gap-1.5 sm:basis-auto">
                    {/* Copiar/WhatsApp só em link vivo — respondido copia link
                        morto e expirado ganha Reemitir (token novo) */}
                    {status === "pendente" && (
                      <>
                        <CopiarLink token={l.token} />
                        <NudgeButton
                          telefone={l.dest_whatsapp}
                          mensagem={msgLinkWhatsApp(
                            formularioTitulo,
                            l.dest_nome,
                            l.token,
                            origem
                          )}
                          label="WhatsApp"
                        />
                      </>
                    )}
                    {status === "expirado" && (
                      <ReemitirLinkButton
                        linkId={l.id}
                        formularioId={formularioId}
                      />
                    )}
                    {status !== "respondido" && (
                      <ConfirmDeleteButton
                        titulo="Excluir link?"
                        descricao={`O link de ${l.dest_nome ?? "uso genérico"} deixa de funcionar na hora.`}
                        sucesso="Link excluído."
                        onConfirm={() =>
                          excluirLinkFormulario(l.id, formularioId)
                        }
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir link de ${l.dest_nome ?? "uso genérico"}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash aria-hidden />
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
