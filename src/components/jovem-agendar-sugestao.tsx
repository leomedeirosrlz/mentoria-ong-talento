"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import {
  CalendarCheck,
  CheckCircle,
  ClockCounterClockwise,
} from "@phosphor-icons/react";

import { agendarEncontroJovem, conflitoEncontro } from "@/lib/actions";
import { diaSemanaDe, formatDiaHora } from "@/lib/ciclo";
import { ocupadoEmChoque, rotuloOrigem } from "@/lib/sugestoes-encontro";
import type { SugestoesEncontro } from "@/lib/sugestoes-encontro-server";
import { Button } from "@/components/ui/button";
import { FadeTroca } from "@/components/ui/etapa";
import {
  SeletorDiaHora,
  ddmm,
  dowLongo,
  fimDe,
} from "@/components/seletor-dia-hora";

// ---------- cartão "Próximo passo" + seletor de dia/horário (REALIZA-481) ----------
// Agendar vira uma sugestão que o jovem confirma, não um formulário vazio:
// o motor (480) propõe data+hora com origem, o toque único marca; quem quer
// outro dia abre a sheet (mobile) / dialog (desktop) do SeletorDiaHora —
// chips de dia e de hora, os dois campos nativos separados, nunca um
// datetime-local. O seletor é compartilhado com o combinado (482).

/** Rótulo do choque que a RPC acha — o jovem não conhece a trilha pelo número. */
const rotuloTrilha = (trilha: string | null | undefined) =>
  trilha === "especialista"
    ? "sessão de especialista"
    : "encontro de mentoria";

export function JovemAgendarSugestao({
  duplaId,
  numero,
  numeros,
  comQuem,
  sugestoes,
  titulo = "Próximo passo",
  plano,
}: {
  duplaId: string;
  /** Nº pré-selecionado — o próximo livre depois do último realizado. */
  numero: number;
  /** Todos os nº livres — alimenta o link raro "Outro encontro". */
  numeros: number[];
  /** Primeiro nome do mentor — "7º encontro com Ricardo" e o aviso. */
  comQuem: string;
  sugestoes: SugestoesEncontro;
  titulo?: string;
  /** "Sua semana" (combinado da dupla) — extensão do hero, como a
   *  `plano` da Casca dos demais ramos do ProximoEncontro. */
  plano?: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  // cada abertura remonta o seletor (key): a sheet não guarda estado velho
  const [sessao, setSessao] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [marcado, setMarcado] = useState<{
    numero: number;
    data: string;
    hora: string;
  } | null>(null);

  const principal = sugestoes.principal;

  /** O toque único do cartão e o "Confirmar" do seletor dividem o mesmo
   *  submit: choque local primeiro (cobre todas as duplas — a RPC só olha
   *  as outras), a RPC reconferindo o estado do servidor, aí o write. */
  const marcar = (data: string, hora: string, num: number) =>
    start(async () => {
      setAviso(null);
      const choque = ocupadoEmChoque(
        new Date(`${data}T${hora}:00-03:00`),
        sugestoes.ocupados,
        sugestoes.duracaoMin
      );
      if (choque) {
        setAviso(
          `Nesse horário você tem ${choque.rotuloArtigo || choque.rotulo || "outro compromisso"}.`
        );
        return;
      }
      const { conflitos } = await conflitoEncontro(duplaId, `${data}T${hora}`);
      if (conflitos.length > 0) {
        const c = conflitos[0];
        setAviso(
          `Você tem ${rotuloTrilha(c.trilha)} marcada pra ${formatDiaHora(c.data_hora)}. Confirme antes de seguir.`
        );
        return;
      }
      const r = await agendarEncontroJovem(
        duplaId,
        num,
        `${data}T${hora}`,
        null,
        null
      );
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setAberto(false);
      setMarcado({ numero: num, data, hora });
      toast.success(`${num}º encontro agendado.`);
      router.refresh();
    });

  if (!principal) return null; // sem data viável na janela — não prometer gesto impossível

  const dow = diaSemanaDe(principal.data);
  const dataCurta = ddmm(principal.data);

  // troca de estado do kit: a seção "marcado" recebe o foco — o botão que
  // confirmou desmonta junto com a sugestão (crossfade, não cascata)
  return (
    <FadeTroca chave={marcado ? "ok" : "sugestao"} foco>
      {marcado ? (
        <section
          aria-labelledby="agendar-sugestao-titulo"
          className="rounded-xl border border-[var(--destaque-borda)] bg-[var(--destaque-suave)] p-5 sm:p-6"
        >
          <h2
            id="agendar-sugestao-titulo"
            className="text-xs font-semibold uppercase tracking-[0.08em]"
          >
            {titulo}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-tight">
            <CheckCircle
              size={22}
              weight="fill"
              aria-hidden
              className="text-[var(--ok-text)]"
            />
            {marcado.numero}º encontro com {comQuem}
          </p>
          <p className="mt-1 text-sm">
            Marcado para {diaSemanaDe(marcado.data)} {ddmm(marcado.data)} às{" "}
            {marcado.hora}
          </p>
          {numeros.length > 0 && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setMarcado(null)}
              >
                Agendar outro encontro
              </Button>
            </div>
          )}
          {plano}
        </section>
      ) : (
        <section
          aria-labelledby="agendar-sugestao-titulo"
          className="rounded-xl border border-[var(--destaque-borda)] bg-[var(--destaque-suave)] p-5 sm:p-6"
        >
          <h2
            id="agendar-sugestao-titulo"
            className="text-xs font-semibold uppercase tracking-[0.08em]"
          >
            {titulo}
          </h2>
          <p className="mt-2 text-xl font-semibold tracking-tight text-balance">
            {numero}º encontro com {comQuem}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Sem data ainda</p>

          <div className="mt-3 space-y-1.5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CalendarCheck
                size={16}
                aria-hidden
                className="shrink-0 text-muted-foreground"
              />
              {dowLongo(principal.data).replace("-feira", "")}, {dataCurta}, das{" "}
              {principal.hora} às {fimDe(principal.hora, sugestoes.duracaoMin)}
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClockCounterClockwise size={14} aria-hidden className="shrink-0" />
              {rotuloOrigem(principal.origem)}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              disabled={pending}
              onClick={() => marcar(principal.data, principal.hora, numero)}
            >
              {pending ? "Marcando…" : `Marcar para ${dow} ${dataCurta} às ${principal.hora}`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAviso(null);
                setSessao((s) => s + 1);
                setAberto(true);
              }}
            >
              Escolher outro dia
            </Button>
          </div>
          {aviso && (
            <p role="status" className="mt-2 text-sm text-destructive">
              {aviso}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {comQuem} recebe um aviso na hora.
          </p>
          {plano}

          <SeletorDiaHora
            key={sessao}
            aberto={aberto}
            onAberto={setAberto}
            numero={numero}
            numeros={numeros}
            comQuem={comQuem}
            inicial={principal}
            sugestoes={sugestoes}
            pending={pending}
            aviso={aviso}
            onAviso={setAviso}
            onConfirmar={marcar}
          />
        </section>
      )}
    </FadeTroca>
  );
}
