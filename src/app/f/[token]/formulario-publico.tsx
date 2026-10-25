"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  CaretDown,
  CheckCircle,
  CircleNotch,
  FileText,
  PaperPlaneRight,
  X,
} from "@phosphor-icons/react";
import {
  subirAnexoFormulario,
  submeterRespostaFormulario,
} from "@/lib/forms/actions";
import {
  camposPerguntas,
  campoFormato,
  ARQUIVO_MAX_MB,
  ARQUIVO_MIMES,
  SISTEMA_LABEL,
  visivel,
  type FormularioCampo,
  type FormularioSistema,
  type RespostaValor,
} from "@/lib/forms/schema";
import {
  aplicaOutro,
  campoRespondido,
  coletaRespostas,
  leDeFormData,
  validaRespostas,
} from "@/lib/forms/resposta";
import { ehInstrumento } from "@/lib/forms/instrumentos";
import { GridDisponibilidade } from "@/components/forms/grid-disponibilidade";
import { fade, T } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { InstrumentoFlow } from "@/components/instrumentos/flow";

/** Tipos de linha única que recebem enterKeyHint; o último deles leva
 *  "send" (fecha o teclado e envia em vez de saltar pra lugar nenhum).
 *  texto_longo fica fora DE PROPÓSITO: na textarea a tecla insere \n, não
 *  envia — rotulá-la "send" (ou "next") mentiria sobre o gesto. O default
 *  "enter" do SO já descreve certo a quebra de linha. */
const TIPOS_COM_ENTER: readonly FormularioCampo["tipo"][] = [
  "texto",
  "data",
];

/** Banner de validação client-side — em constante pra distinguir de erro de
 *  servidor/rede: o banner de validação some assim que o último campo
 *  marcado é corrigido; o de servidor só sai no próximo submit. */
const ERRO_VALIDACAO = "Revise os campos marcados antes de enviar.";

/** Forms oficiais de inscrição (REALIZA-70/69): ganham copy de inscrição
 *  ("recebida" ≠ "enviada") no painel de sucesso. */
function ehIntake(sistema: FormularioSistema | null | undefined): boolean {
  return sistema === "intake_mentor" || sistema === "intake_mentorado";
}

/** Formulário público /f/<token> — despacha pelo sistema do form: os 4
 *  instrumentos de jornada (0080) têm experiência sob medida
 *  (src/components/instrumentos); todo o resto — incluindo anamnese, 360º
 *  e autoavaliação — segue no renderer genérico. O contrato de submissão
 *  é o mesmo nas duas vias. */
export function FormularioPublico(props: {
  token: string;
  titulo: string;
  descricao: string | null;
  campos: FormularioCampo[];
  destinatario: string | null;
  /** 0042 — instrumento oficial ganha selo discreto (vem da RPC) */
  sistema?: FormularioSistema | null;
  /** prévia na ficha da coordenação — campos vivos, envio desligado */
  preview?: boolean;
}) {
  const { sistema } = props;
  if (ehInstrumento(sistema)) {
    return <InstrumentoFlow {...props} sistema={sistema} />;
  }
  return <FormularioGenerico {...props} />;
}

/** Renderer genérico — a definição vinda da RPC vira um card por pergunta
 *  e envia payload tipado pra submeterRespostaFormulario (o banco
 *  revalida tudo; aqui é só UX: validação por campo + espelho das regras). */
function FormularioGenerico({
  token,
  titulo,
  descricao,
  campos,
  destinatario,
  sistema,
  preview = false,
}: {
  token: string;
  titulo: string;
  descricao: string | null;
  campos: FormularioCampo[];
  destinatario: string | null;
  sistema?: FormularioSistema | null;
  preview?: boolean;
}) {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [respondidos, setRespondidos] = useState(0);
  const [pending, start] = useTransition();
  // valores controlados fora do FormData: upload ('arquivo') e a grade
  // horária — o input hidden espelha o mesmo valor pra coleta/validação
  const [extras, setExtras] = useState<Record<string, RespostaValor>>({});
  // snapshot das respostas atuais — alimenta visivel() das perguntas
  // condicionais (o gatilho pode ser qualquer campo já respondido)
  const [atuais, setAtuais] = useState<Record<string, RespostaValor>>({});
  const formRef = useRef<HTMLFormElement>(null);
  // progresso/validação/coleta ignoram rótulos de estrutura ('secao', 0080):
  // a numeração que a pessoa vê é só de perguntas de verdade. Ainda por
  // cima, a pergunta condicional fora da condição nem entra na conta.
  const perguntas = camposPerguntas(campos).filter((c) => visivel(c, atuais));

  // rascunho por token+pergunta: o mentorado responde no celular e texto
  // longo não pode morrer num reload (rede caindo, troca de app). Um JSON
  // por token cujo mapa interno é por campo — some quando a resposta sai.
  const chaveRascunho = preview ? null : `rascunho:/f/${token}`;

  // foco migra pro painel de sucesso quando ele monta (o form sai do DOM) —
  // scrollIntoView antes: a página pode estar rolada lá embaixo no submit
  const focoSucesso = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.focus({ preventScroll: true });
  }, []);

  const setExtra = useCallback(
    (id: string, v: RespostaValor | null) => {
      setExtras((prev) => {
        const next = { ...prev };
        if (v == null) delete next[id];
        else next[id] = v;
        return next;
      });
      // upload/grid mudam as condições e o progresso do mesmo jeito que
      // um campo de texto — sincroniza o snapshot
      setAtuais((prev) => {
        const next = { ...prev };
        if (v == null) delete next[id];
        else next[id] = v;
        return next;
      });
      setErros((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    []
  );

  /** O campo tem valor — progresso/limpeza de erro. FormData cobre os
   *  inputs nativos; o JSON do hidden cobre arquivo/grid (mesma regra de
   *  campoRespondido: path presente / célula marcada). */
  function respondido(c: FormularioCampo, fd: FormData): boolean {
    if (c.tipo === "multi_select") return fd.getAll(c.id).length > 0;
    if (c.tipo === "checkbox") return fd.get(c.id) === "on";
    return campoRespondido(c, fd.get(c.id));
  }

  /** Coleta + normalização — resposta.ts espelha a RPC; os controlados
   *  entram pelo hidden input do próprio campo (arquivo/grid). */
  function coleta(fd: FormData): {
    respostas: Record<string, RespostaValor>;
    falhas: Set<string>;
  } {
    return coletaRespostas(camposPerguntas(campos), leDeFormData(fd));
  }

  /** Espelho client-side das regras do servidor — validaRespostas sobre
   *  as perguntas VISÍVEIS (condicional fora da condição não obriga). */
  function valida(
    respostas: Record<string, RespostaValor>,
    falhas: Set<string>
  ) {
    return validaRespostas(perguntas, respostas, falhas);
  }

  // restaura o rascunho depois do mount: cada campo ganha de volta o que
  // foi digitado e o progresso recalcula — localStorage nunca é lido no
  // render (SSR/privado) nem na prévia da coordenação. Restaura sobre
  // TODAS as perguntas (inclusive as condicionais): a resposta do gatilho
  // restaurada reexibe a pergunta dependente no mesmo tick.
  useEffect(() => {
    if (!chaveRascunho) return;
    // restaura depois do primeiro paint: o DOM dos inputs já existe no
    // commit, mas setState síncrono no corpo do efeito cascateia render
    // (react-hooks/set-state-in-effect) — o timeout aplica o rascunho
    // num passe só, fora do ciclo de montagem
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(chaveRascunho);
        if (!raw) return;
        const rascunho = JSON.parse(raw) as Record<string, RespostaValor>;
        const form = formRef.current;
        if (!form) return;
        const nome = (id: string) => CSS.escape(id);
        const extrasRest: Record<string, RespostaValor> = {};
        for (const c of camposPerguntas(campos)) {
          const v = rascunho[c.id];
          if (v == null) continue;
          if (c.tipo === "arquivo" || c.tipo === "grid_disponibilidade") {
            // valor controlado — volta pelo estado (o upload já está no
            // servidor; só o metadado {path,nome,tamanho} viaja)
            extrasRest[c.id] = v;
            continue;
          }
          if (c.tipo === "multi_select" && Array.isArray(v)) {
            for (const inp of form.querySelectorAll<HTMLInputElement>(
              `input[name="${nome(c.id)}"]`
            )) {
              inp.checked = v.includes(inp.value);
            }
          } else if (c.tipo === "checkbox") {
            const inp = form.querySelector<HTMLInputElement>(
              `input[name="${nome(c.id)}"]`
            );
            if (inp) inp.checked = v === true;
          } else if (
            c.tipo === "sim_nao" ||
            c.tipo === "escala_1_5" ||
            c.tipo === "escala_1_10"
          ) {
            const inp = form.querySelector<HTMLInputElement>(
              `input[name="${nome(c.id)}"][value="${nome(String(v))}"]`
            );
            if (inp) inp.checked = true;
          } else {
            const inp = form.querySelector<
              HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
            >(`[name="${nome(c.id)}"]`);
            if (inp) inp.value = String(v);
          }
        }
        setExtras(extrasRest);
        const fd = new FormData(form);
        const coletado = coleta(fd).respostas;
        setAtuais({ ...coletado, ...extrasRest });
        setRespondidos(
          perguntas.reduce((n, c) => n + (respondido(c, fd) ? 1 : 0), 0)
        );
      } catch {
        // storage indisponível ou rascunho corrompido — o form segue vazio
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restaura uma vez no mount; respondido/campos são estáveis por render
  }, [chaveRascunho]);

  function onFormChange(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const coletado = coleta(fd).respostas;
    setAtuais({ ...coletado, ...extras });
    setRespondidos(
      perguntas.reduce((n, c) => n + (respondido(c, fd) ? 1 : 0), 0)
    );
    if (chaveRascunho) {
      try {
        localStorage.setItem(
          chaveRascunho,
          JSON.stringify({ ...coletado, ...extras })
        );
      } catch {
        // quota/storage desligado — o rascunho é conveniência, não requisito
      }
    }
    if (!Object.keys(erros).length) return;
    const next = { ...erros };
    for (const c of perguntas)
      if (next[c.id] && respondido(c, fd)) delete next[c.id];
    setErros(next);
    // quando o último campo marcado é corrigido, o banner global de validação
    // sai junto — erro de servidor/rede (outra string) não é afetado aqui
    if (!Object.keys(next).length)
      setErro((prev) => (prev === ERRO_VALIDACAO ? null : prev));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) return;
    const fd = new FormData(e.currentTarget);
    const { respostas: coletado, falhas } = coleta(fd);
    // controlados (arquivo/grid) entram por cima do FormData e o "Outro"
    // compõe "Outro: <texto>" — a RPC valida o mesmo formato
    const respostas = aplicaOutro(
      perguntas,
      { ...coletado, ...extras },
      (c) => String(fd.get(`${c.id}__outro`) ?? "")
    );
    const mapa = valida(respostas, falhas);
    if (Object.keys(mapa).length) {
      setErros(mapa);
      setErro(ERRO_VALIDACAO);
      const primeiro = perguntas.find((c) => mapa[c.id]);
      const alvo =
        primeiro &&
        formRef.current?.querySelector(
          `[data-campo="${CSS.escape(primeiro.id)}"]`
        );
      if (alvo) {
        alvo.scrollIntoView({ block: "center" });
        alvo
          .querySelector<HTMLElement>("input, select, textarea")
          ?.focus({ preventScroll: true });
      }
      return;
    }
    setErros({});
    setErro(null);
    start(async () => {
      try {
        const r = await submeterRespostaFormulario(
          token,
          respostas,
          String(fd.get("website") ?? "")
        );
        if (r.error) {
          setErro(r.error);
          return;
        }
        // resposta no servidor — o rascunho cumpriu o papel e sai junto
        if (chaveRascunho) {
          try {
            localStorage.removeItem(chaveRascunho);
          } catch {
            /* idem a escrita — conveniência */
          }
        }
        setEnviado(true);
      } catch {
        setErro("Sem conexão. Confira a internet e tente de novo.");
      }
    });
  }

  // "Olá, thiago" passa a "Olá, Thiago" — o nome vem do cadastro, nem sempre
  // capitalizado
  const primeiroNome = (() => {
    const p = destinatario?.trim().split(/\s+/)[0];
    if (!p) return null;
    const base = p.toLocaleLowerCase("pt-BR");
    return base.charAt(0).toLocaleUpperCase("pt-BR") + base.slice(1);
  })();

  const total = perguntas.length;
  const minutos = Math.max(1, Math.round((total * 15) / 60));
  // a linha que ensina a convenção "(opcional)" só aparece se houver o que
  // pular — num form todo obrigatório ela seria ruído
  const temOpcional = perguntas.some((c) => !c.obrigatorio);
  const ultimoComEnter = [...perguntas]
    .reverse()
    .find((c) => TIPOS_COM_ENTER.includes(c.tipo))?.id;

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
            <CheckCircle size={24} weight="bold" aria-hidden />
          </div>
          <h1 className="mt-4 text-lg font-semibold">
            {ehIntake(sistema) ? "Inscrição recebida!" : "Resposta enviada!"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {ehIntake(sistema)
              ? `Obrigado${primeiroNome ? `, ${primeiroNome}` : ""}! Sua
            inscrição foi registrada e já está com a equipe do Realiza.vc,
            que entra em contato pelos próximos passos. Pode fechar esta
            página.`
              : `Obrigado${primeiroNome ? `, ${primeiroNome}` : ""}. Sua resposta
            pra “${titulo}” foi registrada e já está com a equipe do
            Realiza.vc. Pode fechar esta página.`}
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          {...fade}
          transition={T.enter}
          className="space-y-3"
        >
          {/* progresso fora dos cards: pill sticky que acompanha o scroll de
              forms longos (safe-area no top, padrão do onboarding) */}
          <div className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-10 flex items-center gap-3 rounded-full bg-card/90 px-4 py-2.5 shadow-[var(--shadow-border)] backdrop-blur">
            <div
              role="progressbar"
              aria-valuenow={respondidos}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label="Progresso do formulário"
              aria-valuetext={`${respondidos} de ${total} perguntas respondidas`}
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-[var(--brand-lime)] transition-[width] duration-500"
                style={{
                  width: `${(respondidos / Math.max(total, 1)) * 100}%`,
                }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {respondidos} de {total}
            </span>
          </div>

          {/* card de título — a faixa lime na borda superior ecoa o
              themeColor (overflow-hidden pra faixa respeitar o radius) */}
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <div aria-hidden className="h-1.5 bg-[var(--brand-lime)]" />
            <div className="p-5 sm:p-7">
              {primeiroNome && (
                <p className="text-sm font-medium text-[var(--ok-text)]">
                  Olá, {primeiroNome}!
                </p>
              )}
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                {titulo}
              </h1>
              <p className="mt-1 text-xs whitespace-nowrap text-muted-foreground">
                {total} {total === 1 ? "pergunta" : "perguntas"} · leva ~
                {minutos} min
              </p>
              {sistema && (
                <Badge
                  variant="outline"
                  className="mt-2 border-[var(--brand-lime)]/60 bg-[var(--brand-lime)]/10"
                >
                  Instrumento oficial · {SISTEMA_LABEL[sistema]}
                </Badge>
              )}
              {temOpcional && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Você pode pular as perguntas marcadas (opcional).
                </p>
              )}
              {descricao && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {descricao}
                </p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Suas respostas são lidas apenas pela equipe do Realiza.vc.{" "}
                <Link
                  href="/privacidade"
                  className="underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  privacidade
                </Link>
                .
              </p>
            </div>
          </div>

          <form
            ref={formRef}
            onSubmit={onSubmit}
            onChange={onFormChange}
            noValidate
            className="space-y-3"
          >
            {/* a numeração conta só perguntas — 'secao' é rótulo de
                estrutura e não entra na contagem nem no "1." do card */}
            {(() => {
              const numeroPorId = new Map(
                perguntas.map((c, i) => [c.id, i + 1])
              );
              return campos.map((c) => {
                // condicional fora da condição não renderiza — some da
                // tela, da numeração e da coleta (a RPC concorda)
                if (c.tipo !== "secao" && !visivel(c, atuais)) return null;
                return (
                  <CampoRenderer
                    key={c.id}
                    campo={c}
                    n={numeroPorId.get(c.id) ?? 0}
                    erro={erros[c.id]}
                    enterKeyHint={c.id === ultimoComEnter ? "send" : "next"}
                    token={token}
                    preview={preview}
                    valor={extras[c.id]}
                    atual={atuais[c.id]}
                    onValor={setExtra}
                  />
                );
              });
            })()}

            {/* honeypot anti-spam: invisível pra humanos, bots preenchem —
                o servidor finge sucesso e não grava nada. Depois dos cards
                pro space-y não criar gap extra antes da 1ª pergunta */}
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

            {/* região estável no DOM: o texto entra e sai sem remontar, pro
                leitor de tela anunciar sempre */}
            <p
              role="alert"
              className={cn(
                "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
                !erro && "sr-only"
              )}
            >
              {erro}
            </p>

            {/* title no wrapper: button disabled tem pointer-events-none e o
                hint "envio desligado" nunca apareceria sobre ele */}
            <div title={preview ? "Envio desligado na prévia" : undefined}>
              <Button
                type="submit"
                className="h-11 w-full md:h-10"
                disabled={pending || preview}
              >
                {pending ? (
                  <CircleNotch size={16} className="animate-spin" aria-hidden />
                ) : (
                  <PaperPlaneRight size={16} aria-hidden />
                )}
                {pending ? "Enviando…" : "Enviar resposta"}
              </Button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Rotulo({
  campo,
  n,
  htmlFor,
}: {
  campo: FormularioCampo;
  n: number;
  htmlFor?: string;
}) {
  const inner = (
    <>
      <span className="mr-1 text-muted-foreground tabular-nums">{n}.</span>
      {campo.label}
      {!campo.obrigatorio && (
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          (opcional)
        </span>
      )}
      {/* instrução da pergunta ("Responda com até 2 linhas…") mora na
          descricao — nos cards de secao ela já renderiza no header */}
      {campo.tipo !== "secao" && campo.descricao && (
        <span className="mt-0.5 block text-xs font-normal leading-relaxed text-muted-foreground">
          {campo.descricao}
        </span>
      )}
    </>
  );
  // fora de fieldset: <label> com for; dentro de grupos o caller usa <legend>
  return htmlFor ? (
    <label
      htmlFor={htmlFor}
      className="block text-[15px] font-medium leading-snug sm:text-base"
    >
      {inner}
    </label>
  ) : (
    <span className="block text-[15px] font-medium leading-snug sm:text-base">
      {inner}
    </span>
  );
}

/** Mensagem inline sob o campo — montada só quando há erro; o id é o
 *  alvo do aria-describedby do controle. */
function ErroCampo({ id, msg }: { id: string; msg: string | undefined }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-1.5 text-sm leading-snug text-destructive">
      {msg}
    </p>
  );
}

/** Input do "Outro" — aparece quando a escolha é a opção livre; o texto
 *  viaja em `${campo.id}__outro` e o submit compõe "Outro: <texto>"
 *  (mesmo formato que a RPC saneia). */
function CampoOutro({ campo, ativo }: { campo: FormularioCampo; ativo: boolean }) {
  if (!campo.permite_outro || !ativo) return null;
  return (
    <div className="mt-2">
      {/* "Outro" marcado pede o texto — o sanitizer só aceita
          "Outro: <1-120>"; a validação client marca o mesmo campo */}
      <Input
        name={`${campo.id}__outro`}
        placeholder="Qual?"
        maxLength={120}
        required
        aria-label={`${campo.label}: outro`}
      />
    </div>
  );
}

/** Upload de arquivo (REALIZA-70): escolhe → sobe via action pro bucket
 *  privado → o valor do campo é só o metadado {path,nome,tamanho} que a
 *  resposta grava. Sem o path ninguém baixa — o objeto nunca é público. */
function CampoArquivo({
  campo,
  token,
  valor,
  onValor,
  preview,
}: {
  campo: FormularioCampo;
  token: string;
  valor: RespostaValor | undefined;
  onValor: (id: string, v: RespostaValor | null) => void;
  preview: boolean;
}) {
  const [pending, start] = useTransition();
  const [erroUp, setErroUp] = useState<string | null>(null);
  const arq =
    valor && typeof valor === "object" && !Array.isArray(valor)
      ? (valor as { path: string; nome: string; tamanho: number })
      : null;

  function escolheu(file: File | null) {
    if (!file || pending) return;
    const maxMb = campo.max_mb ?? ARQUIVO_MAX_MB;
    if (file.size > maxMb * 1024 * 1024) {
      setErroUp(`Arquivo grande demais. Máximo ${maxMb} MB.`);
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    setErroUp(null);
    start(async () => {
      const r = await subirAnexoFormulario(token, campo.id, fd);
      if (r.error || !r.arquivo?.path) {
        setErroUp(r.error ?? "Não deu pra enviar. Tente de novo.");
        return;
      }
      onValor(campo.id, r.arquivo);
    });
  }

  return (
    <div>
      {/* o valor real viaja no hidden — coleta/validação leem o JSON do
          FormData como qualquer outro campo */}
      <input
        type="hidden"
        name={campo.id}
        value={arq ? JSON.stringify(arq) : ""}
      />
      {arq ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <FileText size={18} className="shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{arq.nome}</p>
            <p className="text-xs text-muted-foreground">
              {(arq.tamanho / 1024 / 1024).toFixed(1).replace(".", ",")} MB ·
              enviado
            </p>
          </div>
          <button
            type="button"
            onClick={() => onValor(campo.id, null)}
            aria-label={`Remover ${arq.nome}`}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <label
          className={cn(
            "flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            (pending || preview) && "pointer-events-none opacity-60"
          )}
        >
          {pending ? (
            <CircleNotch size={20} className="animate-spin" aria-hidden />
          ) : (
            <ArrowUp size={20} aria-hidden />
          )}
          <span className="font-medium">
            {pending ? "Enviando…" : "Toque pra escolher o arquivo"}
          </span>
          <span className="text-xs">
            PDF ou imagem · até {campo.max_mb ?? ARQUIVO_MAX_MB} MB
          </span>
          <input
            type="file"
            accept={(campo.accept ?? ARQUIVO_MIMES).join(",")}
            disabled={pending || preview}
            className="sr-only"
            onChange={(e) => escolheu(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      {erroUp && (
        <p className="mt-1.5 text-sm leading-snug text-destructive">{erroUp}</p>
      )}
    </div>
  );
}

function CampoRenderer({
  campo,
  n,
  erro,
  enterKeyHint,
  token,
  preview = false,
  valor,
  atual,
  onValor,
}: {
  campo: FormularioCampo;
  n: number;
  erro: string | undefined;
  enterKeyHint: "next" | "send";
  /** o upload precisa do token do link — a action valida token+campo */
  token: string;
  preview?: boolean;
  /** valor controlado (arquivo/grid) — vem do estado do form */
  valor?: RespostaValor;
  /** resposta atual do próprio campo — decide se o input "Outro" aparece */
  atual?: RespostaValor;
  onValor?: (id: string, v: RespostaValor | null) => void;
}) {
  const id = `f-${campo.id}`;
  const erroId = `${id}-erro`;
  // nos grupos (radio/checkbox) vai uma vez só no <fieldset> — não em cada
  // opção, senão o leitor de tela repete "inválido" N vezes
  const a11y = {
    "aria-invalid": erro ? true : undefined,
    "aria-describedby": erro ? erroId : undefined,
  };
  /* um card por pergunta (paradigma GForms): data-campo no card pro
     scrollIntoView do submit e o erro é o contorno do card inteiro — sem
     rings/borders internos divergentes */
  const cartao = cn(
    "rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5",
    erro && "ring-2 ring-destructive/60"
  );

  // seção é estrutura, não pergunta — divider editorial entre os cards,
  // sem numeração nem controle. A descrição leva a instrução do
  // instrumento ("Antes de responder", "Mapa de submetas"…)
  if (campo.tipo === "secao") {
    return (
      <header className="px-1 pb-1 pt-3 first:pt-1">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">
          {campo.label}
        </h2>
        {campo.descricao && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {campo.descricao}
          </p>
        )}
        <div aria-hidden className="mt-3 h-px bg-border" />
      </header>
    );
  }

  switch (campo.tipo) {
    case "texto": {
      /* o `formato` declarado troca teclado do celular e autofill; a
         normalização no submit faz o resto do resgate (REALIZA-118) */
      const formato = campoFormato(campo);
      const dicas =
        formato === "email"
          ? {
              type: "email",
              inputMode: "email" as const,
              autoComplete: "email",
              placeholder: "nome@exemplo.com",
            }
          : formato === "telefone"
            ? {
                type: "tel",
                inputMode: "tel" as const,
                autoComplete: "tel",
                placeholder: "(11) 99999-8888",
              }
            : formato === "url"
              ? {
                  type: "url",
                  inputMode: "url" as const,
                  placeholder: "linkedin.com/in/voce",
                }
              : {};
      return (
        <div className={cn(cartao, "space-y-1.5")} data-campo={campo.id}>
          <Rotulo campo={campo} n={n} htmlFor={id} />
          <Input
            id={id}
            name={campo.id}
            required={campo.obrigatorio}
            maxLength={500}
            enterKeyHint={enterKeyHint}
            {...dicas}
            {...a11y}
            placeholder={dicas.placeholder ?? "Escreva aqui…"}
          />
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );
    }

    case "texto_longo":
      // sem enterKeyHint: na textarea a tecla insere \n — o rótulo "enter"
      // (default do SO) descreve o gesto de verdade, "send"/"next" mentiria
      return (
        <div className={cn(cartao, "space-y-1.5")} data-campo={campo.id}>
          <Rotulo campo={campo} n={n} htmlFor={id} />
          <Textarea
            id={id}
            name={campo.id}
            required={campo.obrigatorio}
            rows={4}
            maxLength={5000}
            placeholder="Escreva com suas palavras…"
            {...a11y}
          />
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );

    case "data":
      return (
        <div className={cn(cartao, "space-y-1.5")} data-campo={campo.id}>
          <Rotulo campo={campo} n={n} htmlFor={id} />
          <Input
            id={id}
            name={campo.id}
            type="date"
            required={campo.obrigatorio}
            enterKeyHint={enterKeyHint}
            className="max-w-48"
            {...a11y}
          />
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );

    case "select":
      // select nativo: picker do SO no celular (o público aqui é mentorado no
      // WhatsApp) e required/FormData de graça
      return (
        <div className={cn(cartao, "space-y-1.5")} data-campo={campo.id}>
          <Rotulo campo={campo} n={n} htmlFor={id} />
          <div className="relative">
            <select
              id={id}
              name={campo.id}
              required={campo.obrigatorio}
              defaultValue=""
              className="h-11 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-9 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:h-8 md:text-sm"
              {...a11y}
            >
              <option value="" disabled>
                Escolha…
              </option>
              {(campo.opcoes ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              {campo.permite_outro && <option value="Outro">Outro</option>}
            </select>
            <CaretDown
              size={16}
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          {/* escolheu "Outro" → input livre; o submit compõe "Outro: <texto>" */}
          <CampoOutro campo={campo} ativo={atual === "Outro"} />
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );

    case "sim_nao":
      return (
        <fieldset className={cartao} data-campo={campo.id} {...a11y}>
          <legend>
            <Rotulo campo={campo} n={n} />
          </legend>
          <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(
              [
                { v: "sim", l: "Sim" },
                { v: "nao", l: "Não" },
              ] as const
            ).map((o) => (
              <label
                key={o.v}
                className="flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-muted-foreground transition-colors select-none has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:h-10"
              >
                <input
                  type="radio"
                  name={campo.id}
                  value={o.v}
                  required={campo.obrigatorio}
                  className="sr-only"
                />
                {o.l}
              </label>
            ))}
          </div>
          <ErroCampo id={erroId} msg={erro} />
        </fieldset>
      );

    case "escala_1_5":
      return (
        <fieldset className={cartao} data-campo={campo.id} {...a11y}>
          <legend>
            <Rotulo campo={campo} n={n} />
          </legend>
          <div className="mt-1.5 grid grid-cols-5 gap-1 rounded-xl bg-muted p-1">
            {[1, 2, 3, 4, 5].map((num) => (
              <label
                key={num}
                className="flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold tabular-nums text-muted-foreground transition-colors select-none has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:h-10"
              >
                <input
                  type="radio"
                  name={campo.id}
                  value={num}
                  required={campo.obrigatorio}
                  className="sr-only"
                  aria-label={`Nota ${num}`}
                />
                <span aria-hidden>{num}</span>
              </label>
            ))}
          </div>
          {/* sem pontas "Muito ruim"/"Muito bom": semanticamente erradas pra
              metade das perguntas — os números 1–5 já comunicam */}
          <ErroCampo id={erroId} msg={erro} />
        </fieldset>
      );

    case "escala_1_10":
      // a escala da Roda da Vida (0080) — 10 opções em 2×5 no mobile e
      // uma linha só no desktop; mesma mecânica do 1–5
      return (
        <fieldset className={cartao} data-campo={campo.id} {...a11y}>
          <legend>
            <Rotulo campo={campo} n={n} />
          </legend>
          <div className="mt-1.5 grid grid-cols-5 gap-1 rounded-xl bg-muted p-1 sm:grid-cols-10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
              <label
                key={num}
                className="flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold tabular-nums text-muted-foreground transition-colors select-none has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:h-10"
              >
                <input
                  type="radio"
                  name={campo.id}
                  value={num}
                  required={campo.obrigatorio}
                  className="sr-only"
                  aria-label={`Nota ${num} de 10`}
                />
                <span aria-hidden>{num}</span>
              </label>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Nada satisfeito</span>
            <span>Muito satisfeito</span>
          </div>
          <ErroCampo id={erroId} msg={erro} />
        </fieldset>
      );

    case "multi_select":
      return (
        <fieldset className={cartao} data-campo={campo.id} {...a11y}>
          <legend>
            <Rotulo campo={campo} n={n} />
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {campo.obrigatorio
                ? "Marque ao menos uma"
                : "Marque quantas fizerem sentido"}
            </span>
          </legend>
          <ul className="mt-1.5 space-y-1">
            {(campo.opcoes ?? []).map((o) => (
              <li key={o}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm transition-colors select-none hover:bg-muted active:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                  <input
                    type="checkbox"
                    name={campo.id}
                    value={o}
                    className="size-5 shrink-0 rounded accent-primary"
                  />
                  {o}
                </label>
              </li>
            ))}
            {campo.permite_outro && (
              <li>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm transition-colors select-none hover:bg-muted active:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                  <input
                    type="checkbox"
                    name={campo.id}
                    value="Outro"
                    className="size-5 shrink-0 rounded accent-primary"
                  />
                  Outro
                </label>
              </li>
            )}
          </ul>
          <CampoOutro
            campo={campo}
            ativo={Array.isArray(atual) && atual.includes("Outro")}
          />
          <ErroCampo id={erroId} msg={erro} />
        </fieldset>
      );

    case "checkbox":
      return (
        <div className={cartao} data-campo={campo.id}>
          {/* o card inteiro é o label: a margem negativa estica o alvo do
              clique sobre o padding do card — área de toque máxima no
              mobile. O ErroCampo fica fora do label (clique nele não
              alternaria a caixa) */}
          <label className="-m-4 flex cursor-pointer items-start gap-3 rounded-xl p-4 text-[15px] leading-relaxed transition-colors select-none has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 sm:-m-5 sm:p-5 sm:text-base">
            <input
              type="checkbox"
              name={campo.id}
              required={campo.obrigatorio}
              className="mt-0.5 size-4 shrink-0 accent-primary"
              {...a11y}
            />
            <span>
              <span className="mr-1 text-muted-foreground tabular-nums">
                {n}.
              </span>
              {campo.label}
              {!campo.obrigatorio && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  (opcional)
                </span>
              )}
            </span>
          </label>
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );

    case "arquivo":
      return (
        <div className={cn(cartao, "space-y-1.5")} data-campo={campo.id}>
          <Rotulo campo={campo} n={n} />
          <CampoArquivo
            campo={campo}
            token={token}
            valor={valor}
            onValor={onValor ?? (() => {})}
            preview={preview}
          />
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );

    case "grid_disponibilidade":
      // a grade é controlada e renderiza o próprio hidden com o JSON —
      // coleta/validação leem do FormData como qualquer outro campo
      return (
        <div className={cn(cartao, "space-y-1.5")} data-campo={campo.id}>
          <Rotulo campo={campo} n={n} />
          <GridDisponibilidade
            name={campo.id}
            value={valor ?? null}
            onChange={(v) => onValor?.(campo.id, v)}
          />
          <ErroCampo id={erroId} msg={erro} />
        </div>
      );

    default:
      return null;
  }
}
