"use client";

import {
  cloneElement,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Warning } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import {
  agendarEncontro,
  conflitoEncontro,
  desmarcarEncontro,
  disponibilidadesDaDupla,
  registrarEncontroRetroativo,
  type ConflitoEncontro,
} from "@/lib/actions";
import {
  avisoDisponibilidade,
  formatDiaHora,
  textoAvisoDisponibilidade,
  toDateStr,
  type AvisoDisponibilidade,
} from "@/lib/ciclo";
import type { Encontro } from "@/lib/types";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { elementoReal } from "@/lib/elemento-lazy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SeletorDiaHora } from "@/components/seletor-dia-hora";

/** "YYYY-MM-DDTHH:mm" local → par civil pro seletor. */
function splitLocal(v: string): { data: string; hora: string } {
  return { data: v.slice(0, 10), hora: v.slice(11, 16) };
}
/** horário local "YYYY-MM-DDTHH:mm" — a comparação civil dos modos. */
function paraInputLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Agenda OU registra o encontro nº `numero` da dupla — data passada cria o
 * encontro já realizado (fluxo retroativo) e leva direto pro follow-up, em vez
 * de devolver um erro apontando pra outro lugar. Com `atual` (remarcação),
 * data passada segue proibida — mover agendado pro passado esconderia atraso.
 * O dia+hora usa o SeletorDiaHora em modo manual (530): os dois campos
 * nativos separados, motivo como slot quando a data muda.
 */
export function AgendarEncontroDialog({
  duplaId,
  numero,
  atual,
  sugerido,
  proposta,
  piso,
  jovemNome,
  ocupados,
  rotulo,
  trigger,
  onCreated,
  open: openProp,
  onOpenChange,
}: {
  duplaId: string;
  numero: number;
  atual: Encontro | null;
  /** "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm" — pré-preenche a data quando não é
   *  remarcação; dia solto entra às 19h, a grade de horários (REALIZA-25)
   *  chega com a hora do slot clicado. */
  sugerido?: string;
  /** Proposta de data NOVA pra remarcação (a sugestão do plano "Para ficar
   *  em dia", REALIZA-397). Preenche o campo no lugar da data atual — como
   *  a data já vem mudada, o motivo nasce obrigatório. */
  proposta?: string;
  /** YYYY-MM-DD do início da dupla — a sugestão nunca cai antes dele (o
   *  retroativo rejeitaria a data oficial de um encontro pré-dupla). */
  piso?: string;
  /** Primeiro nome do mentorado — sai no aviso de horário sobreposto. */
  jovemNome?: string;
  /** Instantes já reservados bloqueados no seletor — mesma fonte das
   *  agendas/plano, mesmo quando o dialog segue em modo manual. */
  ocupados?: import("@/lib/sugestoes-encontro").OcupadoRotulado[];
  /** Como o encontro aparece no título/toasts — default "Nº encontro". Na
   *  trilha especialista a remarcação é de uma sessão que nasceu de pedido:
   *  o rótulo diz isso ("sessão de especialista") sem número de passo. */
  rotulo?: string;
  /** Elemento do trigger — default é o botão padrão da casa. `null` suprime
   *  o trigger embutido: a grade de horários abre o dialog de forma
   *  controlada, a partir do clique na coluna do dia. */
  trigger?: React.ReactElement | null;
  /** Só no ramo retroativo (data passada): recebe (id do encontro criado,
   *  "YYYY-MM-DD" dele) e substitui a navegação pra ficha — a agenda usa pra
   *  abrir o registro inline no dia em que ele caiu. */
  onCreated?: (encontroId: string, dia: string) => void;
  /** Modo controlado (opcional): o pai segura o estado — a grade de horários
   *  abre o dialog com o slot clicado sem depender de trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  const [pending, start] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const linkRef = useRef<HTMLInputElement | null>(null);
  // overlap com sessão da OUTRA dupla do mesmo jovem — warning, não bloqueio.
  // Guardado com a data consultada: resposta atrasada de data que já mudou
  // não vira aviso mentiroso
  const [conflito, setConflito] = useState<{
    para: string;
    lista: ConflitoEncontro[];
  } | null>(null);
  const timerConflito = useRef<ReturnType<typeof setTimeout> | null>(null);
  // grades dos dois lados (uma leitura por abertura) + o aviso que já foi
  // mostrado, guardado com a data consultada: confirmar vale só pra ELA —
  // trocar a data exige novo aviso, como o debounce do conflito
  const [grades, setGrades] = useState<Awaited<
    ReturnType<typeof disponibilidadesDaDupla>
  > | null>(null);
  const [avisoDisp, setAvisoDisp] = useState<{
    para: string;
    quando: Date;
    aviso: AvisoDisponibilidade;
  } | null>(null);
  // id do card recém-criado — scroll quando o refresh terminar (o card não
  // existia no DOM velho, então o hash sozinho não rola)
  const scrollTarget = useRef<string | null>(null);
  const router = useRouter();

  const valorAtual = atual?.data_hora
    ? paraInputLocal(new Date(atual.data_hora))
    : null;
  const propostaLocal = proposta
    ? proposta.includes("T")
      ? proposta
      : `${proposta}T19:00`
    : null;
  const agora = paraInputLocal(new Date());
  const hoje = toDateStr(new Date());
  // a grade de horários passa o slot completo ("…T19:30"); o clique no mês/
  // no dia continua chegando só com a data — entra às 19h, o horário típico
  const sugeridoLocal = sugerido
    ? sugerido.includes("T")
      ? sugerido
      : `${sugerido}T19:00`
    : "";
  // encontro novo: o dia sugerido vale mesmo já passado — cai no ramo
  // retroativo; mas nunca antes do início da dupla (a action rejeitaria)
  const pisoLocal = piso ? `${piso}T19:00` : "";
  const sugeridoAjustado =
    sugeridoLocal && pisoLocal && sugeridoLocal < pisoLocal
      ? pisoLocal
      : sugeridoLocal;
  // na remarcação o prefill só vale se futuro — o encontro vencido abre
  // vazio com o aviso "estava marcado pra…" pedindo a data nova
  const viavel = (v: string | null): string | null =>
    v != null && (!atual || v > agora) ? v : null;
  const defaultValue =
    viavel(propostaLocal) ??
    viavel(valorAtual) ??
    viavel(sugeridoAjustado) ??
    "";
  const inicial = defaultValue ? splitLocal(defaultValue) : null;
  // a comparação do motivo é sempre com o encontro de origem — com
  // `proposta` o inicial já vem diferente e o motivo nasce obrigatório
  const compararCom = valorAtual ? splitLocal(valorAtual) : null;

  // valor vivo do par escolhido — o espelho que decide o modo dual e o
  // debounce do conflito sem o seletor vazar estado
  const [valorData, setValorData] = useState(defaultValue);
  const mudaSel = (sel: { data: string | null; hora: string | null }) => {
    setValorData(sel.data && sel.hora ? `${sel.data}T${sel.hora}` : "");
    // data nova pede confirmação nova — o aviso da anterior cai
    setAvisoDisp(null);
  };

  // modo retroativo só existe pra encontro novo (sem row editável)
  const ehRetroativo = !atual && valorData !== "" && valorData <= agora;
  // sujeito neutro pro copy — "4º encontro" no DPP, "sessão de especialista"
  // na remarcação de pedido aceito; os verbos ficam sem gênero de propósito
  const nome = rotulo ?? `${numero}º encontro`;

  useEffect(() => {
    if (pending) return;
    const alvo = scrollTarget.current;
    if (!alvo) return;
    scrollTarget.current = null;
    // o guard global de prefers-reduced-motion cobre CSS, não o behavior
    // do scrollIntoView — checa aqui (mesmo padrão do trilha-jornada)
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(alvo)
      ?.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
  }, [pending]);

  // warning de overlap (0072): debounce na data — a RPC olha as outras
  // duplas do mesmo jovem (a de especialista o mentor não lê pela RLS);
  // falha vira lista vazia — é aviso, nunca bloqueio do submit
  useEffect(() => {
    if (timerConflito.current) clearTimeout(timerConflito.current);
    if (!open || !valorData) return;
    const v = valorData;
    timerConflito.current = setTimeout(() => {
      conflitoEncontro(duplaId, v)
        .then((res) => setConflito({ para: v, lista: res.conflitos ?? [] }))
        .catch(() => setConflito({ para: v, lista: [] }));
    }, 400);
    return () => {
      if (timerConflito.current) clearTimeout(timerConflito.current);
    };
  }, [valorData, duplaId, open]);
  const conflitos = conflito?.para === valorData && open ? conflito.lista : [];

  // grades de disponibilidade: uma leitura por abertura, sem bloquear o
  // dialog — falha (ou trilha especialista, que a action devolve vazia) vira
  // null e o submit segue sem o aviso
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    disponibilidadesDaDupla(duplaId)
      .then((res) => {
        if (vivo) setGrades(res);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [open, duplaId]);
  // o aviso só vale pra data que o gerou — vale também como "já confirmou":
  // o submit que chega com o aviso visível é o "mesmo assim" do usuário
  const avisoDispVisivel =
    avisoDisp != null && avisoDisp.para === valorData ? avisoDisp : null;
  // primeiro nome pro texto do aviso — a prop ganha, senão o que a action
  // leu junto das grades
  const nomeJovemAviso = jovemNome ?? grades?.jovemNome ?? undefined;

  function confirmar(
    data: string,
    hora: string,
    n: number,
    motivo: { preset: string; outro: string } | null
  ) {
    // o par civil vai naïve; o server resolve o instante
    const local = `${data}T${hora}`;
    const agoraFresco = paraInputLocal(new Date());
    // remarcação é sempre pra frente — mover agendado pro passado
    // esconderia atraso (o retroativo é só pra encontro novo)
    if (atual && local <= agoraFresco) {
      setAviso("Remarcar é sempre pra frente. Escolha uma data futura.");
      return;
    }
    const retroativo = !atual && local <= agoraFresco;
    // aviso de disponibilidade: só data FUTURA — o retroativo registra o
    // que já aconteceu, alertar grade depois do fato seria ruído. Aviso é
    // por data: o mesmo valor re-submetido é a confirmação "mesmo assim"
    const quando = new Date(local);
    if (
      grades &&
      !isNaN(quando.getTime()) &&
      local > agoraFresco &&
      avisoDisp?.para !== local
    ) {
      const a = avisoDisponibilidade(grades.mentor, grades.jovem, quando);
      if (a) {
        setAvisoDisp({ para: local, quando, aviso: a });
        return;
      }
    }
    const link = retroativo ? null : (linkRef.current?.value.trim() || null);
    start(async () => {
      try {
        if (retroativo) {
          const res = await registrarEncontroRetroativo(duplaId, n, local);
          if (res?.error) {
            setAviso(res.error);
            return;
          }
          toast.success("Encontro registrado. Agora complete o registro.");
          mudaOpen(false);
          if (res.encontroId) {
            if (onCreated) {
              // a agenda navega pro dia do encontro e abre o form nela —
              // "local" é o datetime naïve (horário de SP), o dia é o slice
              onCreated(res.encontroId, local.slice(0, 10));
            } else {
              scrollTarget.current = `registrar-${res.encontroId}`;
              // cobre a navegação entre páginas (ex.: registrar a partir da agenda)
              // ?aba= explícito: na própria ficha o AbaPorHash não roda de
              // novo (só no mount) e o form mora na aba Encontros
              router.push(
                `/duplas/${duplaId}?aba=encontros#registrar-${res.encontroId}`
              );
              // pushState não dispara hashchange — avisa os cards pra abrir o
              // form do encontro recém-criado (mesma página) ou ignorar (outra)
              window.dispatchEvent(new Event("realiza:hash"));
            }
          }
          router.refresh();
          return;
        }
        const fd = new FormData();
        fd.set("dupla_id", duplaId);
        fd.set("numero", String(n));
        fd.set("data_hora", local);
        fd.set("link", link ?? "");
        fd.set("motivo", motivo?.preset ?? "");
        fd.set("motivo_outro", motivo?.outro ?? "");
        const res = await agendarEncontro(fd);
        if (res?.error) {
          setAviso(res.error);
        } else {
          toast.success(
            atual
              ? `Remarcação confirmada: ${nome}.`
              : `Agendamento confirmado: ${nome}.`
          );
          mudaOpen(false);
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  // estado fresco por abertura — a borda de subida é o evento confiável
  // (a abertura controlada chega pela prop, sem mudaOpen): o seletor reseta
  // os campos, aqui caem avisos, grades e o espelho de visitas anteriores
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) {
      setAviso(null);
      setAvisoDisp(null);
      setConflito(null);
      setGrades(null);
      setValorData(defaultValue);
    }
  }

  // fecha pelo estado interno E avisa o pai — no modo controlado é ele quem
  // desmonta o dialog (a grade limpa o slot clicado)
  function mudaOpen(o: boolean) {
    setOpenInterno(o);
    onOpenChange?.(o);
  }

  // trigger via RSC chega lazy — resolve antes de clonar (elementoReal)
  const gatilho =
    trigger === null
      ? null
      : cloneElement(
          elementoReal(
            trigger ?? (
              <Button
                variant={atual ? "outline" : "default"}
                size="sm"
                data-telemetry-alvo="agendar-encontro"
              >
                <CalendarPlus size={16} />
                {atual ? "Remarcar" : "Agendar encontro"}
              </Button>
            )
          ),
          { onClick: () => mudaOpen(true), "aria-haspopup": "dialog" }
        );

  return (
    <>
      {gatilho}
      <SeletorDiaHora
        aberto={open}
        onAberto={mudaOpen}
        numero={numero}
        modo="futuro"
        hoje={hoje}
        // remarcação aceita só futuro (piso civil = hoje); o agendar dual
        // fica sem piso — data passada é o caminho do retroativo
        piso={atual ? hoje : ""}
        inicial={inicial}
        pedeMotivo={atual != null}
        compararCom={compararCom}
        titulo={
          <>
            {nome}
            {/* data passada = fluxo retroativo (REALIZA-97): o título
                sinaliza o modo antes do submit "Registrar encontro" — mesma
                gramática da tag "registro pendente" das linhas de encontro */}
            {ehRetroativo && (
              <Badge
                variant="outline"
                className="border-[var(--warn)] text-[var(--warn-text)]"
              >
                entra como realizado
              </Badge>
            )}
          </>
        }
        descricao="Marque a data e o horário. Se a data mudou, conte o motivo da remarcação."
        rotuloConfirmar={
          avisoDispVisivel
            ? atual
              ? "Remarcar mesmo assim"
              : "Agendar mesmo assim"
            : ehRetroativo
              ? "Registrar encontro"
              : atual
                ? "Confirmar remarcação"
                : "Confirmar agendamento"
        }
        rodapeExtra={
          <>
            {/* "outro horário" só esconde o aviso — a data fica nos campos
                pra o usuário trocar; o submit dele pede nova confirmação */}
            {avisoDispVisivel && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setAvisoDisp(null)}
              >
                Escolher outro horário
              </Button>
            )}
            {/* desmarcar é a saída honesta pra um agendado futuro que não
                vai rolar (0072 — RPC bilateral; passado vai pro "não
                aconteceu"). O mentor não tem delete por RLS (0047
                coord-only) — a RPC é o caminho dos dois lados. */}
            {atual?.status === "agendado" &&
              atual.data_hora != null &&
              new Date(atual.data_hora) > new Date() && (
                <ConfirmDeleteButton
                  titulo={`Desmarcar ${rotulo ? "a " : "o "}${nome}?`}
                  descricao="O encontro sai da agenda. Vocês podem marcar de novo quando combinarem."
                  acao="Desmarcar"
                  sucesso="Encontro desmarcado."
                  onConfirm={async () => {
                    const res = await desmarcarEncontro(atual.id);
                    if (!res?.error) mudaOpen(false);
                    return res;
                  }}
                  trigger={
                    <Button
                      variant="ghost"
                      className="text-muted-foreground"
                    >
                      Desmarcar encontro
                    </Button>
                  }
                />
              )}
          </>
        }
        pending={pending}
        aviso={aviso}
        onAviso={setAviso}
        ocupadosExtra={ocupados?.filter((o) => o.inicio !== atual?.data_hora)}
        onMudanca={mudaSel}
        onConfirmar={confirmar}
      >
        {!atual && (
          <p className="text-xs text-muted-foreground">
            Se o encontro já aconteceu, escolha a data real. Ele entra como
            realizado.
          </p>
        )}
        {/* o campo abre vazio (o valor velho seria inválido) — a linha
            devolve o contexto: data original + pedido da nova */}
        {atual?.data_hora && valorAtual && valorAtual <= agora && (
          <p className="text-xs text-muted-foreground">
            Estava marcado pra {formatDiaHora(atual.data_hora)}.{" "}
            {propostaLocal
              ? "Confirme a sugestão ou escolha outra data."
              : "Escolha a nova data e horário."}
          </p>
        )}
        {propostaLocal && (
          <p className="text-xs text-muted-foreground">
            Sugestão do plano pra ficar em dia
            {atual?.data_hora
              ? `, antes estava marcado pra ${formatDiaHora(atual.data_hora)}`
              : ""}
            . Ajuste se precisar.
          </p>
        )}
        {conflitos.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--warn-text)]">
            <Warning size={13} aria-hidden className="mt-0.5 shrink-0" />
            {jovemNome ?? "O mentorado"} tem{" "}
            {conflitos[0].trilha === "especialista"
              ? "sessão de especialista"
              : "encontro de mentoria"}{" "}
            marcada pra {formatDiaHora(conflitos[0].data_hora)}
            {conflitos.length > 1 && ` (e mais ${conflitos.length - 1})`}.
            Confirme antes de seguir.
          </p>
        )}
        {/* aviso de disponibilidade — mesmo visual do conflito: texto âmbar
            com Warning, confirmação no próprio dialog */}
        {avisoDispVisivel && (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--warn-text)]">
            <Warning size={13} aria-hidden className="mt-0.5 shrink-0" />
            {textoAvisoDisponibilidade(
              avisoDispVisivel.aviso,
              nomeJovemAviso,
              avisoDispVisivel.quando
            )}{" "}
            Quer {atual ? "remarcar" : "agendar"} mesmo assim?
          </p>
        )}
        {/* link não se aplica a encontro que já aconteceu — nasce "externo"
            e sem link de chamada. Esconder evita campo mentiroso. */}
        {!ehRetroativo && (
          <div className="space-y-2">
            <Label htmlFor="link">Link da chamada (opcional)</Label>
            <Input
              ref={linkRef}
              id="link"
              type="url"
              placeholder="https://meet.google.com/…"
              defaultValue={atual?.link ?? ""}
            />
          </div>
        )}
      </SeletorDiaHora>
    </>
  );
}
