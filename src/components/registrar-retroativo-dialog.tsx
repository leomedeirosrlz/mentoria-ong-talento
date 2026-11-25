"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { ClockCounterClockwise } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { registrarEncontroRetroativo } from "@/lib/actions";
import { formatDate, toDateStr, type EncontroFaltante } from "@/lib/ciclo";
import { Button } from "@/components/ui/button";
import { elementoReal } from "@/lib/elemento-lazy";
import { SeletorDiaHora } from "@/components/seletor-dia-hora";

/** horário local "YYYY-MM-DDTHH:mm" — o clamp "cai em agora" compara civil. */
function paraInputLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Encontro que aconteceu sem agendamento prévio (combinado por WhatsApp etc.).
 * Nasce realizado com origem "externo" e leva direto pro follow-up. O "quando
 * foi" usa o SeletorDiaHora em modo retroativo (530): campos nativos
 * separados, dia limitado a hoje pra trás.
 */
export function RegistrarRetroativoDialog({
  duplaId,
  faltantes,
  trigger,
  numeroInicial,
  quandoPadrao,
  onCreated,
  esp,
  open: openProp,
  onOpenChange,
}: {
  duplaId: string;
  faltantes: EncontroFaltante[];
  /** Elemento do trigger — `null` suprime (o pai abre controlado). */
  trigger?: React.ReactElement | null;
  /** Pré-seleciona o encontro — a agenda já sabe qual dia o usuário clicou. */
  numeroInicial?: number;
  /** YYYY-MM-DD — pré-preenche "quando foi" (19h, caindo em agora se não passou). */
  quandoPadrao?: string;
  /** Recebe (id do encontro criado, "YYYY-MM-DD" dele) e substitui a navegação
   *  pra ficha — a agenda usa pra abrir o registro inline no dia em que ele caiu. */
  onCreated?: (encontroId: string, dia: string) => void;
  /** Trilha de especialista: faltantes vêm em passo do guia e a sessão nasce
   *  com numero-tentativa derivado no server (0074) — a UI fala em "passo". */
  esp?: boolean;
  /** Modo controlado (opcional) — o ⋯/a grade abre o dialog direto. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  const [aviso, setAviso] = useState<string | null>(null);
  // id do card recém-criado — o efeito abaixo rola até ele quando o refresh
  // termina (router.push com hash não rola: o card não existia no DOM velho)
  const scrollTarget = useRef<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  // vocabulário da trilha — especialista fala em sessão/passo (0074)
  const nome = esp ? "sessão" : "encontro";
  const rotuloFaltante = useCallback(
    (f: EncontroFaltante) =>
      esp
        ? `Passo ${f.numero}`
        : f.dataSugerida
          ? `${f.numero}º encontro · sugerido ${formatDate(f.dataSugerida)}`
          : `${f.numero}º encontro`,
    [esp]
  );
  const agora = paraInputLocal(new Date());
  const hoje = toDateStr(new Date());

  // "quando foi" por candidato: o dia sugerido às 19h (a data oficial do
  // guia entra como sugestão); sem sugestão ou ainda não passou, cai em
  // agora — o mesmo clamp do input max do fluxo antigo
  const clampAgora = (pre: string) => (pre > agora ? agora : pre);
  const parDe = (base: string | null | undefined) => {
    if (!base) return null;
    const v = clampAgora(`${base}T19:00`);
    return { data: v.slice(0, 10), hora: v.slice(11, 16) };
  };
  const parDoNumero = (num: number | null) => {
    const f = faltantes.find((x) => x.numero === num);
    // sem data oficial (especialista) o prefill cai em agora
    const v = clampAgora(`${f?.dataSugerida ?? hoje}T19:00`);
    return { data: v.slice(0, 10), hora: v.slice(11, 16) };
  };
  const inicial = quandoPadrao
    ? parDe(quandoPadrao)
    : parDoNumero(numeroInicial ?? null);

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

  // estado fresco por abertura — o seletor reseta os campos na borda de
  // subida; aqui cai o aviso de uma visita anterior
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) setAviso(null);
  }

  function mudaOpen(o: boolean) {
    setOpenInterno(o);
    onOpenChange?.(o);
  }

  function confirmar(data: string, hora: string, n: number) {
    // o par civil vai naïve — o server lê como horário de SP
    const local = `${data}T${hora}`;
    start(async () => {
      try {
        const res = await registrarEncontroRetroativo(duplaId, n, local);
        if (res?.error) {
          setAviso(res.error);
        } else {
          toast.success(
            `${esp ? "Sessão" : "Encontro"} registrad${esp ? "a" : "o"}. Agora complete o registro.`
          );
          mudaOpen(false);
          if (res.encontroId) {
            if (onCreated) {
              // a agenda navega pro dia do encontro e abre o form nela — "local"
              // é o datetime naïve (horário de SP), o dia de calendário é o slice
              onCreated(res.encontroId, local.slice(0, 10));
            } else {
              scrollTarget.current = `registrar-${res.encontroId}`;
              // cobre a navegação entre páginas (ex.: registrar a partir da home)
              // ?aba= explícito: na própria ficha o AbaPorHash não roda de
              // novo (só no mount) e o form mora na aba Encontros
              router.push(`/duplas/${duplaId}?aba=encontros#registrar-${res.encontroId}`);
              // pushState não dispara hashchange — avisa os cards pra abrir o
              // form do encontro recém-criado (mesma página) ou ignorar (outra)
              window.dispatchEvent(new Event("realiza:hash"));
            }
          }
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  // trigger via RSC chega lazy — resolve antes de clonar (elementoReal)
  const gatilho =
    trigger === null
      ? null
      : cloneElement(
          elementoReal(
            trigger ?? (
              <Button variant="outline" size="sm">
                <ClockCounterClockwise size={16} />
                Registrar {nome}
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
        numero={numeroInicial ?? faltantes[0]?.numero ?? 0}
        numeros={faltantes.map((f) => f.numero)}
        encontroPrimario={faltantes.length > 0}
        idEncontro="retro-numero-select"
        rotuloEncontro={`Qual ${esp ? "passo" : "encontro"} foi`}
        rotuloNumero={(n) =>
          rotuloFaltante(faltantes.find((f) => f.numero === n)!)
        }
        dataPorNumero={(n) => parDoNumero(n)}
        modo="retroativo"
        hoje={hoje}
        rotuloDia="Quando foi"
        titulo={`Registrar ${nome} que já aconteceu`}
        descricao={`Se encontraram sem agendar por aqui (combinaram por WhatsApp, por exemplo), conte quando foi. ${esp ? "A sessão" : "O encontro"} já nasce como realizad${esp ? "a" : "o"} e você completa o registro em seguida.`}
        inicial={inicial}
        rotuloConfirmar={`Registrar ${nome}`}
        pending={pending}
        aviso={aviso}
        onAviso={setAviso}
        onConfirmar={confirmar}
      />
    </>
  );
}
