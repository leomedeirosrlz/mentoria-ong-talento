"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "@/lib/toast";
import {
  ArrowCounterClockwise,
  BookOpen,
  Check,
  CircleNotch,
  Compass,
  CopySimple,
  DotsThreeVertical,
  Eye,
  ListChecks,
  PaperPlaneTilt,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { enviarInstrumentoMentorado } from "@/lib/actions-formularios";
import {
  INSTRUMENTO_INFO,
  INSTRUMENTOS_DUPLA_SISTEMA,
  type InstrumentoDuplaSistema,
  type RespostaValor,
} from "@/lib/forms/schema";
import type {
  InstrumentoDupla,
  InstrumentoEntrega,
} from "@/lib/forms/queries";
import {
  entregasDoMomento,
  entregasDoMomentoChecklist,
  parChecklist,
  parRoda,
} from "@/lib/jornada";
import { formatDate, waLink } from "@/lib/ciclo";
import { docDoSistema, GUIA_ENCONTRO } from "@/lib/como-conduzir";
import {
  ehInstrumentoChave,
  InstrumentoEmblema,
} from "@/components/instrumento-icone";
import { InstrumentoResultado } from "@/components/instrumento-resultado";
import {
  msgLinkWhatsApp,
  primeiroNome,
  urlPublica,
} from "@/components/forms/link-shared";
import { useOrigem } from "@/components/forms/use-origem";
import { superficieDoPath } from "@/lib/produto-eventos";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fade, T } from "@/components/motion";
import { cn } from "@/lib/utils";

// Seção "Instrumentos" da ficha da dupla (0080) — os quatro instrumentos
// oficiais da jornada DPP com status por entrega: não enviado/expirado →
// "Gerar (novo) link" (o mentor entrega — emitir_link_instrumento no
// banco), pendente → "Copiar link" + mandar no WhatsApp pelo ⋯,
// respondido → "Ver resposta" abre a leitura estruturada (a roda
// desenhada, as metas com IS/prazo, a declaração de visão). Desde a
// 022 cada linha tem 1 badge + 1 primária + ⋯ — FR-005/006/007.

/** WP7/REALIZA-202 — chip da janela + "Como conduzir" vêm de
 *  `@/lib/como-conduzir` (módulo único compartilhado com a agenda do
 *  mentor, o detalhe do encontro, os grupos de /materiais e o card da
 *  semana da coordenação). O chip diz QUANDO entra; o "Como conduzir"
 *  diz como o mentor usa — nenhum dos dois muda o fluxo de envio. */

/** O estado que a ficha mostra: respondido ganha sempre (a resposta é o
 *  produto); depois pendente (tem link vivo pra mandar); expirado e "não
 *  enviado" pedem o botão de envio. A linha ainda assim pode precisar
 *  mostrar DOIS estados — respondido + pendente (a re-emissão da nova
 *  rodada ou a entrega da outra ponta nos de 2 momentos — checklist
 *  início×fim, roda inicial×formal): isso é derivado à parte no
 *  `pendenteVisivel` da LinhaInstrumento, que desde a 022 vira metadado
 *  de texto + itens do ⋯ (a linha carrega 1 badge só). */
function estadoAtual(entregas: InstrumentoEntrega[]): {
  status: "respondido" | "pendente" | "expirado" | "nao_enviado";
  entrega: InstrumentoEntrega | null;
} {
  const respondidas = entregas
    .filter((e) => e.status === "respondido")
    .sort((a, b) =>
      (b.respondido_em ?? "").localeCompare(a.respondido_em ?? "")
    );
  if (respondidas.length)
    return { status: "respondido", entrega: respondidas[0] };
  const pendente = entregas.find((e) => e.status === "pendente");
  if (pendente) return { status: "pendente", entrega: pendente };
  if (entregas.length) return { status: "expirado", entrega: null };
  return { status: "nao_enviado", entrega: null };
}

function LinhaInstrumento({
  item,
  sistema: sistemaEsperado,
  duplaId,
  mentoradoNome,
  mentoradoWhatsapp,
  mentorNome,
  mentorWhatsapp,
  podeEnviar,
  jornadaViva,
  remetenteMentorNome,
  rodaPar,
  checklistPar,
}: {
  /** null quando o instrumento ainda não foi semeado no banco — a linha
   *  existe pra jornada completa aparecer, mas sem ação */
  item: InstrumentoDupla | null;
  /** a chave da régua — cobre o item não-semeado (o guia e o doc do
   *  instrumento existem independente da semente). */
  sistema: InstrumentoDuplaSistema;
  duplaId: string;
  mentoradoNome: string;
  mentoradoWhatsapp: string | null;
  /** destinatário do checklist de competências (0190) — o mentor */
  mentorNome: string;
  mentorWhatsapp: string | null;
  podeEnviar: boolean;
  /** ativa|pausada — dupla fechada esconde TODAS as ações de link pra
   *  qualquer papel (Copiar/WhatsApp/Gerar): o link que o jovem já tem
   *  segue respondível, mas ninguém emite nem reenvia. */
  jornadaViva: boolean;
  /** Quando quem vê é o mentor: a msg do link sai na voz dele ("seu
   *  mentor"), não "a equipe" — o texto vai do número dele. */
  remetenteMentorNome?: string;
  /** pares antes × depois já derivados das entregas (REALIZA-18 / -359) */
  rodaPar: ReturnType<typeof parRoda<InstrumentoEntrega>>;
  checklistPar: ReturnType<typeof parChecklist<InstrumentoEntrega>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enviado, setEnviado] = useState<string | null>(null);
  // refaçagem pedida (REALIZA-435) — confirmação leve, controlada, mesmo
  // padrão dos dialogs de editar/cancelar da seção de terceiros
  const [refazendo, setRefazendo] = useState(false);
  // "Como conduzir" — era um <details> na linha; desde a 022 abre do ⋯
  const [conduzindo, setConduzindo] = useState(false);
  // o "Copiar link" da linha vira "Copiado" por 2s — mesma UX do
  // CopiarLink; no ⋯ a confirmação sai em toast (o item fecha)
  const [copiado, setCopiado] = useState(false);
  const copiarTimer = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(
    () => () => {
      if (copiarTimer.current) clearTimeout(copiarTimer.current);
    },
    []
  );
  const origem = useOrigem();
  const sup = superficieDoPath(usePathname());

  const sistema = (item?.sistema ?? sistemaEsperado) as InstrumentoDuplaSistema;
  const info = sistema ? INSTRUMENTO_INFO[sistema] : null;
  const titulo = item?.titulo ?? info?.titulo ?? "Instrumento";

  // estado local pós-envio: a RPC já gravou e o refresh traz o resto.
  // Respondido NÃO flipa pra pendente — a re-emissão ("pedir pra refazer")
  // exibe resposta + link novo juntos, o mesmo merge que o refresh traz
  const real = estadoAtual(item?.entregas ?? []);
  const { status, entrega } =
    enviado && real.status !== "respondido"
      ? { status: "pendente" as const, entrega: null }
      : real;

  // momento da entrega nos instrumentos de 2 pontas (roda inicial×formal,
  // checklist início×fim) — mesma régua dos pares (jornada.ts): marca do
  // contexto primeiro; sem marca, a primeira entrega é a de abertura
  const momentoDe = (e: InstrumentoEntrega) =>
    sistema === "roda_vida"
      ? entregasDoMomento(item?.entregas ?? [], "inicial").includes(e)
        ? ("inicial" as const)
        : ("formal" as const)
      : entregasDoMomentoChecklist(item?.entregas ?? [], "inicio").includes(e)
        ? ("inicio" as const)
        : ("final" as const);

  // pendente ao lado do respondido — a linha mostra os dois estados
  // juntos: a re-emissão do mesmo instrumento (a "nova rodada" da
  // jornada — REALIZA-435) ou a entrega da outra ponta de roda/checklist
  // (o link do 2º momento que o respondido escondia — REALIZA-18/-359).
  // O mais recente é o que se manda
  const pendenteVisivel = (() => {
    if (status !== "respondido" || !item) return null;
    return (
      item.entregas
        .filter((e) => e.status === "pendente")
        .sort((a, b) =>
          (b.created_at ?? "").localeCompare(a.created_at ?? "")
        )[0] ?? null
    );
  })();

  // já existe link vivo esperando a refaçagem da resposta exibida — o
  // pedido foi feito (nesta sessão ou antes) e a linha já mostra o link:
  // o botão sai pra não parecer que falta gesto
  const refazerVivo = (() => {
    if (status !== "respondido" || !entrega || !item) return false;
    if (enviado) return true;
    const duasPontas =
      sistema === "roda_vida" || sistema === "competencias_mentor";
    const momentoResp = duasPontas ? momentoDe(entrega) : null;
    return item.entregas.some(
      (e) =>
        e.status === "pendente" &&
        (!duasPontas || momentoDe(e) === momentoResp)
    );
  })();

  const temPendente =
    status === "pendente" || pendenteVisivel != null || enviado != null;

  // auditoria do self-serve (0209): link vivo com origem 'jovem' foi o
  // próprio mentorado pedindo refaçagem — a linha diz isso pro mentor em
  // vez do "link enviado" genérico (que sugere gesto da equipe)
  const pendenteJovem =
    !enviado &&
    (status === "pendente" ? entrega : pendenteVisivel)?.contexto?.origem ===
      "jovem";

  // token da ação de link: pendente normal OU a que convive com o
  // respondido (re-emissão ou outra ponta) OU a recém-emitida na sessão
  const tokenVivo =
    enviado ??
    (status === "pendente"
      ? (entrega?.token ?? null)
      : (pendenteVisivel?.token ?? null));

  // o checklist vai pro mentor; os 4 de jornada, pro mentorado — destino
  // por sistema, não por linha (o whatsapp e o nome da msg acompanham)
  const destNome =
    sistema === "competencias_mentor" ? mentorNome : mentoradoNome;
  const destWhatsapp =
    sistema === "competencias_mentor" ? mentorWhatsapp : mentoradoWhatsapp;

  // payload do momento anterior pra leitura comparada — só quando a
  // entrega exibida é a ponta do fim (a inicial sozinha não compara)
  const respostasAnterior: Record<string, RespostaValor> | null =
    sistema === "roda_vida" && entrega?.link_id === rodaPar.formal?.link_id
      ? (rodaPar.inicial?.respostas ?? null)
      : sistema === "competencias_mentor" &&
          entrega?.link_id === checklistPar.final?.link_id
        ? (checklistPar.inicio?.respostas ?? null)
        : null;

  // a âncora do "Enviar no WhatsApp" do ⋯ — o mesmo /api/nudge?d=…&to=…
  // &t=…&s=… que o NudgeButton montava na fileira de ações (o GET loga a
  // interação antes do redirect pro wa.me); a mensagem do link segue
  // idêntica, destinatário por sistema (o checklist vai pro mentor)
  const hrefNudge = (() => {
    if (!tokenVivo) return null;
    const wa = waLink(
      destWhatsapp,
      msgLinkWhatsApp(
        titulo,
        destNome,
        tokenVivo,
        origem,
        // "your mentor" voice only fits the mentee — the checklist
        // goes to the mentor himself, institutional voice is right
        sistema === "competencias_mentor" ? undefined : remetenteMentorNome
      )
    );
    if (!wa) return null;
    return `/api/nudge?d=${encodeURIComponent(duplaId)}&to=${encodeURIComponent(wa)}&t=${encodeURIComponent("nudge")}&s=${encodeURIComponent(sup)}`;
  })();

  /** Copia a URL pública do link vivo (/f/<token>). Na linha o botão vira
   *  "Copiado" por 2s (a UX do CopiarLink); chamado do ⋯ a confirmação
   *  sai em toast, porque o item fecha junto com o menu. */
  async function copiarLink(noMenu = false) {
    if (!tokenVivo) return;
    try {
      await navigator.clipboard.writeText(urlPublica(tokenVivo));
    } catch {
      toast.error("Não consegui copiar. Selecione o link manualmente.");
      return;
    }
    if (noMenu) {
      toast.success("Link copiado.");
      return;
    }
    setCopiado(true);
    if (copiarTimer.current) clearTimeout(copiarTimer.current);
    copiarTimer.current = setTimeout(() => setCopiado(false), 2000);
  }

  // 1 badge de estado dominante (022/US4), na precedência respondido >
  // link vivo > link expirado > não enviado: com respondido + link vivo o
  // badge é o respondido e a pendência sai como metadado de texto +
  // ações no ⋯ — info preservada, chrome de badge removido
  const badgeEstado =
    status === "respondido" ? (
      <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
        respondido
      </Badge>
    ) : temPendente ? (
      <Badge className="bg-[var(--warn)]/15 text-[var(--warn-text)]">
        {pendenteJovem ? "pedido pelo jovem" : "link enviado"}
      </Badge>
    ) : status === "expirado" ? (
      <Badge variant="secondary">link expirado</Badge>
    ) : (
      <Badge variant="secondary">não enviado</Badge>
    );

  // os gestos secundários do ⋯ — os MESMOS gates da fileira de ações de
  // antes da 022, item a item (nada abre nem fecha gesto novo)
  const linkNoMenu = temPendente && tokenVivo != null && jornadaViva;
  const refazerNoMenu =
    status === "respondido" &&
    item != null &&
    podeEnviar &&
    jornadaViva &&
    !refazerVivo;
  const temSecundarias = linkNoMenu || refazerNoMenu;

  function enviar() {
    if (!sistema) return;
    start(async () => {
      let r;
      try {
        r = await enviarInstrumentoMentorado(duplaId, sistema);
      } catch {
        toast.error("Sem conexão. Tente de novo.");
        return;
      }
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setEnviado(r.token);
      toast.success(
        r.reutilizado
          ? "Este link já estava pendente. Reaproveitado."
          : "Link gerado. Copie ou envie pelo WhatsApp."
      );
      router.refresh();
    });
  }

  /** Re-emissão do instrumento respondido (REALIZA-435): a resposta é
   *  evidência e não se edita — a saída é a nova rodada que a RPC já
   *  cria (link em branco do mesmo destinatário; a resposta antiga fica
   *  guardada e segue legível no "Ver resposta"). Nos instrumentos de 2
   *  pontas o momento vai explícito: sem ele o emitir derivaria a ponta
   *  SEGUINTE pelas respondidas e a refaçagem da inicial sairia formal. */
  function refazer() {
    if (!sistema || !entrega) return;
    const momento =
      sistema === "roda_vida" || sistema === "competencias_mentor"
        ? momentoDe(entrega)
        : undefined;
    start(async () => {
      const r = await enviarInstrumentoMentorado(
        duplaId,
        sistema,
        momento
      ).catch(() => null);
      if (!r) {
        toast.error("Sem conexão. Tente de novo.");
        return;
      }
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setRefazendo(false);
      setEnviado(r.token);
      toast.success(
        r.reutilizado
          ? "Já havia um link novo em aberto. Reaproveitado."
          : "Link novo gerado. A resposta anterior segue salva."
      );
      router.refresh();
    });
  }

  return (
    // 022/US4 — a linha enxuta: emblema + [título · 1 badge de estado] +
    // resumo + metadados, UMA ação primária por estado e o ⋯ com as
    // secundárias. No estreito a linha empilha (ações alinhadas sob o
    // texto, pl-12 = emblema 36 + gap-3)
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {sistema && ehInstrumentoChave(sistema) ? (
          <InstrumentoEmblema instrumento={sistema} size={36} />
        ) : (
          // item ainda não semeado (sistema null) ou valor novo do banco —
          // o fallback neutro da prateleira, nunca quebra a linha
          <span className="grid size-9 shrink-0 place-items-center rounded-[28%] bg-muted text-muted-foreground">
            <ListChecks size={18} aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium">{titulo}</p>
            {badgeEstado}
          </div>
          {info && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {info.resumo}
            </p>
          )}
          {sistema && (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {/* a janela do guia era um segundo badge — virou metadado
                  (a informação fica, o chrome de badge sai) */}
              <span>{GUIA_ENCONTRO[sistema].chip}</span>
              {status === "respondido" && entrega?.respondido_em && (
                <span className="tabular-nums">
                  Respondido em {formatDate(entrega.respondido_em)}
                </span>
              )}
              {/* o link vivo do respondido não é mais badge: o estado
                  segue legível como metadado e as ações dele estão no ⋯ */}
              {status === "respondido" && temPendente && (
                <span>{pendenteJovem ? "pedido pelo jovem" : "link enviado"}</span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 pl-12 sm:pl-0">
        {/* 1 ação primária por estado — a mesma ação de antes, os mesmos
            gates; o que não é o próximo passo mora no ⋯ */}
        {status === "respondido" && item && entrega?.respostas && (
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm">
                  <Eye aria-hidden />
                  Ver resposta
                </Button>
              }
            />
            {/* xl, não 2xl: leitura estruturada do instrumento, não prévia
                tabular; o scroll vem da base do DialogContent */}
            <DialogContent size="xl">
              <DialogHeader>
                <DialogTitle>{item.titulo}</DialogTitle>
                <DialogDescription>
                  Respondido por {destNome}
                  {entrega.respondido_em &&
                    ` em ${formatDate(entrega.respondido_em)}`}
                  .
                </DialogDescription>
              </DialogHeader>
              <InstrumentoResultado
                sistema={item.sistema}
                campos={item.campos}
                respostas={entrega.respostas}
                respostasAnterior={respostasAnterior}
              />
            </DialogContent>
          </Dialog>
        )}

        {status === "pendente" && tokenVivo && jornadaViva && (
          <motion.span
            {...fade}
            transition={T.enter}
            className="inline-flex"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copiarLink()}
            >
              {copiado ? (
                <Check aria-hidden className="text-[var(--ok)]" />
              ) : (
                <CopySimple aria-hidden />
              )}
              {copiado ? "Copiado" : "Copiar link"}
            </Button>
          </motion.span>
        )}

        {(status === "nao_enviado" || status === "expirado") &&
          podeEnviar &&
          jornadaViva &&
          item && (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={enviar}
              disabled={pending || !item.ativo}
              title={item.ativo ? undefined : "Instrumento encerrado em Formulários"}
            >
              {pending ? (
                <CircleNotch className="animate-spin" aria-hidden />
              ) : (
                <PaperPlaneTilt aria-hidden />
              )}
              {status === "expirado" ? "Gerar novo link" : "Gerar link"}
            </Button>
            {/* desabilitado explica por quê inline — no toque não existe
                hover/tooltip (o title fica como redundância desktop) */}
            {!item.ativo && (
              <span className="text-xs text-muted-foreground">
                encerrado em Formulários
              </span>
            )}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Ações de ${titulo}`}
              >
                <DotsThreeVertical size={18} weight="bold" aria-hidden />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            {/* o link vivo do respondido não disputa com a primária "Ver
                resposta": copiar e mandar no WhatsApp ficam aqui no ⋯ */}
            {status === "respondido" && linkNoMenu && (
              <DropdownMenuItem onClick={() => copiarLink(true)}>
                <CopySimple aria-hidden data-icon="inline-start" />
                Copiar link
              </DropdownMenuItem>
            )}
            {linkNoMenu && (
              <DropdownMenuItem
                disabled={!hrefNudge}
                render={
                  hrefNudge ? (
                    <a
                      href={hrefNudge}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ) : undefined
                }
              >
                <WhatsappLogo aria-hidden data-icon="inline-start" />
                Enviar no WhatsApp
                {/* número ausente fica visível — esconder a opção deixaria
                    a equipe procurando um contato que não existe cadastrado */}
                {!hrefNudge && (
                  <span className="ml-auto pl-3 text-xs text-muted-foreground">
                    sem WhatsApp cadastrado
                  </span>
                )}
              </DropdownMenuItem>
            )}
            {/* nova rodada do instrumento (REALIZA-435): a resposta é
                evidência e segue guardada; a RPC gera um link novo em
                branco do mesmo destinatário. Some quando já há link vivo
                da mesma marcação (refazerVivo) */}
            {refazerNoMenu && item && (
              <DropdownMenuItem
                disabled={!item.ativo}
                onClick={() => setRefazendo(true)}
              >
                <ArrowCounterClockwise aria-hidden data-icon="inline-start" />
                Pedir pra refazer
                {!item.ativo && (
                  <span className="ml-auto pl-3 text-xs text-muted-foreground">
                    encerrado em Formulários
                  </span>
                )}
              </DropdownMenuItem>
            )}
            {temSecundarias && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setConduzindo(true)}>
              <Compass aria-hidden data-icon="inline-start" />
              Como conduzir
            </DropdownMenuItem>
            {/* ponte instrumento → doc (REALIZA-386): o guia nativo; o
                ?dupla= faz o "Abrir instrumento" do doc voltar pra cá */}
            <DropdownMenuItem
              render={
                <Link
                  href={`/materiais/documento/${docDoSistema(sistema)}?dupla=${duplaId}`}
                  prefetch={false}
                />
              }
            >
              <BookOpen aria-hidden data-icon="inline-start" />
              Ler o guia
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={refazendo} onOpenChange={setRefazendo}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Pedir pra refazer?</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Um link novo em branco é gerado pra {primeiroNome(destNome)}{" "}
              responder de novo. A resposta anterior segue guardada nesta
              ficha.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefazendo(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={refazer} disabled={pending}>
              {pending ? (
                <CircleNotch className="animate-spin" aria-hidden />
              ) : null}
              Gerar novo link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* o <details> "Como conduzir" da linha virou item do ⋯ que abre
          este dialog — a prosa de condução não compete mais com os
          metadados da linha */}
      {sistema && (
        <Dialog open={conduzindo} onOpenChange={setConduzindo}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Como conduzir · {titulo}</DialogTitle>
            </DialogHeader>
            <DialogDescription className="leading-relaxed">
              {GUIA_ENCONTRO[sistema].conduzir}
            </DialogDescription>
          </DialogContent>
        </Dialog>
      )}
    </li>
  );
}

export function InstrumentosDupla({
  duplaId,
  itens,
  mentoradoNome,
  mentoradoWhatsapp,
  mentorNome,
  mentorWhatsapp,
  podeEnviar,
  jornadaViva,
  remetenteMentorNome,
  className,
}: {
  duplaId: string;
  /** saída da RPC instrumentos_da_dupla — um item por instrumento semeado */
  itens: InstrumentoDupla[];
  mentoradoNome: string;
  mentoradoWhatsapp: string | null;
  /** o checklist de competências responde o mentor (0190) */
  mentorNome: string;
  mentorWhatsapp: string | null;
  /** coord sempre; o mentor DPP da dupla viva também entrega (o guia é dele) */
  podeEnviar: boolean;
  /** ativa|pausada — dupla fechada vira só leitura de resultados */
  jornadaViva: boolean;
  /** Voz do link de WhatsApp: nome quando quem envia é o mentor da dupla. */
  remetenteMentorNome?: string;
  className?: string;
}) {
  if (!itens.length) return null;
  const porSistema = new Map(itens.map((i) => [i.sistema, i]));
  // os pares antes × depois derivam UMA vez das entregas já carregadas —
  // a leitura inicial da roda e a marcação de início do checklist alimentam
  // a comparação do "Ver resposta" de cada linha (REALIZA-18/-359)
  const rodaPar = parRoda(porSistema.get("roda_vida")?.entregas ?? []);
  const checklistPar = parChecklist(
    porSistema.get("competencias_mentor")?.entregas ?? []
  );
  return (
    <section
      id="instrumentos"
      className={cn(
        "scroll-mt-20 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]",
        className
      )}
    >
      <h2 className="text-base font-semibold">Instrumentos da jornada</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Os exercícios oficiais do guia: o jovem responde por link único, sem
        login, e o resultado volta estruturado aqui.
      </p>
      <ul className="mt-2 divide-y divide-border/60">
        {INSTRUMENTOS_DUPLA_SISTEMA.map((s) => (
          <LinhaInstrumento
            key={s}
            item={porSistema.get(s) ?? null}
            sistema={s}
            duplaId={duplaId}
            mentoradoNome={mentoradoNome}
            mentoradoWhatsapp={mentoradoWhatsapp}
            mentorNome={mentorNome}
            mentorWhatsapp={mentorWhatsapp}
            podeEnviar={podeEnviar}
            jornadaViva={jornadaViva}
            remetenteMentorNome={remetenteMentorNome}
            rodaPar={rodaPar}
            checklistPar={checklistPar}
          />
        ))}
      </ul>
    </section>
  );
}
