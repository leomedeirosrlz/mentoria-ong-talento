"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Handshake,
  SpinnerGap,
  SunHorizon,
  Warning,
} from "@phosphor-icons/react";
import {
  combinarPlano,
  salvarDisponibilidadePlano,
  simularPlano,
  type DecisaoRecesso,
  type SimulacaoPlano,
} from "@/lib/actions-plano";
import { disponibilidadesDaDupla } from "@/lib/actions";
import {
  fusaoDeArestas,
  fusaoPedeAvisoPratica,
  rotuloRitmo,
} from "@/lib/plano-em-dia";
import { diaCurto, listaEncontros } from "@/lib/plano-combinado";
import { toast } from "@/lib/toast";
import type { LadoPlano } from "@/lib/plano-servico";
import type { Disponibilidade } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CampoDisponibilidade } from "@/components/campos-pessoais";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// "Combinar o plano" (518): a superfície que leva a dupla a UM gesto de
// proposta — uma pergunta por tela (ritmo livre, recesso, grade) e a
// projeção reage a cada resposta (simularPlano, sem gravar). Nada é
// commit antes do "Combinar" final: as respostas viajam juntas pra
// combinarPlano, que declara os recessos e propõe na mesma chamada.
// Proposta de lado da dupla nasce em vigor; a da equipe espera um
// aceite. A decisão de recesso é só da dupla — staff vê o estado e o
// "Combinar" espera a resposta deles (a RPC recusa com o motivo honesto).

const MQ_DESKTOP = "(min-width: 768px)";
const assinaDesktop = (cb: () => void) => {
  const mq = window.matchMedia(MQ_DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const medeDesktop = () => window.matchMedia(MQ_DESKTOP).matches;

type PassoId = "ritmo" | "recesso" | "grade" | "sessao" | "confirmar";
type Sim = Extract<SimulacaoPlano, { ok: true }>;
type RecessoSim = Sim["recessos"][number];

/** Pílula-rádio da superfície (518): input nativo sr-only pra leitor de
 *  tela e teclado (setas navegam o grupo de graça), label estilizada com
 *  alvo >=44px. `has-checked`/`has-focus-visible` vestem o estado —
 *  status nunca por cor só: o texto da pílula já é a opção inteira. */
function OpcaoPilula({
  nome,
  valor,
  marcado,
  onChange,
  sugerido = false,
  children,
}: {
  nome: string;
  valor: string;
  marcado: boolean;
  onChange: () => void;
  sugerido?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors",
        "border-border bg-card hover:bg-muted",
        "has-checked:border-foreground has-checked:bg-foreground has-checked:text-background",
        "has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
      )}
    >
      <input
        type="radio"
        name={nome}
        value={valor}
        checked={marcado}
        onChange={onChange}
        className="sr-only"
      />
      {children}
      {sugerido && (
        <span className="absolute -top-2 right-2 rounded-full bg-[var(--destaque)] px-1.5 py-0.5 text-[10px] font-semibold leading-none">
          sugerido
        </span>
      )}
    </label>
  );
}

export function CombinarPlano({
  duplaId,
  aberto,
  onAberto,
  defaultOpen = false,
  lado: ladoInicial,
  rotulo = "Combinar o plano",
  variante = "default",
  onDone,
}: {
  duplaId: string;
  /** controlado: o pai abre/fecha (o gatilho interno some) */
  aberto?: boolean;
  onAberto?: (o: boolean) => void;
  /** abre já na montagem — o card pode apontar direto pra superfície */
  defaultOpen?: boolean;
  /** pista pro texto antes da primeira simulação; a resposta do banco
   *  decide de verdade */
  lado?: LadoPlano;
  rotulo?: string;
  variante?: "default" | "outline";
  onDone?: () => void;
}) {
  const router = useRouter();
  const controlado = aberto != null;
  const [interno, setInterno] = useState(defaultOpen);
  const open = controlado ? aberto : interno;
  const setOpen = (o: boolean) => {
    if (!controlado) setInterno(o);
    onAberto?.(o);
  };

  const desktop = useSyncExternalStore(assinaDesktop, medeDesktop, () => true);

  const [sim, setSim] = useState<Sim | null>(null);
  const [erroSim, setErroSim] = useState<string | null>(null);
  const [simulando, iniciarSim] = useTransition();
  const [enviando, iniciarEnvio] = useTransition();
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  // a resposta mais nova sempre ganha: respostas em sequência não
  // competem entre si
  const chamada = useRef(0);
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [passo, setPasso] = useState(0);
  const [ritmoSel, setRitmoSel] = useState<number | "outro" | null>(null);
  const [outroTxt, setOutroTxt] = useState("");
  const [decisoes, setDecisoes] = useState<Record<string, boolean>>({});
  const [semGrade, setSemGrade] = useState<boolean | null>(null);
  const [gradeNova, setGradeNova] = useState<Disponibilidade | null>(null);
  const [gradeSalva, setGradeSalva] = useState(false);
  const [grades, setGrades] = useState<{
    mentor: Disponibilidade | null;
    jovem: Disponibilidade | null;
    jovemNome: string | null;
  } | null>(null);
  const [lado, setLado] = useState<LadoPlano | null>(ladoInicial ?? null);
  // 018 — arestas de fusão escolhidas: fusaoSel[n] = "junta o nº com o
  // n+1º na mesma sessão de 2h". O aviso de prática exige um gesto
  // consciente: a assinatura dos grupos reconhecida viaja no aceite
  const [fusaoSel, setFusaoSel] = useState<Record<number, boolean>>({});
  const [avisoReconhecido, setAvisoReconhecido] = useState<string | null>(
    null
  );

  const tituloRef = useRef<HTMLHeadingElement>(null);
  const montou = useRef(false);

  const ritmoNum = useMemo(() => {
    if (ritmoSel === "outro") {
      const t = outroTxt.trim();
      return /^\d+$/.test(t) && Number(t) >= 1 ? Number(t) : null;
    }
    return ritmoSel;
  }, [ritmoSel, outroTxt]);

  const decisoesArr = (d = decisoes): DecisaoRecesso[] =>
    Object.entries(d).map(([cicloEventoId, usa]) => ({
      cicloEventoId,
      usa,
    }));

  const plano = sim?.plano;
  const aplicavel = plano?.aplicavel === true ? plano : null;
  // 018: os passos que o plano controla podem fundir (travado não —
  // a sessão move a data da row). Aresta = vizinhos n e n+1, os dois
  // fundíveis; a seleção vira grupos por corrente de arestas.
  const fundiveis = useMemo(
    () =>
      new Set(
        (aplicavel?.passos ?? [])
          .filter((p) => p.acao !== "travado")
          .map((p) => p.numero)
      ),
    [aplicavel]
  );
  const arestasFusao = useMemo(
    () =>
      [...fundiveis]
        .filter((n) => fundiveis.has(n + 1))
        .sort((a, b) => a - b),
    [fundiveis]
  );
  const gruposFusao = useMemo(
    () =>
      fusaoDeArestas(
        arestasFusao.filter((n) => fusaoSel[n] === true)
      ),
    [arestasFusao, fusaoSel]
  );
  const assinaturaFusao = JSON.stringify(gruposFusao);
  const precisaAvisoPratica = fusaoPedeAvisoPratica(gruposFusao);

  const simular = (p: {
    ritmo?: number | null;
    decisoes?: Record<string, boolean>;
    semGrade?: boolean | null;
    fusao?: number[][] | null;
  } = {}) => {
    const n = ++chamada.current;
    iniciarSim(async () => {
      const r = await simularPlano(duplaId, {
        ritmo:
          (p.ritmo !== undefined ? p.ritmo : ritmoNum) ?? undefined,
        decisoes: decisoesArr(p.decisoes ?? decisoes),
        semGrade:
          (p.semGrade !== undefined ? p.semGrade : semGrade) ?? undefined,
        fusao:
          p.fusao !== undefined
            ? (p.fusao ?? undefined)
            : gruposFusao.length
              ? gruposFusao
              : undefined,
      });
      if (n !== chamada.current) return;
      if ("error" in r) {
        setErroSim(r.error);
        return;
      }
      setErroSim(null);
      setSim(r);
      setLado(r.lado);
      // decisão já gravada vira valor inicial — a resposta desta
      // sessão (a que gerou a sim) sempre ganha
      setDecisoes((d) => {
        const prox = { ...d };
        for (const rec of r.recessos)
          if (rec.usa != null && prox[rec.cicloEventoId] == null)
            prox[rec.cicloEventoId] = rec.usa;
        return prox;
      });
    });
  };

  // reabrir recomeça a conversa: o reset mora no render (padrão
  // "adjust state"), o efeito fica só com o trabalho externo — setState
  // síncrono dentro de efeito cascateia render
  const [openAnterior, setOpenAnterior] = useState(open);
  if (open !== openAnterior) {
    setOpenAnterior(open);
    if (open) {
      setPasso(0);
      setErroSim(null);
      setGradeSalva(false);
      setFusaoSel({});
      setAvisoReconhecido(null);
    }
  }

  // a projeção de abertura: simulação fresca a cada vez que a superfície
  // abre + as grades da dupla (o editor inline pré-carrega a do lado que
  // lê — pro jovem a leitura pública pode vir vazia e ele marca de novo)
  useEffect(() => {
    if (!open) return;
    simular();
    disponibilidadesDaDupla(duplaId)
      .then(setGrades)
      .catch(() =>
        setGrades({ mentor: null, jovem: null, jovemNome: null })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, duplaId]);

  const passos = useMemo<PassoId[]>(() => {
    const p: PassoId[] = ["ritmo"];
    if (sim && sim.recessos.length > 0) p.push("recesso");
    if (
      sim &&
      (!sim.grade.mentor || !sim.grade.jovem || sim.grade.diasComuns === 0)
    )
      p.push("grade");
    // 018: a pergunta da sessão só existe quando há vizinho fundível
    if (arestasFusao.length > 0) p.push("sessao");
    p.push("confirmar");
    return p;
  }, [sim, arestasFusao]);
  const passoId = passos[Math.min(passo, passos.length - 1)];

  // pergunta por tela: o foco acompanha a mudança de pergunta (quem usa
  // teclado/leitor não fica procurando onde a conversa continuou)
  useEffect(() => {
    if (!montou.current) {
      montou.current = true;
      return;
    }
    tituloRef.current?.focus();
  }, [passoId]);

  const recessoUsa = (r: RecessoSim) => decisoes[r.cicloEventoId] ?? r.usa;
  const pendentes =
    sim?.recessos.filter((r) => recessoUsa(r) == null) ?? [];
  const faltaDecisao = pendentes.length > 0;
  const algumaGrade = Boolean(sim?.grade.mentor || sim?.grade.jovem);
  // 519: "usar a grade" só existe quando os DOIS lados marcaram — com um
  // lado só não há "em comum" e a simulação já roda sem grade no servidor
  const ambasGrades = Boolean(sim?.grade.mentor && sim?.grade.jovem);
  // a pergunta de grade existe quando falta grade de um lado ou quando a
  // interseção é vazia — perguntada, exige resposta antes de combinar
  const gradePerguntada =
    sim != null &&
    (!sim.grade.mentor || !sim.grade.jovem || sim.grade.diasComuns === 0);
  // sem pergunta a fazer: proposta já existe, nada a repor ou o card nem
  // caberia (trilha especialista, dupla parada) — a superfície só diz
  const terminal =
    sim != null &&
    (sim.planoVivo != null ||
      !aplicavel ||
      aplicavel.emDia);
  const sugestaoRitmo =
    sim && sim.grade.diasComuns > 0 ? Math.min(sim.grade.diasComuns, 5) : null;

  const podeAvancar =
    !simulando &&
    sim != null &&
    (passoId === "ritmo"
      ? ritmoNum != null
      : passoId === "recesso"
        ? lado === "staff" || !faltaDecisao
        : passoId === "grade"
          ? semGrade != null
          : passoId === "sessao"
            ? !precisaAvisoPratica || avisoReconhecido === assinaturaFusao
            : true);
  const podeCombinar =
    sim != null &&
    !simulando &&
    !enviando &&
    ritmoNum != null &&
    !faltaDecisao &&
    (!gradePerguntada || semGrade != null) &&
    aplicavel != null &&
    !aplicavel.emDia &&
    aplicavel.dataRecuperacao != null;

  const salvarGrade = () => {
    setErroEnvio(null);
    iniciarEnvio(async () => {
      const r = await salvarDisponibilidadePlano(duplaId, gradeNova);
      if ("error" in r) {
        setErroEnvio(r.error);
        return;
      }
      toast.success("Grade salva.");
      setGradeSalva(true);
      setSemGrade(false);
      simular({ semGrade: false });
    });
  };

  const combinar = () => {
    if (ritmoNum == null) return;
    setErroEnvio(null);
    iniciarEnvio(async () => {
      const r = await combinarPlano(duplaId, {
        ritmo: ritmoNum,
        decisoes: decisoesArr(),
        semGrade: semGrade ?? undefined,
        fusao: gruposFusao.length ? gruposFusao : undefined,
      });
      if ("error" in r) {
        setErroEnvio(r.error);
        return;
      }
      toast.success(
        r.demo
          ? "Modo demo: nada é gravado de verdade."
          : r.status === "proposto"
            ? "Proposto. Falta um aceite da dupla."
            : "Combinado em vigor. O outro lado foi avisado."
      );
      setOpen(false);
      onDone?.();
      router.refresh();
    });
  };

  // ---------- perguntas ----------

  const perguntaRitmo = (
    <div>
      <h3
        ref={passoId === "ritmo" ? tituloRef : undefined}
        tabIndex={-1}
        className="text-sm font-semibold outline-none"
      >
        Quantos encontros por semana vocês conseguem?
      </h3>
      {sim && sim.grade.diasComuns > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          {lado === "staff"
            ? `A dupla marcou períodos livres em comum em ${sim.grade.diasComuns} ${
                sim.grade.diasComuns === 1 ? "dia" : "dias"
              } da semana`
            : `Vocês marcaram períodos livres em comum em ${sim.grade.diasComuns} ${
                sim.grade.diasComuns === 1 ? "dia" : "dias"
              } da semana`}
          . Períodos livres não são horários marcados.
        </p>
      )}
      <fieldset className="mt-3">
        <legend className="sr-only">Encontros por semana</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <OpcaoPilula
              key={n}
              nome="ritmo"
              valor={String(n)}
              marcado={ritmoSel === n}
              sugerido={n === sugestaoRitmo}
              onChange={() => {
                setRitmoSel(n);
                setErroEnvio(null);
                simular({ ritmo: n });
              }}
            >
              <span className="text-base font-semibold">{n}</span>
              <span className="sr-only">
                {n === 1 ? "encontro" : "encontros"} por semana
              </span>
            </OpcaoPilula>
          ))}
          <OpcaoPilula
            nome="ritmo"
            valor="outro"
            marcado={ritmoSel === "outro"}
            onChange={() => {
              setRitmoSel("outro");
              setErroEnvio(null);
            }}
          >
            Outro
          </OpcaoPilula>
        </div>
      </fieldset>
      {ritmoSel === "outro" && (
        <div className="mt-3">
          <Input
            inputMode="numeric"
            placeholder="Ex.: 8"
            aria-label="Outro número de encontros por semana"
            value={outroTxt}
            onChange={(e) => {
              const t = e.target.value;
              setOutroTxt(t);
              if (deb.current) clearTimeout(deb.current);
              const ok = /^\d+$/.test(t.trim()) && Number(t.trim()) >= 1;
              if (!ok) return;
              deb.current = setTimeout(
                () => simular({ ritmo: Number(t.trim()) }),
                300
              );
            }}
          />
          {outroTxt.trim() !== "" && ritmoNum == null && (
            <p role="status" className="mt-1.5 text-xs text-muted-foreground">
              Digite um número de encontros por semana (1 ou mais).
            </p>
          )}
        </div>
      )}
    </div>
  );

  const perguntaRecesso = sim ? (
    lado === "staff" ? (
      <div>
        <h3
          ref={passoId === "recesso" ? tituloRef : undefined}
          tabIndex={-1}
          className="text-sm font-semibold outline-none"
        >
          {sim.recessos.length > 1
            ? "Os recessos no caminho"
            : "O recesso no caminho"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          A decisão é da dupla. A equipe acompanha e cobra, não responde
          por eles.
        </p>
        <ul className="mt-3 space-y-2">
          {sim.recessos.map((r) => (
            <li
              key={r.cicloEventoId}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-3.5 py-3 shadow-[var(--shadow-inset)]"
            >
              <p className="text-sm font-medium">
                {r.titulo} · {diaCurto(r.inicio)} a {diaCurto(r.fim)}
              </p>
              <p className="text-xs text-muted-foreground">
                {recessoUsa(r) == null
                  ? "a dupla ainda não decidiu"
                  : recessoUsa(r)
                    ? "vão usar o recesso"
                    : "seguem se encontrando"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    ) : (
      <div>
        <h3
          ref={passoId === "recesso" ? tituloRef : undefined}
          tabIndex={-1}
          className="text-sm font-semibold outline-none"
        >
          {sim.recessos.length > 1
            ? "Os recessos no caminho"
            : "O recesso no caminho"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Vocês decidem se param ou seguem se encontrando em cada período.
          Qualquer um dos dois pode responder pela dupla.
        </p>
        <div className="mt-3 space-y-3">
          {sim.recessos.map((r) => (
            <fieldset
              key={r.cicloEventoId}
              className="rounded-lg border border-border px-3.5 pb-3 pt-1"
            >
              <legend className="px-1 text-sm font-medium">
                {r.titulo} · {diaCurto(r.inicio)} a {diaCurto(r.fim)}
              </legend>
              <div className="grid gap-2">
                <OpcaoPilula
                  nome={`recesso-${r.cicloEventoId}`}
                  valor="usa"
                  marcado={recessoUsa(r) === true}
                  onChange={() => {
                    const d = { ...decisoes, [r.cicloEventoId]: true };
                    setDecisoes(d);
                    simular({ decisoes: d });
                  }}
                >
                  Vamos usar o recesso
                </OpcaoPilula>
                <OpcaoPilula
                  nome={`recesso-${r.cicloEventoId}`}
                  valor="seguem"
                  marcado={recessoUsa(r) === false}
                  onChange={() => {
                    const d = { ...decisoes, [r.cicloEventoId]: false };
                    setDecisoes(d);
                    simular({ decisoes: d });
                  }}
                >
                  Vamos seguir nos encontrando
                </OpcaoPilula>
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    )
  ) : null;

  const minhaGradeFalta =
    sim != null &&
    ((lado === "mentor" && !sim.grade.mentor) ||
      (lado === "mentorado" && !sim.grade.jovem));
  const nomeOutro =
    lado === "mentor"
      ? (grades?.jovemNome ?? "seu jovem")
      : lado === "mentorado"
        ? "seu mentor"
        : null;
  const copiaGrade = !sim
    ? null
    : !sim.grade.mentor && !sim.grade.jovem
      ? lado === "staff"
        ? "Ninguém da dupla marcou os períodos livres ainda."
        : "Vocês ainda não marcaram os períodos livres da semana."
      : !sim.grade.mentor || !sim.grade.jovem
        ? lado === "staff"
          ? `${!sim.grade.mentor ? "O mentor" : (grades?.jovemNome ?? "O jovem")} ainda não marcou os períodos livres.`
          : minhaGradeFalta
            ? "Você ainda não marcou os seus períodos livres."
            : `${nomeOutro} ainda não marcou os períodos livres.`
        : "As grades dos dois não se cruzam em nenhum dia da semana.";

  const perguntaGrade = sim ? (
    <div>
      <h3
        ref={passoId === "grade" ? tituloRef : undefined}
        tabIndex={-1}
        className="text-sm font-semibold outline-none"
      >
        Os períodos livres da semana
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{copiaGrade}</p>
      {lado !== "staff" && (
        <div className="mt-3 rounded-lg border border-border px-3.5 py-3">
          <p className="text-sm font-medium">
            {minhaGradeFalta
              ? "Marque os seus períodos livres:"
              : "Se quiser, ajuste a sua grade:"}
          </p>
          <div className="mt-2">
            <CampoDisponibilidade
              value={
                gradeNova ??
                (lado === "mentor"
                  ? (grades?.mentor ?? null)
                  : (grades?.jovem ?? null))
              }
              onChange={setGradeNova}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={enviando || simulando}
              onClick={salvarGrade}
            >
              {enviando ? "Salvando…" : "Salvar minha grade"}
            </Button>
            {gradeSalva && (
              <p role="status" className="text-xs text-[var(--ok-text)]">
                Grade salva. A projeção já usa ela.
              </p>
            )}
          </div>
        </div>
      )}
      <fieldset className="mt-3">
        <legend className="sr-only">Usar a grade ou combinar sem ela</legend>
        <div className="grid gap-2">
          {ambasGrades && (
            <OpcaoPilula
              nome="grade"
              valor="com"
              marcado={semGrade === false}
              onChange={() => {
                setSemGrade(false);
                simular({ semGrade: false });
              }}
            >
              Usar a grade marcada
            </OpcaoPilula>
          )}
          <OpcaoPilula
            nome="grade"
            valor="sem"
            marcado={semGrade === true}
            onChange={() => {
              setSemGrade(true);
              simular({ semGrade: true });
            }}
          >
            Combinar sem a grade
          </OpcaoPilula>
        </div>
      </fieldset>
      <p className="mt-2 text-xs text-muted-foreground">
        A grade é preferência, não bloqueio. Encontro fora dos períodos
        livres acontece do mesmo jeito.
      </p>
      {lado === "staff" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Só cada lado ajusta a própria grade.
        </p>
      )}
    </div>
  ) : null;

  const passosComData = aplicavel?.passos ?? [];
  const primeiroPasso = passosComData[0] ?? null;
  const ultimoPasso = passosComData.at(-1) ?? null;

  // 018: a data da sessão é a mais cedo do grupo — a mesma régua do
  // escopo, então a prévia aqui é a data que o combinado grava
  const dataDoGrupo = (g: readonly number[]) =>
    g
      .map(
        (n) =>
          passosComData.find((p) => p.numero === n)?.data ?? ""
      )
      .filter(Boolean)
      .sort()[0] ?? "";
  const alternarAresta = (n: number) => {
    const prox = { ...fusaoSel, [n]: !fusaoSel[n] };
    setFusaoSel(prox);
    const grupos = fusaoDeArestas(
      arestasFusao.filter((a) => prox[a] === true)
    );
    simular({ fusao: grupos });
  };

  // um gesto, duas partes: o aviso diz o que se perde (a semana de
  // prática entre os encontros) e o que fazer (a prática migra pras
  // reflexões do registro). Só some com o "Continuar mesmo assim".
  const avisoPratica = precisaAvisoPratica &&
    avisoReconhecido !== assinaturaFusao && (
      <div className="mt-3 space-y-2 rounded-lg border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3.5 py-3">
        <p className="flex items-start gap-1.5 text-sm text-[var(--warn-text)]">
          <Warning size={14} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-semibold">
              A semana de prática entre esses encontros não vai
              acontecer.
            </strong>{" "}
            O encontro seguinte já começa pela devolutiva de uma
            prática que ninguém fez.
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          Dá pra compensar: a prática entra nas reflexões do registro e
          do próprio combinado, na semana que sobrar.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAvisoReconhecido(assinaturaFusao)}
        >
          Continuar mesmo assim
        </Button>
      </div>
    );

  const perguntaSessao = sim ? (
    <div>
      <h3
        ref={passoId === "sessao" ? tituloRef : undefined}
        tabIndex={-1}
        className="text-sm font-semibold outline-none"
      >
        Querem juntar encontros numa sessão só?
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Encontros vizinhos podem sair juntos numa sessão de 2h — um dia
        a menos no calendário. É escolha de vocês: sem juntar, cada
        encontro segue no seu dia.
      </p>
      <fieldset className="mt-3">
        <legend className="sr-only">
          Encontros pra juntar na mesma sessão
        </legend>
        <div className="space-y-2">
          {arestasFusao.map((n) => (
            <label
              key={n}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-muted",
                "has-checked:border-foreground has-checked:bg-muted",
                "has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              )}
            >
              <input
                type="checkbox"
                checked={fusaoSel[n] === true}
                onChange={() => alternarAresta(n)}
                className="size-4 shrink-0 accent-foreground"
              />
              Juntar o {n}º e o {n + 1}º na mesma sessão
            </label>
          ))}
        </div>
      </fieldset>
      {gruposFusao.length > 0 && (
        <ul className="mt-2 space-y-1">
          {gruposFusao.map((g) => (
            <li
              key={g.join("-")}
              className="text-xs text-muted-foreground"
            >
              {listaEncontros(g)} saem juntos
              {dataDoGrupo(g) ? ` em ${diaCurto(dataDoGrupo(g))}` : ""} ·
              sessão de 2h
            </li>
          ))}
        </ul>
      )}
      {avisoPratica}
    </div>
  ) : null;

  const perguntaConfirmar = sim ? (
    <div>
      <h3
        ref={passoId === "confirmar" ? tituloRef : undefined}
        tabIndex={-1}
        className="text-sm font-semibold outline-none"
      >
        Revisar e combinar
      </h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        <li className="font-medium">
          {ritmoNum != null ? rotuloRitmo(ritmoNum) : "…"}
        </li>
        {primeiroPasso && ultimoPasso && (
          <li className="text-muted-foreground">
            {passosComData.length}{" "}
            {passosComData.length === 1 ? "encontro" : "encontros"} no plano.
            De {diaCurto(primeiroPasso.data)} a {diaCurto(ultimoPasso.data)}.
          </li>
        )}
        {sim.recessos.map((r) => (
          <li key={r.cicloEventoId} className="text-muted-foreground">
            {r.titulo}:{" "}
            {recessoUsa(r) == null
              ? "a dupla ainda não decidiu"
              : recessoUsa(r)
                ? "vão usar o recesso"
                : "seguem se encontrando"}
          </li>
        ))}
        {semGrade === true && (
          <li className="text-muted-foreground">
            Combinado sem a grade. As datas podem cair fora dos períodos
            livres.
          </li>
        )}
        {semGrade === false && ambasGrades && (
          <li className="text-muted-foreground">
            Usa a grade marcada. As datas preferem os dias livres em comum.
          </li>
        )}
        {algumaGrade && !ambasGrades && (
          <li className="text-muted-foreground">
            Só um lado marcou os períodos livres, então as datas não
            preferem dia nenhum até a outra grade chegar.
          </li>
        )}
        {gruposFusao.map((g) => (
          <li key={`fusao-${g.join("-")}`} className="text-muted-foreground">
            {listaEncontros(g)} encontros na mesma sessão de 2h
            {dataDoGrupo(g) ? `, em ${diaCurto(dataDoGrupo(g))}` : ""}.
          </li>
        ))}
      </ul>
      {avisoPratica}
      {faltaDecisao && (
        <p role="status" className="mt-2 text-sm text-[var(--warn-text)]">
          Falta a dupla confirmar o recesso.
        </p>
      )}
      {aplicavel && !aplicavel.emDia && aplicavel.dataRecuperacao == null && (
        <p role="status" className="mt-2 text-sm text-[var(--warn-text)]">
          {ritmoNum != null
            ? `Com ${rotuloRitmo(ritmoNum)} o plano não fecha até o encerramento.`
            : "O plano não fecha até o encerramento."}{" "}
          Volte e escolha mais encontros por semana.
        </p>
      )}
    </div>
  ) : null;

  // ---------- a projeção viva ----------

  const painel = sim ? (
    <div className="rounded-lg bg-muted/50 px-3.5 py-3 shadow-[var(--shadow-inset)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">O que a projeção diz</p>
        {simulando && (
          <SpinnerGap
            size={14}
            aria-hidden
            className="animate-spin text-muted-foreground"
          />
        )}
      </div>
      {!aplicavel ? (
        <p role="status" className="mt-1.5 text-sm text-muted-foreground">
          {plano && !plano.aplicavel ? plano.motivo : null}
        </p>
      ) : aplicavel.emDia ? (
        <p role="status" className="mt-1.5 text-sm text-muted-foreground">
          A dupla está em dia. Não tem plano pra combinar.
        </p>
      ) : (
        <div className="mt-1.5 space-y-1.5">
          <p role="status" className="text-sm font-medium">
            {simulando && <span className="sr-only">Atualizando. </span>}
            {aplicavel.dataRecuperacao ? (
              <>
                Com {rotuloRitmo(ritmoNum ?? aplicavel.ritmo)} ficam em dia
                em{" "}
                <span className="tabular-nums">
                  {diaCurto(aplicavel.dataRecuperacao)}
                </span>
                .
              </>
            ) : aplicavel.alternativaRitmo ? (
              <>
                Com {rotuloRitmo(ritmoNum ?? aplicavel.ritmo)} não fecha.
                Com {rotuloRitmo(aplicavel.alternativaRitmo.ritmo)} ficariam
                em dia em {diaCurto(aplicavel.alternativaRitmo.data)}.
              </>
            ) : (
              "Com essa quantidade por semana o plano não fecha até o encerramento."
            )}
          </p>
          {aplicavel.estado === "conversa" && (
            <p className="text-sm text-muted-foreground">
              {aplicavel.sugestao}
            </p>
          )}
          {aplicavel.alternativaRecesso && (
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <SunHorizon
                size={14}
                aria-hidden
                className="mt-0.5 shrink-0"
              />
              Se vocês seguirem se encontrando no recesso,{" "}
              {rotuloRitmo(aplicavel.alternativaRecesso.ritmo)} já basta: em
              dia em {diaCurto(aplicavel.alternativaRecesso.data)}.
            </p>
          )}
          {aplicavel.alternativaRitmo && ritmoNum != null && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0"
              onClick={() => {
                const n = aplicavel.alternativaRitmo!.ritmo;
                if (n <= 5) setRitmoSel(n);
                else {
                  setRitmoSel("outro");
                  setOutroTxt(String(n));
                }
                simular({ ritmo: n });
              }}
            >
              Usar {rotuloRitmo(aplicavel.alternativaRitmo.ritmo)}
            </Button>
          )}
          {aplicavel.avisos.length > 0 && (
            <ul className="space-y-1">
              {aplicavel.avisos.map((a) => (
                <li
                  key={a}
                  className="flex items-start gap-1.5 text-xs text-muted-foreground"
                >
                  <Warning
                    size={12}
                    aria-hidden
                    className="mt-0.5 shrink-0"
                  />
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  ) : null;

  // ---------- estados terminais (sem pergunta a fazer) ----------

  const conteudoTerminal = sim ? (
    sim.planoVivo != null ? (
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--destaque)]/15"
        >
          <Check size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold">
            Já existe um combinado em vigor pra essa dupla.
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            O plano novo entra como versão só quando o atual for
            contestado.
          </p>
        </div>
      </div>
    ) : !aplicavel ? (
      <p className="text-sm text-muted-foreground">
        {plano && !plano.aplicavel ? plano.motivo : null}
      </p>
    ) : aplicavel.emDia ? (
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ok-bg)] text-[var(--ok-text)]"
        >
          <Check size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold">A dupla está em dia.</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Não tem plano pra combinar.
          </p>
        </div>
      </div>
    ) : null
  ) : null;

  const idx = passos.indexOf(passoId);

  const corpo = (
    <>
      {!sim && !erroSim && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <SpinnerGap size={16} aria-hidden className="animate-spin" />
          Montando a projeção…
        </div>
      )}
      {erroSim && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{erroSim}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => simular()}
          >
            Tentar de novo
          </Button>
        </div>
      )}
      {sim &&
        (terminal ? (
          <div className="space-y-4">{conteudoTerminal}</div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground">
              Pergunta {idx + 1} de {passos.length}
            </p>
            {passoId === "ritmo" && perguntaRitmo}
            {passoId === "recesso" && perguntaRecesso}
            {passoId === "grade" && perguntaGrade}
            {passoId === "sessao" && perguntaSessao}
            {passoId === "confirmar" && perguntaConfirmar}
            {painel}
            {erroEnvio && (
              <p role="status" className="text-sm text-destructive">
                {erroEnvio}
              </p>
            )}
          </div>
        ))}
    </>
  );

  const rodape = (
    <div className="flex items-center gap-2">
      {sim && !terminal && idx > 0 && (
        <Button
          type="button"
          variant="outline"
          disabled={enviando}
          onClick={() => setPasso(idx - 1)}
        >
          <ArrowLeft aria-hidden />
          Voltar
        </Button>
      )}
      {terminal || !sim ? (
        <Button
          type="button"
          variant="outline"
          className="ml-auto"
          onClick={() => setOpen(false)}
        >
          Fechar
        </Button>
      ) : idx < passos.length - 1 ? (
        <Button
          type="button"
          className="ml-auto"
          disabled={!podeAvancar}
          onClick={() => setPasso(idx + 1)}
        >
          Avançar
          <ArrowRight aria-hidden />
        </Button>
      ) : (
        <Button
          type="button"
          className="ml-auto"
          disabled={!podeCombinar}
          onClick={combinar}
        >
          <Check aria-hidden />
          {enviando ? "Combinando…" : "Combinar"}
        </Button>
      )}
    </div>
  );

  const superficie = desktop ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Combinar o plano</DialogTitle>
          <DialogDescription>
            Uma pergunta por vez. O combinado só sai no último passo.
          </DialogDescription>
        </DialogHeader>
        {corpo}
        <DialogFooter sticky className="sm:justify-start">
          {rodape}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        closeLabel="Fechar"
        className="h-[min(85dvh,760px)] p-4"
      >
        <div className="pr-8">
          <SheetTitle>Combinar o plano</SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Uma pergunta por vez. O combinado só sai no último passo.
          </p>
        </div>
        <div className="mt-4 min-h-0 flex-1">{corpo}</div>
        <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 border-t bg-sidebar p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {rodape}
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <>
      {!controlado && (
        <Button
          type="button"
          variant={variante}
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Handshake aria-hidden />
          {rotulo}
        </Button>
      )}
      {superficie}
    </>
  );
}
