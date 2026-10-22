"use client";

import { useCallback, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle,
  CircleNotch,
  HandHeart,
  PaperPlaneRight,
  Star,
} from "@phosphor-icons/react";
import { submeterAvaliacao } from "@/lib/actions-avaliacao";
import {
  AVANCEI_AVALIACAO,
  SENTIMENTO_AVALIACAO,
  TEMAS_AVALIACAO,
  estrelasTexto,
} from "@/lib/ciclo";
import { fade, T } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const COMENTARIO_MAX = 2000;

/** Form da avaliação estrela do jovem (REALIZA-109 / D4) — schema fixo, um
 *  card por pergunta na mesma gramática do /f/[token]. Usado nos dois
 *  canais: a página pública por token (`token`) e o /jovem logado
 *  (`encontroId`). A RPC revalida tudo no banco; aqui é UX honesta —
 *  validação imediata e copy de privacidade por trilha.
 *
 *  Privacidade é feature, não rodapé: a linha "pro seu mentor só a média"
 *  é o que destrava a resposta sincera (D4). Na trilha de especialista o
 *  corte é outro — só as estrelas — e o toggle "mentor pode ler" some:
 *  renderizá-lo seria prometer um controle que o RLS não entrega. */
export function AvaliacaoEncontroForm({
  token,
  encontroId,
  trilha,
  primeiroNome,
  onEnviado,
}: {
  /** Caminho público /avaliar/<token>. */
  token?: string;
  /** Caminho logado (/jovem) — a sessão prova o vínculo. */
  encontroId?: string;
  /** 'dpp' | 'especialista' — decide o toggle de visibilidade do mentor. */
  trilha: string;
  primeiroNome?: string | null;
  /** Dispara depois do sucesso — o host de dialog usa pra fechar; o envio
   *  em si já foi gravado quando ele roda. */
  onEnviado?: (resultado: { pedirApoio: boolean }) => void;
}) {
  const [enviado, setEnviado] = useState(false);
  const [pedidoAjuda, setPedidoAjuda] = useState(false);
  const [estrelas, setEstrelas] = useState(0);
  const [erroEstrelas, setErroEstrelas] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const focoSucesso = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.focus({ preventScroll: true });
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!estrelas) {
      setErroEstrelas("Escolha de 1 a 5 estrelas.");
      e.currentTarget
        .querySelector('[data-campo="estrelas"]')
        ?.scrollIntoView({ block: "center" });
      return;
    }
    setErroEstrelas(null);
    setErro(null);
    start(async () => {
      try {
        const r = await submeterAvaliacao({
          token,
          encontroId,
          honeypot: String(fd.get("website") ?? ""),
          estrelas,
          sentimento: String(fd.get("sentimento") ?? "") || null,
          avancei: String(fd.get("avancei") ?? "") || null,
          temas: fd.getAll("temas").map(String),
          comentario: String(fd.get("comentario") ?? "") || null,
          pedirApoio: fd.get("pedir_apoio") === "on",
          visivelMentor: fd.get("visivel_mentor") === "on",
        });
        if (r.error) {
          setErro(r.error);
          return;
        }
        setPedidoAjuda(!!r.pedirApoio);
        setEnviado(true);
        onEnviado?.({ pedirApoio: !!r.pedirApoio });
      } catch {
        setErro("Sem conexão. Confira a internet e tente de novo.");
      }
    });
  }

  const a11yEstrelas = {
    "aria-invalid": erroEstrelas ? true : undefined,
    "aria-describedby": erroEstrelas ? "aval-estrelas-erro" : undefined,
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {enviado ? (
        <motion.div
          key="ok"
          ref={focoSucesso}
          tabIndex={-1}
          {...fade}
          transition={T.enter}
          className="rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)] outline-none sm:p-8"
        >
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)]">
            {pedidoAjuda ? (
              <HandHeart size={24} weight="bold" aria-hidden />
            ) : (
              <CheckCircle size={24} weight="bold" aria-hidden />
            )}
          </div>
          <h1 className="mt-4 text-lg font-semibold">
            {pedidoAjuda ? "Pedido de ajuda enviado" : "Avaliação enviada!"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {pedidoAjuda
              ? `Obrigado${primeiroNome ? `, ${primeiroNome}` : ""} por contar. A coordenação foi avisada na hora e fala com você — o combinado do programa é responder em 1 dia útil.`
              : trilha === "dpp"
                ? `Obrigado${primeiroNome ? `, ${primeiroNome}` : ""}. Suas respostas ficam entre você e a equipe da Realiza.vc — pro seu mentor só aparece a média. Pode fechar esta página.`
                : `Obrigado${primeiroNome ? `, ${primeiroNome}` : ""}. Suas respostas ficam entre você e a equipe da Realiza.vc — seu mentor vê só as estrelas desta sessão. Pode fechar esta página.`}
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          {...fade}
          transition={T.enter}
          className="space-y-3"
        >
          {/* card de contexto — a linha de privacidade É o argumento que
              faz o jovem responder de verdade (D4) */}
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <div aria-hidden className="h-1.5 bg-[var(--brand-lime)]" />
            <div className="p-5 sm:p-7">
              {primeiroNome && (
                <p className="text-sm font-medium text-[var(--ok-text)]">
                  Olá, {primeiroNome}!
                </p>
              )}
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Como foi o encontro?
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                1 minuto · só a nota é obrigatória
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {trilha === "dpp"
                  ? "Pro seu mentor, a nota só aparece na média junto com outras avaliações — nunca uma resposta sozinha. Se quiser que ele leia esta, marque lá embaixo. Só a equipe da Realiza.vc lê as respostas completas."
                  : "Seu mentor vê só as estrelas desta sessão — sem comentário nem temas. Só a equipe da Realiza.vc lê as respostas completas."}
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-3">
            {/* estrelas — radios de verdade (teclado/leitor) com o visual
                de estrela; o estado controlado pinta o preenchimento */}
            <fieldset
              data-campo="estrelas"
              className={cn(
                "rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5",
                erroEstrelas && "ring-2 ring-destructive/60"
              )}
              {...a11yEstrelas}
            >
              <legend className="block text-[15px] font-medium leading-snug sm:text-base">
                <span className="mr-1 text-muted-foreground tabular-nums">
                  1.
                </span>
                De 1 a 5 estrelas, como foi?
              </legend>
              <div
                role="radiogroup"
                aria-label="Nota do encontro de 1 a 5 estrelas"
                className="mt-2 flex gap-1"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors select-none hover:bg-muted has-checked:text-[var(--warn)] has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:size-10"
                  >
                    <input
                      type="radio"
                      name="estrelas"
                      value={n}
                      checked={estrelas === n}
                      onChange={() => {
                        setEstrelas(n);
                        setErroEstrelas(null);
                      }}
                      className="sr-only"
                      aria-label={estrelasTexto(n)}
                    />
                    <Star
                      size={26}
                      weight={n <= estrelas ? "fill" : "regular"}
                      aria-hidden
                    />
                  </label>
                ))}
              </div>
              {estrelas > 0 && (
                <p
                  aria-live="polite"
                  className="mt-1.5 text-xs text-muted-foreground"
                >
                  {estrelasTexto(estrelas)}
                </p>
              )}
              {erroEstrelas && (
                <p
                  id="aval-estrelas-erro"
                  className="mt-1.5 text-sm leading-snug text-destructive"
                >
                  {erroEstrelas}
                </p>
              )}
            </fieldset>

            {/* sentimento — escala de conforto, separada da nota de
                propósito: 3★ "desconfortável" é sinal diferente de 3★
                "bem" */}
            <fieldset className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
              <legend className="block text-[15px] font-medium leading-snug sm:text-base">
                <span className="mr-1 text-muted-foreground tabular-nums">
                  2.
                </span>
                Como você se sentiu?
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  (opcional)
                </span>
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {SENTIMENTO_AVALIACAO.map((o) => (
                  <label
                    key={o.value}
                    className="flex h-10 cursor-pointer items-center rounded-full bg-muted px-3.5 text-sm font-medium text-muted-foreground transition-colors select-none has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                  >
                    <input
                      type="radio"
                      name="sentimento"
                      value={o.value}
                      className="sr-only"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* avancei — a pergunta de resultado; os 3 valores são o CHECK
                do banco */}
            <fieldset className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
              <legend className="block text-[15px] font-medium leading-snug sm:text-base">
                <span className="mr-1 text-muted-foreground tabular-nums">
                  3.
                </span>
                Você sente que avançou no que combinou?
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  (opcional)
                </span>
              </legend>
              <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {AVANCEI_AVALIACAO.map((o) => (
                  <label
                    key={o.value}
                    className="flex h-11 cursor-pointer items-center justify-center rounded-lg text-center text-sm font-medium text-muted-foreground transition-colors select-none has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:h-10"
                  >
                    <input
                      type="radio"
                      name="avancei"
                      value={o.value}
                      className="sr-only"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* temas — chips de marcar-quantas-quiser; o "outro" cobre o
                que a lista não prevê */}
            <fieldset className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
              <legend className="block text-[15px] font-medium leading-snug sm:text-base">
                <span className="mr-1 text-muted-foreground tabular-nums">
                  4.
                </span>
                Sobre o que vocês conversaram?
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  (opcional · marque quantas quiser)
                </span>
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {TEMAS_AVALIACAO.map((o) => (
                  <label
                    key={o.value}
                    className="flex h-10 cursor-pointer items-center rounded-full bg-muted px-3.5 text-sm font-medium text-muted-foreground transition-colors select-none has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                  >
                    <input
                      type="checkbox"
                      name="temas"
                      value={o.value}
                      className="sr-only"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* comentário — o campo aberto; máximo igual ao da action */}
            <div className="space-y-1.5 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
              <label
                htmlFor="aval-comentario"
                className="block text-[15px] font-medium leading-snug sm:text-base"
              >
                <span className="mr-1 text-muted-foreground tabular-nums">
                  5.
                </span>
                Quer contar mais alguma coisa?
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  (opcional)
                </span>
              </label>
              <Textarea
                id="aval-comentario"
                name="comentario"
                rows={3}
                maxLength={COMENTARIO_MAX}
                placeholder="Pode escrever do jeito que quiser — só a equipe lê."
              />
            </div>

            {/* toggle de visibilidade do mentor — SÓ na trilha DPP: lá a
                regra é "média por padrão, esta específica se o jovem
                liberar". Na especialista nem média existe — renderizar o
                controle seria copy desonesta */}
            {trilha === "dpp" && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)] transition-colors select-none has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 sm:px-5">
                <input
                  type="checkbox"
                  name="visivel_mentor"
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="font-medium">
                    Quero que meu mentor leia esta avaliação
                  </span>{" "}
                  · normalmente ele só vê a média. Marque pra mostrar esta
                  resposta inteira a ele.
                </span>
              </label>
            )}

            {/* pedido de ajuda — canal de segurança distinto do "preciso
                de apoio" do mentor: avisa coord + supervisor na hora, e
                o sucesso já diz quem responde e quando */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-4 py-3 text-sm transition-colors select-none has-checked:bg-[var(--warn)]/15 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 sm:px-5">
              <input
                type="checkbox"
                name="pedir_apoio"
                className="mt-0.5 size-4 shrink-0 accent-[var(--warn)]"
              />
              <span>
                <span className="font-medium">Preciso de ajuda</span> · a
                coordenação e o auxiliar executivo são avisados na hora e falam com
                você — pode ser sobre qualquer coisa, inclusive sobre o
                encontro ou o mentor.
              </span>
            </label>

            {/* região estável pro leitor de tela anunciar — mesma régua do
                form público */}
            <p
              role="alert"
              className={cn(
                "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
                !erro && "sr-only"
              )}
            >
              {erro}
            </p>

            {/* honeypot anti-spam — mesmo molde do /f e /t: bot preenche o
                campo invisível, o servidor finge sucesso e não grava nada */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
            >
              <label>
                Site
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            </div>

            <Button
              type="submit"
              className="h-11 w-full md:h-10"
              disabled={pending}
            >
              {pending ? (
                <CircleNotch size={16} className="animate-spin" aria-hidden />
              ) : (
                <PaperPlaneRight size={16} aria-hidden />
              )}
              {pending ? "Enviando…" : "Enviar avaliação"}
            </Button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
