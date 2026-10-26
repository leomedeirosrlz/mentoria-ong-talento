"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CaretLeft, CaretRight, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { salvarRegistro } from "@/lib/actions";
import { demoAtivoClient } from "@/lib/demo/shared";
import { createClient } from "@/lib/supabase/client";
import {
  atualizarTentativa,
  concluirTentativa,
  iniciarTentativa,
} from "@/lib/tentativa-registro";
import {
  ATIVIDADES_ENCONTRO,
  formatDiaMes,
  PROXIMO_PASSO_LABEL,
  toDateStr,
  type PassoGuia,
} from "@/lib/ciclo";
import type {
  Dificuldade,
  Encaminhamento,
  ProximoPasso,
  Registro,
  RegistroAnexo,
  Trilha,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnexosRegistro } from "@/components/anexos-registro";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Enc = { id: string; descricao: string; responsavel: "mentor" | "mentorado"; prazo: string };

// sem items o trigger fechado mostra o value cru do enum ("aprendizagem")
const DIFICULDADE_OPCOES: Record<string, string> = {
  nenhuma: "Não",
  aprendizagem: "Sim, de aprendizagem",
  participacao: "Sim, de participação",
  comportamental: "Sim, comportamental",
  organizacao: "Sim, de organização/rotina",
  outro: "Outro",
};

const RESPONSAVEL_OPCOES: Record<string, string> = {
  mentorado: "Mentorado",
  mentor: "Mentor",
};

// encontros.duracao_min — o guia fixa 1h por sessão, mas o registro é onde a
// duração real é informada (default 60 = o que o banco já assume)
const DURACAO_OPCOES: Record<string, string> = {
  "30": "30 min",
  "45": "45 min",
  "60": "1h",
  "90": "1h30",
  "120": "2h",
};

const ETAPAS = ["Como foi", "Sinais de atenção", "Combinados"] as const;

// identidade estável pro `anexos` da etapa pós-save — a lista mostrada no
// AnexosRegistro deriva da prop + deltas otimistas, e uma referência fixa
// mantém o useMemo dele barato a cada re-render do form
const SEM_ANEXOS: RegistroAnexo[] = [];

/** Rascunho local do form — autosave no localStorage pra refresh não perder tudo. */
type RegistroDraft = {
  savedAt: string;
  tema: string;
  ferramenta: string;
  duracaoMin: string;
  reflexoes: string;
  observacoes: string;
  atividades: string[];
  atividadeOutro: string;
  avaliacao: string;
  dificuldade: string;
  dificuldadeDetalhe: string;
  proximoPasso: string;
  proximoPassoDetalhe: string;
  precisaApoio: boolean;
  encaminhamentos: Enc[];
  concluirIds: string[];
};

export function RegistroForm({
  encontroId,
  duplaId,
  evento,
  trilha = null,
  registro = null,
  combinadosPendentes,
  onSaved,
  embutido = false,
  origem,
}: {
  encontroId: string;
  duplaId: string;
  /** Passo do guia da trilha — título/instrumentos (DPP) ou foco (especialista). */
  evento: PassoGuia | null;
  /** Trilha da dupla — decide a linha de privacidade (K6). Quando o host não
   *  repassa (ficha), o form resolve sozinho pela dupla. */
  trilha?: Trilha | null;
  registro?: Registro | null;
  /** Encaminhamentos da dupla ainda não feitos (status !== "feito"), por prazo. */
  combinadosPendentes?: Encaminhamento[];
  /** Chamado após toda gravação bem-sucedida — ex.: fechar o host. */
  onSaved?: () => void;
  /** Dentro de outra superfície (modal): sem moldura nem título próprios —
   *  o host fornece ambos. */
  embutido?: boolean;
  /** Telemetria (REALIZA-217): a superfície que abriu o form. Os hosts
   *  derivam de `encontro.origem` ("externo" = retroativo); sem a prop o
   *  form infere do `registro` (edição) — nunca afeta comportamento. */
  origem?: "novo" | "retroativo";
}) {
  const [encaminhamentos, setEncaminhamentos] = useState<Enc[]>([]);
  const [concluirIds, setConcluirIds] = useState<Set<string>>(new Set());
  const [dificuldade, setDificuldade] = useState(registro?.dificuldade ?? "nenhuma");
  const [proximoPasso, setProximoPasso] = useState(registro?.proximo_passo ?? "continuar");
  // duracao_min mora em `encontros`, não em `registros` — o form não recebe o
  // encontro, então o default é o padrão do guia (60). O salvarRegistro grava.
  const [duracaoMin, setDuracaoMin] = useState("60");
  const [restored, setRestored] = useState<RegistroDraft | null>(null);
  // avaliacao é o único obrigatório não-textual — erro inline pt-BR em vez do
  // balão nativo do browser (que nem indica qual campo faltou)
  const [erroAvaliacao, setErroAvaliacao] = useState(false);
  const [etapa, setEtapa] = useState(0);
  // direção da última troca de etapa — alimenta o --dir do .animate-enter-x
  const [direcao, setDirecao] = useState<1 | -1>(1);
  const [pending, start] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const tituloEtapaRef = useRef<HTMLHeadingElement>(null);
  const addEncRef = useRef<HTMLButtonElement>(null);
  // foco pedido junto com a troca de etapa — o efeito roda depois do commit,
  // quando o `hidden` da seção alvo já saiu da árvore renderizada
  const focoPendente = useRef<"titulo" | "avaliacao" | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredOnce = useRef(false);
  // num desmonte o formRef já foi zerado quando o cleanup passivo roda — o
  // elemento destacado sobrevive aqui e o FormData ainda lê os campos dele
  const ultimoForm = useRef<HTMLFormElement | null>(null);
  // save bem-sucedido desmonta o form (criação vira card, edição recolhe) —
  // sem a flag o flush de desmonte regravaria o rascunho recém-limpo
  const salvoOk = useRef(false);
  const draftKey = `registro-draft-${encontroId}`;
  const hojeStr = toDateStr(new Date());
  // capturado no mount: na demo o rascunho não existe — nem lido nem gravado,
  // pro que um visitante digita não sobrar pro próximo (o flush de desmonte
  // roda depois do cookie ir embora, por isso não dá pra checar na hora)
  const [demo] = useState(demoAtivoClient);
  // etapa pós-save (K1): evidências anexadas no mesmo fluxo — o form vira a
  // tela "registro salvo" com o uploader. Só na criação (edição já tem o
  // bloco de anexos do host)
  const [posSave, setPosSave] = useState<{
    registroId: string;
    autorId: string;
    aviso?: string;
  } | null>(null);
  // "Concluir" num host sem onSaved (ficha) recolhe num "salvo" mínimo —
  // o refresh que vem em seguida troca o card; voltar pro form vazio leria
  // como registro perdido
  const [fechado, setFechado] = useState(false);
  // trilha pra linha de privacidade (K6) — quando o host não repassa
  const [trilhaForm, setTrilhaForm] = useState<Trilha | null>(trilha);

  // ---------- telemetria do preenchimento (REALIZA-217, fase 1) ----------
  // Uma linha por abertura do form; fire-and-forget — a RPC pode falhar ou
  // nunca resolver sem custo pro mentor. A origem resolve do `registro`
  // (edição) ou da prop que os hosts derivam de `encontro.origem` —
  // "externo" nasce no RegistrarRetroativoDialog (catch-up de encontro que
  // já rolou); o default é o fluxo novo.
  const tentativaId = useRef<string | null>(null);
  const tentativaIniciada = useRef(false);
  // marco zero da duração: o cliente mede (o server só carimba `inicio`) —
  // "quanto tempo o form ficou aberto até o salvar", o número da issue
  const inicioMs = useRef(Date.now());
  // tempo acumulado por passo do wizard — o estado `etapa` é 0-based, mas
  // no payload a chave casa com o "Passo N de 3" da interface
  const etapasMs = useRef<Record<number, number>>({});
  const etapaDesde = useRef(Date.now());
  const etapaMedida = useRef(0);
  // atividade desde a última batida — o heartbeat só sai se algo mudou
  const telemetriaDirty = useRef(false);

  /** {1..3: ms} das etapas — inclui o parcial da etapa corrente, pra última
   *  batida antes do abandono já contar o passo em andamento. */
  const etapasSnapshot = useCallback((): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(etapasMs.current)) {
      out[k] = Math.round(v);
    }
    const corrente = etapaMedida.current + 1;
    out[String(corrente)] = Math.round(
      (out[String(corrente)] ?? 0) + Date.now() - etapaDesde.current
    );
    return out;
  }, []);

  // abertura do form = uma tentativa. O id pode chegar depois das
  // primeiras interações — o flush ao resolver não perde a atividade que
  // já aconteceu (telemetriaDirty cobre a janela)
  useEffect(() => {
    if (demo || tentativaIniciada.current) return;
    tentativaIniciada.current = true;
    const o = registro ? "edicao" : (origem ?? "novo");
    iniciarTentativa(duplaId, encontroId, o)
      .then((id) => {
        tentativaId.current = id;
        if (id && telemetriaDirty.current) {
          telemetriaDirty.current = false;
          atualizarTentativa(id, etapasSnapshot());
        }
      })
      .catch(() => {});
  }, [demo, duplaId, encontroId, registro, origem, etapasSnapshot]);

  // troca de passo: fecha a fatia da etapa anterior e já manda a batida —
  // a etapa em que o mentor desiste é o dado que o redesign precisa
  useEffect(() => {
    const agora = Date.now();
    const anterior = etapaMedida.current;
    etapasMs.current[anterior + 1] =
      (etapasMs.current[anterior + 1] ?? 0) + agora - etapaDesde.current;
    etapaDesde.current = agora;
    etapaMedida.current = etapa;
    telemetriaDirty.current = true;
    atualizarTentativa(tentativaId.current, etapasSnapshot());
  }, [etapa, etapasSnapshot]);

  // batida a cada 15s COM atividade — `ultima_atividade` é o sinal de
  // vida; abandono se mede pelo silêncio depois dela. Aba escondida tem o
  // intervalo estrangulado pelo browser: a batida do visibilitychange é a
  // que fecha a sessão no mobile (trocar de app é o fim real do
  // preenchimento)
  useEffect(() => {
    if (demo) return;
    const batida = () => {
      if (!telemetriaDirty.current || salvoOk.current) return;
      telemetriaDirty.current = false;
      atualizarTentativa(tentativaId.current, etapasSnapshot());
    };
    const timer = setInterval(batida, 15_000);
    const onHidden = () => {
      if (document.visibilityState === "hidden") batida();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [demo, etapasSnapshot]);

  // host não passou a trilha (ex.: ficha monta o form só com ids) — busca
  // direto na dupla, uma vez. Sem ela a linha de privacidade fica neutra
  useEffect(() => {
    if (trilhaForm != null || demo) return;
    const supabase = createClient();
    supabase
      .from("duplas")
      .select("trilha")
      .eq("id", duplaId)
      .single()
      .then(({ data }) => {
        if (data?.trilha) setTrilhaForm(data.trilha as Trilha);
      });
  }, [trilhaForm, demo, duplaId]);

  // ---------- rascunho local ----------

  // inputs nativos disparam onChange no form; selects Base UI e botões de
  // adicionar/remover linha não — por isso o autosave também roda no efeito
  // abaixo, a cada mudança de estado
  const saveDraftNow = useCallback(() => {
    if (demo) return;
    try {
      if (salvoOk.current) return;
      const form = formRef.current ?? ultimoForm.current;
      if (!form) return;
      ultimoForm.current = form;
      const fd = new FormData(form);
      const draft: RegistroDraft = {
        savedAt: new Date().toISOString(),
        tema: String(fd.get("tema") ?? ""),
        ferramenta: String(fd.get("ferramenta") ?? ""),
        duracaoMin: String(fd.get("duracao_min") ?? ""),
        reflexoes: String(fd.get("reflexoes") ?? ""),
        observacoes: String(fd.get("observacoes") ?? ""),
        atividades: fd.getAll("atividade").map(String),
        atividadeOutro: String(fd.get("atividade_outro") ?? ""),
        avaliacao: String(fd.get("avaliacao") ?? ""),
        dificuldade: String(fd.get("dificuldade") ?? ""),
        dificuldadeDetalhe: String(fd.get("dificuldade_detalhe") ?? ""),
        proximoPasso: String(fd.get("proximo_passo") ?? ""),
        proximoPassoDetalhe: String(fd.get("proximo_passo_detalhe") ?? ""),
        precisaApoio: fd.get("precisa_apoio") === "on",
        encaminhamentos,
        concluirIds: [...concluirIds],
      };
      const vazio =
        !draft.tema && !draft.ferramenta && !draft.reflexoes && !draft.observacoes &&
        !draft.atividades.length && !draft.atividadeOutro && !draft.avaliacao &&
        !draft.dificuldadeDetalhe && !draft.proximoPassoDetalhe && !draft.precisaApoio &&
        (!draft.dificuldade || draft.dificuldade === "nenhuma") &&
        (!draft.proximoPasso || draft.proximoPasso === "continuar") &&
        (!draft.duracaoMin || draft.duracaoMin === "60") &&
        !draft.encaminhamentos.some((t) => t.descricao.trim()) &&
        !draft.concluirIds.length;
      // rascunho vazio não vale guardar (e evita banner fantasma na próxima abertura)
      if (vazio) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // modo privado pode negar localStorage — falha silenciosa é ok aqui
    }
  }, [demo, draftKey, encaminhamentos, concluirIds]);

  const scheduleSave = useCallback(() => {
    // toda mudança no form passa por aqui — a mesma marca alimenta o
    // heartbeat da telemetria (atividade desde a última batida)
    telemetriaDirty.current = true;
    // guarda o form a cada mudança — o flush de desmonte pode precisar dele
    // depois que o formRef for desanexado
    ultimoForm.current = formRef.current ?? ultimoForm.current;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveDraftNow, 500);
  }, [saveDraftNow]);

  useEffect(() => {
    scheduleSave();
  }, [scheduleSave, dificuldade, proximoPasso, duracaoMin]);

  // a versão atual do save pro cleanup de desmonte (efeito com [] capturaria
  // a primeira — o ref sempre aponta pra última)
  const saveDraftNowRef = useRef(saveDraftNow);
  useEffect(() => {
    saveDraftNowRef.current = saveDraftNow;
  }, [saveDraftNow]);

  // desmonte: grava o rascunho na hora em vez de só cancelar o timer — os
  // últimos <500ms de digitação não se perdem numa navegação pra fora
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveDraftNowRef.current();
    };
  }, []);

  // restaura o rascunho uma única vez, só em form novo — com registro salvo o
  // form já nasce preenchido e o rascunho não se aplica. O timeout tira os
  // setStates do corpo síncrono do efeito (storage é sistema externo)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (demo || restoredOnce.current || registro) return;
      restoredOnce.current = true;
      try {
        const raw = localStorage.getItem(draftKey);
        if (!raw) return;
        const d = JSON.parse(raw) as Partial<RegistroDraft>;
        const form = formRef.current;
        if (!form || !d || typeof d !== "object") return;
        const setVal = (name: string, v: string | undefined) => {
          const el = form.elements.namedItem(name);
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.value = v ?? "";
          }
        };
        setVal("tema", d.tema);
        setVal("atividade_outro", d.atividadeOutro);
        setVal("reflexoes", d.reflexoes);
        setVal("observacoes", d.observacoes);
        const atividades = Array.isArray(d.atividades) ? d.atividades : [];
        form.querySelectorAll<HTMLInputElement>('input[name="atividade"]').forEach((el) => {
          el.checked = atividades.includes(el.value);
        });
        form.querySelectorAll<HTMLInputElement>('input[name="avaliacao"]').forEach((el) => {
          el.checked = el.value === d.avaliacao;
        });
        const apoio = form.elements.namedItem("precisa_apoio");
        if (apoio instanceof HTMLInputElement) apoio.checked = d.precisaApoio === true;
        setDificuldade((d.dificuldade || "nenhuma") as Dificuldade);
        setProximoPasso((d.proximoPasso || "continuar") as ProximoPasso);
        // fora das faixas conhecidas (rascunho editado à mão) cai no default —
        // valor solto renderizaria cru no Select
        setDuracaoMin(
          typeof d.duracaoMin === "string" && d.duracaoMin in DURACAO_OPCOES
            ? d.duracaoMin
            : "60"
        );
        setEncaminhamentos(
          (Array.isArray(d.encaminhamentos) ? d.encaminhamentos : [])
            .filter((t) => t && typeof t === "object" && typeof t.id === "string")
            .map((t) => ({
              id: t.id,
              descricao: String(t.descricao ?? ""),
              responsavel: t.responsavel === "mentor" ? ("mentor" as const) : ("mentorado" as const),
              prazo: String(t.prazo ?? ""),
            }))
        );
        // ignora ids de combinados que já não estão pendentes (feitos por outra via)
        const pendentes = new Set((combinadosPendentes ?? []).map((c) => c.id));
        const ids = Array.isArray(d.concluirIds) ? d.concluirIds : [];
        setConcluirIds(new Set(ids.filter((id) => pendentes.has(id))));
        setRestored({
          savedAt: new Date().toISOString(),
          tema: "", ferramenta: "", duracaoMin: "", reflexoes: "", observacoes: "",
          atividades: [], atividadeOutro: "", avaliacao: "",
          dificuldade: "", dificuldadeDetalhe: "",
          proximoPasso: "", proximoPassoDetalhe: "",
          precisaApoio: false, encaminhamentos: [], concluirIds: [],
          ...d,
        });
      } catch {
        // rascunho corrompido ou storage indisponível — ignora
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [demo, draftKey, registro, combinadosPendentes]);

  function discardDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // storage indisponível — segue o jogo
    }
    formRef.current?.reset();
    setDificuldade(registro?.dificuldade ?? "nenhuma");
    setProximoPasso(registro?.proximo_passo ?? "continuar");
    setDuracaoMin("60");
    setEncaminhamentos([]);
    setConcluirIds(new Set());
    setErroAvaliacao(false);
    setRestored(null);
  }

  // foco pedido junto com a troca de etapa: o heading novo anuncia onde o
  // mentor está; quando a troca foi o portão da avaliação, o foco cai no campo
  useEffect(() => {
    const alvo = focoPendente.current;
    if (!alvo) return;
    focoPendente.current = null;
    if (alvo === "avaliacao") focarAvaliacao();
    else tituloEtapaRef.current?.focus();
  });

  function focarAvaliacao() {
    formRef.current
      ?.querySelector<HTMLElement>('input[name="avaliacao"]')
      ?.focus();
  }

  function irPara(proxima: number) {
    focoPendente.current = "titulo";
    setDirecao(proxima > etapa ? 1 : -1);
    setEtapa(proxima);
  }

  function cobrarAvaliacao() {
    setErroAvaliacao(true);
    if (etapa === 0) {
      focarAvaliacao();
    } else {
      // Enter/submit fora da etapa 1 devolve o mentor pra lá e foca o campo
      focoPendente.current = "avaliacao";
      setDirecao(-1);
      setEtapa(0);
    }
  }

  function avancar() {
    const form = formRef.current;
    if (etapa === 0 && (!form || !new FormData(form).get("avaliacao"))) {
      cobrarAvaliacao();
      return;
    }
    irPara(etapa + 1);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Enter num input das etapas 1–2 avança, não salva — o submit implícito
    // do browser chega aqui por qualquer campo de texto
    if (etapa < ETAPAS.length - 1) {
      avancar();
      return;
    }
    const fd = new FormData(e.currentTarget);
    if (!fd.get("avaliacao")) {
      cobrarAvaliacao();
      return;
    }
    setErroAvaliacao(false);
    fd.set("encontro_id", encontroId);
    fd.set("dupla_id", duplaId);
    encaminhamentos
      .filter((t) => t.descricao.trim())
      .forEach((t) =>
        fd.append(
          "encaminhamento",
          JSON.stringify({ descricao: t.descricao, responsavel: t.responsavel, prazo: t.prazo })
        )
      );
    // só manda ids que ainda aparecem como pendentes (a lista pode ter mudado)
    const pendentes = new Set((combinadosPendentes ?? []).map((c) => c.id));
    [...concluirIds]
      .filter((id) => pendentes.has(id))
      .forEach((id) => fd.append("concluir_encaminhamento", id));
    start(async () => {
      // duração da sessão até o gesto de salvar — o round-trip da action
      // não conta como tempo de preenchimento
      const duracaoMs = Math.max(0, Date.now() - inicioMs.current);
      try {
        const res = await salvarRegistro(fd);
        if (res?.error) toast.error(res.error);
        else {
          if (res?.aviso) {
            toast.warning("Registro salvo.", { description: res.aviso });
          } else {
            toast.success("Registro salvo.", {
              description: res?.concluidos
                ? res.concluidos === 1
                  ? "1 combinado marcado como feito."
                  : `${res.concluidos} combinados marcados como feitos.`
                : undefined,
            });
          }
          salvoOk.current = true;
          if (saveTimer.current) clearTimeout(saveTimer.current);
          try {
            localStorage.removeItem(draftKey);
          } catch {
            // storage indisponível — ok
          }
          setEncaminhamentos([]);
          setConcluirIds(new Set());
          setRestored(null);
          if (registro) {
            // edição inline recolhe depois de salvar — evidências já moram
            // no bloco de anexos do host
            concluirTentativa(tentativaId.current, registro.id, duracaoMs);
            onSaved?.();
            router.refresh();
          } else {
            // K1 — criação não fecha na hora: o fluxo continua na etapa de
            // evidências (o FK do anexo exige a row já gravada). O refresh
            // fica adiado pro fechamento — se rodasse agora, hosts como o
            // detalhe do dia desmontariam este form (a linha some com o
            // "sem registro") no meio do upload
            const { data: reg } = await createClient()
              .from("registros")
              .select("id, created_by")
              .eq("encontro_id", encontroId)
              .maybeSingle();
            // fecha a sessão de preenchimento mesmo sem a row à mão — a
            // duração vale mais que o link pro registro
            concluirTentativa(tentativaId.current, reg?.id ?? null, duracaoMs);
            if (reg?.id && reg.created_by) {
              setPosSave({
                registroId: reg.id,
                autorId: reg.created_by,
                aviso: res?.aviso,
              });
            } else {
              // sem a row à mão não dá pra montar o uploader — cai no fluxo
              // antigo; evidências seguem acessíveis na ficha da dupla
              onSaved?.();
              router.refresh();
            }
          }
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function fecharPosSave() {
    // host com onSaved (detalhe do dia) fecha o dialog; sem callback
    // (ficha) o form recolhe no "salvo" mínimo e o refresh troca o card
    if (onSaved) onSaved();
    else setFechado(true);
    router.refresh();
  }

  // K1 — criação bem-sucedida cede a tela pra etapa de evidências no
  // mesmo container (dialog da agenda ou card inline da ficha): o FK do
  // anexo exige a row gravada, por isso a etapa existe só depois do save
  if (posSave) {
    if (fechado)
      return (
        <p className="py-2 text-sm text-muted-foreground">
          Registro salvo. As evidências ficam na ficha da dupla.
        </p>
      );
    return (
      <PosSaveRegistro
        registroId={posSave.registroId}
        duplaId={duplaId}
        autorId={posSave.autorId}
        aviso={posSave.aviso}
        onFechar={fecharPosSave}
        embutido={embutido}
      />
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onChange={scheduleSave}
      className={cn(
        "space-y-5",
        !embutido && "rounded-xl bg-card p-5 shadow-[var(--shadow-border)]"
      )}
    >
      <div>
        {!embutido && (
          <p className="text-sm font-medium">
            {registro ? "Editar registro" : "Registro do encontro"}
          </p>
        )}
        {evento && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Sugestão do guia: {evento.titulo}
            {evento.instrumentos.length > 0 && ` · instrumentos: ${evento.instrumentos.join(", ")}`}
            {evento.foco ? ` · ${evento.foco}` : ""}
          </p>
        )}
        {/* quem lê, honesto por trilha (K6): o jovem nunca lê registros; na
            trilha de especialista o mentor DPP do jovem lê o registro
            integral (decisão 0092). Com trilha desconhecida a linha fica
            no recorte mínimo garantido — equipe sim, jovem não */}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {trilhaForm === "especialista"
            ? "A equipe do programa e o mentor DPP do jovem leem este registro."
            : trilhaForm === "dpp"
              ? "Só você e a equipe do programa leem este registro. O jovem não vê."
              : "A equipe do programa lê este registro. O jovem não vê."}
        </p>
      </div>

      {restored && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <span>Rascunho de {formatDiaMes(restored.savedAt)} restaurado.</span>
          <button
            type="button"
            onClick={discardDraft}
            className="-my-2 min-h-11 rounded-md px-2 font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
          >
            Descartar rascunho
          </button>
        </div>
      )}

      {/* o form oficial é longo — wizard de 3 etapas dá noção de progresso e
          mostra um bloco por vez. Todas ficam montadas: a inativa leva
          `hidden` (inputs display:none seguem no FormData e no autosave do
          rascunho — desmontar perderia os valores não-controlados) */}
      <div className="space-y-2">
        <h3 ref={tituloEtapaRef} tabIndex={-1} className="text-sm font-medium outline-none">
          Passo {etapa + 1} de {ETAPAS.length} · {ETAPAS[etapa]}
        </h3>
        <ol className="flex gap-1" aria-label="Etapas">
          {ETAPAS.map((nome, i) => (
            <li
              key={nome}
              aria-current={i === etapa ? "step" : undefined}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= etapa ? "bg-primary" : "bg-muted"
              )}
            >
              <span className="sr-only">{nome}</span>
            </li>
          ))}
        </ol>
      </div>

      <div
        hidden={etapa !== 0}
        className="animate-enter-x"
        style={{ "--dir": `${direcao * 8}px` } as CSSProperties}
      >
        <div className="space-y-5">
          {combinadosPendentes && combinadosPendentes.length > 0 && (
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-sm font-medium">Da última vez: marcar como feito?</legend>
              {combinadosPendentes.map((c) => {
                const vencido = c.prazo != null && c.prazo < hojeStr;
                return (
                  <label key={c.id} className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={concluirIds.has(c.id)}
                      onChange={(e) =>
                        setConcluirIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })
                      }
                      className="mt-0.5 size-5 shrink-0 accent-primary"
                    />
                    <span className="min-w-0">
                      {c.descricao}
                      <span className="text-muted-foreground">
                        {" "}· {c.responsavel === "mentor" ? "Mentor" : "Mentorado"}
                        {c.prazo && ` · até ${formatDiaMes(c.prazo)}`}
                      </span>
                      {vencido && <span className="text-[var(--warn-text)]"> (vencido)</span>}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}

          <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm font-medium">O que foi realizado neste encontro</legend>
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {ATIVIDADES_ENCONTRO.map((a) => (
                <label key={a} className="flex min-h-11 items-center gap-2 py-2 text-sm cursor-pointer md:min-h-0 md:py-0">
                  <input
                    type="checkbox"
                    name="atividade"
                    value={a}
                    defaultChecked={registro?.atividades.includes(a)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  {a}
                </label>
              ))}
            </div>
            <Input
              name="atividade_outro"
              placeholder="Outro (descreva)"
              aria-label="Qual atividade"
              className="mt-1"
              defaultValue={registro?.atividades.filter((a) => !(ATIVIDADES_ENCONTRO as readonly string[]).includes(a)).join(", ") ?? ""}
            />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tema">Tema trabalhado</Label>
              <Input
                id="tema"
                name="tema"
                placeholder="Ex.: primeiras submetas do PDM"
                defaultValue={registro?.tema ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label id="ferramenta-label">Instrumento utilizado</Label>
              {/* key remonta o select quando o rascunho chega (defaultValue novo) */}
              <Select
                key={restored ? "restored" : "base"}
                name="ferramenta"
                defaultValue={restored?.ferramenta || registro?.ferramenta || undefined}
                onValueChange={scheduleSave}
              >
                <SelectTrigger id="ferramenta-select" aria-labelledby="ferramenta-label ferramenta-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(evento?.instrumentos ?? []).map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                  {["PDM", "Roda da Vida", "Perguntas Eficazes", "Feedback Construtivo", "Escuta Ativa", "Modelo SMART", "Nenhum específico"]
                    .concat(restored?.ferramenta ? [restored.ferramenta] : [])
                    .concat(registro?.ferramenta ? [registro.ferramenta] : [])
                    .filter((i, idx, arr) => arr.indexOf(i) === idx)
                    .filter((i) => !(evento?.instrumentos ?? []).includes(i))
                    .map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label id="duracao-label">Duração do encontro</Label>
              <Select
                name="duracao_min"
                value={duracaoMin}
                items={DURACAO_OPCOES}
                onValueChange={(v) => setDuracaoMin(v ?? "60")}
              >
                <SelectTrigger id="duracao-select" aria-labelledby="duracao-label duracao-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1h</SelectItem>
                  <SelectItem value="90">1h30</SelectItem>
                  <SelectItem value="120">2h</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reflexoes">Principais reflexões</Label>
            <Textarea
              id="reflexoes"
              name="reflexoes"
              rows={3}
              defaultValue={registro?.reflexoes ?? ""}
              placeholder="O que o mentorado trouxe de mais significativo, nas palavras dele(a) quando possível."
            />
          </div>

          <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm font-medium">Desempenho e participação do mentorado</legend>
            <div
              role="radiogroup"
              aria-invalid={erroAvaliacao || undefined}
              aria-describedby={erroAvaliacao ? `avaliacao-erro-${encontroId}` : undefined}
              onChange={() => setErroAvaliacao(false)}
              className="flex flex-wrap gap-2"
            >
              {(["excelente", "boa", "regular", "baixa"] as const).map((v) => (
                <label key={v} className="cursor-pointer">
                  <input
                    type="radio"
                    name="avaliacao"
                    value={v}
                    defaultChecked={registro?.avaliacao === v}
                    className="peer sr-only"
                  />
                  <span className="inline-flex min-h-11 items-center rounded-lg border border-border px-3.5 py-2.5 text-sm font-medium transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring md:min-h-9 md:py-1.5">
                    {v === "boa" ? "Boa" : v === "baixa" ? "Baixa" : v === "regular" ? "Regular" : "Excelente"}
                  </span>
                </label>
              ))}
            </div>
            {erroAvaliacao && (
              <p
                id={`avaliacao-erro-${encontroId}`}
                role="alert"
                className="text-sm font-medium text-[var(--danger)]"
              >
                Escolha uma avaliação pra continuar.
              </p>
            )}
          </fieldset>
        </div>
      </div>

      <div
        hidden={etapa !== 1}
        className="animate-enter-x"
        style={{ "--dir": `${direcao * 8}px` } as CSSProperties}
      >
        <div className="space-y-4">
          <div className="space-y-2 sm:max-w-sm">
            <Label id="dificuldade-label">Dificuldade que precisa de atenção</Label>
            <Select name="dificuldade" value={dificuldade} items={DIFICULDADE_OPCOES} onValueChange={(v) => setDificuldade(v ?? "nenhuma")}>
              <SelectTrigger id="dificuldade-select" aria-labelledby="dificuldade-label dificuldade-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Não</SelectItem>
                <SelectItem value="aprendizagem">Sim, de aprendizagem</SelectItem>
                <SelectItem value="participacao">Sim, de participação</SelectItem>
                <SelectItem value="comportamental">Sim, comportamental</SelectItem>
                <SelectItem value="organizacao">Sim, de organização/rotina</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            {/* montado sempre: desmontar perdia o texto digitado e o disabled
                tira o campo do FormData quando não é "outro" */}
            <Input
              name="dificuldade_detalhe"
              placeholder="Qual dificuldade?"
              aria-label="Detalhe da dificuldade"
              hidden={dificuldade !== "outro"}
              disabled={dificuldade !== "outro"}
              defaultValue={restored?.dificuldadeDetalhe ?? registro?.dificuldade_detalhe ?? ""}
            />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-4 py-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="precisa_apoio"
              defaultChecked={registro?.precisa_apoio}
              className="mt-0.5 accent-[var(--warn)]"
            />
            <span>
              <span className="font-medium">Preciso de apoio</span> · sinalizar a coordenação ou o
              auxiliar executivo (situação que extrapola o papel do mentor).
            </span>
          </label>
        </div>
      </div>

      <div
        hidden={etapa !== 2}
        className="animate-enter-x"
        style={{ "--dir": `${direcao * 8}px` } as CSSProperties}
      >
        <div className="space-y-4">
          <div className="space-y-2 sm:max-w-sm">
            <Label id="proximo-passo-label">Próximo passo do acompanhamento</Label>
            <Select name="proximo_passo" value={proximoPasso} items={PROXIMO_PASSO_LABEL} onValueChange={(v) => setProximoPasso(v ?? "continuar")}>
              <SelectTrigger id="proximo-passo-select" aria-labelledby="proximo-passo-label proximo-passo-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="continuar">Continuar o acompanhamento normalmente</SelectItem>
                <SelectItem value="reforcar">Reforçar o conteúdo/atividade</SelectItem>
                <SelectItem value="novo_feedback">Realizar novo feedback</SelectItem>
                <SelectItem value="acompanhar_de_perto">Fazer um acompanhamento mais próximo</SelectItem>
                <SelectItem value="conversa_individual">Conversar individualmente com o mentorado</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Input
              name="proximo_passo_detalhe"
              placeholder="Qual próximo passo?"
              aria-label="Detalhe do próximo passo"
              hidden={proximoPasso !== "outro"}
              disabled={proximoPasso !== "outro"}
              defaultValue={restored?.proximoPassoDetalhe ?? registro?.proximo_passo_detalhe ?? ""}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Novos combinados</p>
                <p className="text-xs text-muted-foreground">
                  O que a dupla combinou de fazer até o próximo encontro.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                ref={addEncRef}
                onClick={() => setEncaminhamentos([...encaminhamentos, { id: crypto.randomUUID(), descricao: "", responsavel: "mentorado", prazo: "" }])}
              >
                <Plus size={14} /> Adicionar
              </Button>
            </div>
            {encaminhamentos.map((t) => (
              <div key={t.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_130px_150px_36px]">
                <Input
                  placeholder="O que fica combinado"
                  aria-label="Descrição do combinado"
                  value={t.descricao}
                  onChange={(e) => setEncaminhamentos(encaminhamentos.map((x) => (x.id === t.id ? { ...x, descricao: e.target.value } : x)))}
                />
                <div className="grid grid-cols-[minmax(0,1fr)_9rem_2.75rem] gap-2 sm:contents">
                  <Select
                    value={t.responsavel}
                    items={RESPONSAVEL_OPCOES}
                    onValueChange={(v) => setEncaminhamentos(encaminhamentos.map((x) => (x.id === t.id ? { ...x, responsavel: v as Enc["responsavel"] } : x)))}
                  >
                    <SelectTrigger aria-label="Responsável" className="min-w-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mentorado">Mentorado</SelectItem>
                      <SelectItem value="mentor">Mentor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    aria-label="Prazo"
                    value={t.prazo}
                    onChange={(e) => setEncaminhamentos(encaminhamentos.map((x) => (x.id === t.id ? { ...x, prazo: e.target.value } : x)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remover combinado"
                    className="justify-self-center"
                    onClick={() => {
                      setEncaminhamentos(encaminhamentos.filter((x) => x.id !== t.id));
                      // o botão desmonta consigo — devolve o foco pro Adicionar
                      addEncRef.current?.focus();
                    }}
                  >
                    <Trash size={15} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações do mentor</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={2}
              defaultValue={registro?.observacoes ?? ""}
              placeholder="Avanços, dificuldades e pontos de atenção a acompanhar."
            />
          </div>
        </div>
      </div>

      {/* rodapé do wizard — sticky pra Avançar/Salvar ficarem à mão no mobile
          (o painel inline usa overflow:clip — sem scrollport, o sticky segue
          valendo pro documento). No dialog é o DialogFooter compartilhado;
          inline (ficha da dupla) mantém o offset próprio pra pular a bottom
          nav fixa do app */}
      {(() => {
        const botoes = (
          <>
            {etapa > 0 && (
              <Button
                type="button"
                variant="ghost"
                className={cn(embutido && "sm:me-auto")}
                onClick={() => irPara(etapa - 1)}
              >
                <CaretLeft size={14} /> Voltar
              </Button>
            )}
            {etapa < ETAPAS.length - 1 ? (
              <>
                {/* sem submit visível antes da etapa 3, Enter num input de
                    texto não teria pra onde ir — este escondido mantém a
                    submissão implícita viva, e o portão da avaliação devolve
                    pra etapa 1 */}
                <button type="submit" hidden />
                <Button type="button" className="flex-1" onClick={avancar}>
                  Avançar <CaretRight size={14} />
                </Button>
              </>
            ) : (
              <Button type="submit" className="flex-1" disabled={pending}>
                {pending ? "Salvando…" : registro ? "Salvar alterações" : "Salvar registro"}
              </Button>
            )}
          </>
        );
        return embutido ? (
          // no dialog o bottom-0 é do scrollport do popup — a bottom nav da
          // página fica sob o overlay e não interfere
          <DialogFooter sticky>{botoes}</DialogFooter>
        ) : (
          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-5 -mb-5 flex items-center gap-2 rounded-b-xl border-t bg-card px-5 py-3 md:bottom-0">
            {botoes}
          </div>
        );
      })()}
    </form>
  );
}

/** Etapa final do registro novo (K1): evidências no mesmo fluxo — foto do
 *  encontro, print, atividade feita. A row já está gravada, então o
 *  uploader trabalha sobre id real; os anexos sobem pelos inserts/storage
 *  do AnexosRegistro e aparecem nos slots da ficha quando o refresh do
 *  desmonte (Concluir ou o host fechando o dialog) chega. */
function PosSaveRegistro({
  registroId,
  duplaId,
  autorId,
  aviso,
  onFechar,
  embutido = false,
}: {
  registroId: string;
  duplaId: string;
  autorId: string;
  aviso?: string;
  onFechar: () => void;
  /** dentro de dialog o rodapé é o DialogFooter compartilhado; inline ele
      segue a barrinha própria do card */
  embutido?: boolean;
}) {
  const router = useRouter();
  useEffect(() => () => router.refresh(), [router]);
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          Registro salvo: anexe as evidências
        </p>
        <p className="text-xs text-muted-foreground">
          Foto do encontro, print, atividade feita: PDF ou imagem até
          10&nbsp;MB. Dá pra anexar depois na ficha da dupla também.
        </p>
        {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
      </div>
      <AnexosRegistro
        registroId={registroId}
        duplaId={duplaId}
        autorId={autorId}
        podeAnexar
        podeRemover
        anexos={SEM_ANEXOS}
      />
      {embutido ? (
        <DialogFooter>
          <Button type="button" onClick={onFechar}>
            Concluir
          </Button>
        </DialogFooter>
      ) : (
        <div className="flex justify-end border-t pt-3">
          <Button type="button" onClick={onFechar}>
            Concluir
          </Button>
        </div>
      )}
    </div>
  );
}
