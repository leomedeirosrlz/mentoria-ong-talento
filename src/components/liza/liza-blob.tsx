"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion, useTransform, type MotionValue, type Transition } from "motion/react";
import { cn } from "cn";
import type { LizaEstado, LizaProps } from "./tipos";
import {
  EASE,
  FADE,
  MOLA,
  MOLA_RAPIDA,
  REDUZIDA,
  px2u,
  useAlvoMola,
  useMomento,
  useOlhar,
  usePiscar,
  useReduzido,
  useTagarelar,
  type Ponto,
} from "./use-olhar";

/** Conceito B — "Blob". Um disco lima cheio de vida no canto da tela:
 *  respira devagar (sempre, bem pouco) e
 *  comunica com o corpo inteiro: espicha quando você chega perto, se encolhe
 *  antes de pular, amassa ao aterrissar, murcha e inclina no erro. Olhos
 *  ovais grandes com cílios discretos no canto externo e pálpebras que
 *  carregam a expressão (atenção, concentração, empatia, desconfiança); a
 *  boquinha muda de forma (sorriso, "o", aberta, reta, onda, triste), mas é
 *  coadjuvante — os olhos falam primeiro. */

const TINTA = "var(--brand-ink)";
const LIMA = "var(--brand-lime)";

/** silhueta de disco: círculo limpo ocupando o viewBox todo (mesmo r=50
 *  do conceito Disco). A expressão segue do Blob, só o recorte mudou */
const CORPO = "M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z";

/** teste: esconde a boquinha no `parado` pra comparar só com olhos —
 *  false = some no parado; true = normal */
const BOCA_NO_PARADO = true;

type Boca = "sorriso" | "o" | "aberta" | "reta" | "onda" | "triste" | "falando";

type Pose = {
  alvo: Ponto | null;
  sx: number;
  sy: number;
  palpebra: number;
  forma: "oval" | "arco" | "aperto" | "fenda";
  boca: Boca;
  /** escala e deslocamento do "o"/sorriso (bico pensativo vai pro lado) */
  bocaEscala: number;
  bocaX: number;
  /** sobrancelha por lado: "aflita" (canto interno pra cima — erro,
      cético) e "brava" (canto interno pra baixo — emburrada, cético) */
  sobrancelhaEsq: boolean;
  sobrancelhaDir: boolean;
  bravaEsq: boolean;
  bravaDir: boolean;
  /** curvatura do topo só do olho direito — o "hmm" de quem está
      pensando é a pálpebra descendo, não o olho inteiro diminuindo */
  topoDir: number;
  /** intensidade das bochechas rosadas (0–0.8) — fofura de mascote */
  bochecha: number;
  /** segundo reflexo nos olhos — o brilho de "deu certo" */
  brilhoExtra: boolean;
  /** curvatura do topo do olho — 1 = redondo; <1 e a linha do topo desce
      em curva (pálpebra molenga, não tampa reta) */
  olhoTopo: number;
  /** curvatura da parte de baixo — <1 e a base curva pra dentro do olho */
  olhoBaixo: number;
  /** inclinação do olho em graus, espelhada por lado — positivo derruba
      o canto EXTERNO (sono, dengoso); negativo derruba o interno e vira
      a fenda de bravo, não de sono */
  olhoTilt: number;
  corpo: { sx: number; sy: number; rotate: number };
};

const BASE: Pose = {
  alvo: null,
  sx: 1,
  sy: 1,
  palpebra: -0.35,
  forma: "oval",
  boca: "sorriso",
  // neutro: curvinha pequena — quem expressa são os olhos
  bocaEscala: 0.85,
  bocaX: 0,
  sobrancelhaEsq: false,
  sobrancelhaDir: false,
  bravaEsq: false,
  bravaDir: false,
  topoDir: 1,
  bochecha: 0,
  brilhoExtra: false,
  olhoTopo: 1,
  olhoBaixo: 1,
  olhoTilt: 0,
  corpo: { sx: 1, sy: 1, rotate: 0 },
};

/** Humor de bichinho — camada interna, por cima do `estado` externo. Não é
 *  botão: a criatura reage a ser encarada e cutucada. Só vale enquanto ela
 *  está de boa (parada/atenta); qualquer estado de trabalho sobrescreve. */
type Humor = "neutro" | "timida" | "cochilo" | "irritado" | "tonto";

function useBichinho(ativo: boolean) {
  const [humor, setHumor] = useState<Humor>("neutro");
  const toques = useRef<number[]>([]);
  const esfregadas = useRef<number[]>([]);
  const tTimida = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tCochilo = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tHumor = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // reset por "estado derivado da render anterior" (mesmo padrão do
  // useMomento): saiu do modo de boa → humor zera; refs/timers limpa no
  // effect abaixo (ref no render é proibido)
  const [ativoAntes, setAtivoAntes] = useState(ativo);
  if (ativoAntes !== ativo) {
    setAtivoAntes(ativo);
    if (!ativo) {
      setHumor("neutro");
    }
  }

  useEffect(() => {
    if (ativo) return;
    toques.current = [];
    esfregadas.current = [];
    clearTimeout(tTimida.current);
    clearTimeout(tCochilo.current);
    clearTimeout(tHumor.current);
  }, [ativo]);

  useEffect(
    () => () => {
      clearTimeout(tTimida.current);
      clearTimeout(tCochilo.current);
      clearTimeout(tHumor.current);
    },
    [],
  );

  const entrar = () => {
    if (!ativo || humor === "tonto" || humor === "irritado") return;
    // carinho = vai-e-volta rápido: cada entrada conta uma esfregada; ~4
    // em seguida e ela fica toda tímida de olho fechado — e cada esfregada
    // a mais renova a corujice (parou o carinho, ela abre o olho sozinha)
    const agora = performance.now();
    esfregadas.current = esfregadas.current.filter((t) => agora - t < 1600);
    esfregadas.current.push(agora);
    if (esfregadas.current.length >= 4 || humor === "timida") {
      esfregadas.current = [];
      setHumor("timida");
      clearTimeout(tHumor.current);
      tHumor.current = setTimeout(() => setHumor("neutro"), 1600);
    }
    // dois jeitos de carinho: as esfregadas lá em cima, ou a mão parada
    // em cima ~2,4s — e se o afago continuar muito, ela cochila
    clearTimeout(tTimida.current);
    tTimida.current = setTimeout(() => setHumor("timida"), 2000);
    clearTimeout(tCochilo.current);
    tCochilo.current = setTimeout(() => setHumor("cochilo"), 5000);
  };

  const sair = () => {
    clearTimeout(tTimida.current);
    clearTimeout(tCochilo.current);
    if (humor === "timida") {
      // a cauda do carinho: fica envergonhada mais um instante antes de
      // abrir o olho de novo
      clearTimeout(tHumor.current);
      tHumor.current = setTimeout(() => setHumor("neutro"), 800);
    } else if (humor === "cochilo") {
      setHumor("neutro");
    }
  };

  const tocar = () => {
    if (!ativo || humor === "tonto") return;
    // toque interrompe carinho: se o timer da mão parada disparasse no
    // meio da reação, timida/cochilo sobrescreveriam emburrada/tonto
    clearTimeout(tTimida.current);
    clearTimeout(tCochilo.current);
    const agora = performance.now();
    toques.current = toques.current.filter((t) => agora - t < 1600);
    toques.current.push(agora);
    const n = toques.current.length;
    if (n < 3) return;
    clearTimeout(tHumor.current);
    if (n >= 5) {
      // atordoado: a contagem zera e tocar não faz nada até ele se
      // recompor (early return lá em cima) — curto, é um susto, não um show
      toques.current = [];
      setHumor("tonto");
      tHumor.current = setTimeout(() => setHumor("neutro"), 1700);
    } else {
      // emburrada não zera a contagem: insistir leva direto pro tonto
      setHumor("irritado");
      tHumor.current = setTimeout(() => setHumor("neutro"), 1900);
    }
  };

  return { humor: ativo ? humor : "neutro", entrar, sair, tocar };
}

function poseDe(estado: LizaEstado, momento: boolean, detalhe: boolean): Pose {
  switch (estado) {
    case "atento":
      // escuta: espicha pra cima e os olhos abrem bem — a pálpebra recolhe
      // e o topo arredonda; a boca fica discreta (olho atento é o "oi,
      // posso ajudar?"). Um "o" de susto a cada hover lia como sobressalto
      return { ...BASE, sx: 1.06, sy: 1.1, palpebra: -0.6, olhoTopo: 1.06, bocaEscala: 1, corpo: { sx: 0.97, sy: 1.04, rotate: 0 } };
    case "aberto":
      return momento
        ? { ...BASE, alvo: { x: 0, y: -0.2 }, forma: "arco", boca: "aberta" }
        // acenou, acomodou: solta o olhar pra acompanhar quem está com ela
        : BASE;
    case "consultando":
      // 🤨: o arco do olho esquerdo SOBE extra (côncavo, olho arregala —
      // sobrancelha levantada) e a pálpebra do direito desce (convexo)
      return {
        ...BASE,
        alvo: { x: 0.6, y: -0.8 },
        palpebra: 0.05,
        boca: "o",
        bocaEscala: 0.72,
        bocaX: 2.6,
        olhoTopo: 1.25,
        topoDir: 0.6,
        // a base do olho sobe um tico: o "apertar" de quem está pensando
        olhoBaixo: 0.85,
      };
    case "escrevendo":
      // concentração: pálpebra a meio caminho e a base subindo — olhar de
      // quem lê com atenção, não de sono
      return { ...BASE, alvo: { x: 0, y: 0.3 }, sy: 0.86, palpebra: 0.12, olhoBaixo: 0.8, boca: "reta" };
    case "falando":
      // tagarelando: olhar em quem ouve, boca trabalhando — e a base do
      // olho curva pra dentro, aquela expressão de "tô contando coisa"
      return { ...BASE, alvo: { x: 0, y: 0.15 }, boca: "falando", olhoBaixo: 0.65, olhoTopo: 0.95 };
    case "pronto":
      return momento
        ? { ...BASE, alvo: { x: 0, y: -0.15 }, sx: 1.14, sy: 1.14, boca: "aberta", brilhoExtra: true }
        : BASE;
    case "erro":
      // "ops" curto (boquinha em o) e assenta num chateado contido —
      // empatia, não drama
      return {
        ...BASE,
        alvo: { x: -0.1, y: 0.3 },
        sx: 0.88,
        sy: 0.88,
        boca: momento ? "o" : "triste",
        bocaEscala: momento ? 0.8 : 1,
        sobrancelhaEsq: detalhe,
        sobrancelhaDir: detalhe,
        // empatia: os cantos externos caem e a pálpebra baixa um pouco —
        // o "poxa" está no olho, a boca só confirma
        palpebra: 0.1,
        olhoTilt: 5,
        olhoTopo: 0.9,
        bochecha: 0,
        corpo: { sx: 1.015, sy: 0.97, rotate: -5 },
      };
    case "sonolento":
      // olho fechado é uma linha curva de pontas redondas (a ︶ de sono),
      // pendendo nos cantos externos — a fenda preenchida lia como brava
      return { ...BASE, alvo: { x: 0, y: 0.4 }, forma: "fenda", boca: "o", bocaEscala: 0.6, olhoTilt: 6 };
    default:
      return BASE;
  }
}

type Alvo = Record<string, number | number[]>;

/** Coreografia do corpo e da sombra por estado. Sob reduced motion fica só a
 *  pose estática (inclinação/encolhida do erro, espichada do hover). O humor
 *  do bichinho manda no corpo quando existe — é reação, não trabalho. */
function movimentoDoCorpo({
  efetivo,
  momento,
  festa,
  humor,
  reduzido,
  pose,
  transicao,
  tamanho,
}: {
  efetivo: LizaEstado;
  momento: boolean;
  festa: boolean;
  humor: Humor;
  reduzido: boolean;
  pose: Pose;
  transicao: Transition;
  tamanho: number;
}): { corpo: Alvo; corpoT: Transition } {
  const c = pose.corpo;
  const estatico = {
    corpo: { y: 0, scaleX: c.sx, scaleY: c.sy, rotate: c.rotate },
    corpoT: transicao,
  };
  if (reduzido) return estatico;

  const respira = (amp: number, dur: number) => {
    const loop = { duration: dur, repeat: Infinity, ease: "easeInOut" } as const;
    return {
      ...estatico,
      // volume quase constante: estica em Y, afina um pouco em X
      corpo: { y: 0, scaleX: [1, 1 - amp * 0.55, 1], scaleY: [1, 1 + amp, 1], rotate: 0 },
      corpoT: { default: transicao, scaleX: loop, scaleY: loop },
    };
  };

  // humores de bichinho — nada de deslocamento: o corpo fica plantado e a
  // reação vem da pose. Tonto é a exceção: balança girando no lugar
  // (pivô na base) porque tontura é literalmente perder o equilíbrio.
  if (humor === "tonto") {
    const t: Transition = { duration: 0.9, times: [0, 0.25, 0.55, 0.8, 1], ease: "easeInOut" };
    return {
      corpo: { y: 0, scaleX: [1, 1.02, 1, 1.01, 1], scaleY: [1, 0.97, 1, 0.99, 1], rotate: [0, -6, 5, -3, c.rotate] },
      corpoT: t,
    };
  }
  if (humor === "timida") {
    // ronroninho de carinho: squish macio e devagar, olhos fechados
    const loop = { duration: 2.4, repeat: Infinity, ease: "easeInOut" } as const;
    return {
      corpo: { y: 0, scaleX: [1.02, 1.035, 1.02], scaleY: [0.95, 0.975, 0.95], rotate: 0 },
      corpoT: { default: transicao, scaleX: loop, scaleY: loop },
    };
  }
  if (humor === "irritado") {
    // "hmpf": encolhe num bufo contido e vira o rosto — uma vez, ~0,4s
    const t: Transition = { duration: 0.42, times: [0, 0.4, 1], ease: EASE };
    return {
      corpo: { y: 0, scaleX: [1, 1.06, c.sx], scaleY: [1, 0.9, c.sy], rotate: [0, c.rotate - 2, c.rotate] },
      corpoT: t,
    };
  }
  if (humor === "cochilo") {
    // respiro pesado e fundo — quase dormiu debaixo do seu cursor
    return {
      ...estatico,
      corpo: { y: 0, scaleX: [1, 1 - 0.03 * 0.55, 1], scaleY: [0.96, 0.96 + 0.03, 0.96], rotate: -2 },
      corpoT: { default: transicao, scaleX: { duration: 5.2, repeat: Infinity, ease: "easeInOut" }, scaleY: { duration: 5.2, repeat: Infinity, ease: "easeInOut" } },
    };
  }

  if (festa) {
    const pulo = px2u(5, tamanho);
    // antecipação (agacha) → sobe esticado → cai → amassa → assenta
    const t: Transition = {
      duration: 0.75,
      times: [0, 0.16, 0.46, 0.72, 1],
      ease: [EASE, "easeOut", "easeIn", EASE],
    };
    return {
      corpo: {
        y: [0, 0, -pulo, 0, 0],
        scaleX: [1, 1.07, 0.95, 1.06, 1],
        scaleY: [1, 0.9, 1.06, 0.92, 1],
        rotate: 0,
      },
      corpoT: t,
    };
  }
  if (efetivo === "aberto" && momento) {
    // "boing" de alegria, sem sair do chão
    return {
      ...estatico,
      corpo: { y: 0, scaleX: [1, 0.95, 1.03, 1], scaleY: [1, 1.06, 0.98, 1], rotate: 0 },
      corpoT: { duration: 0.55, times: [0, 0.35, 0.7, 1], ease: EASE },
    };
  }
  if (efetivo === "erro" && momento) {
    // o "ops": um recuo rápido (encolhe) e um balanço curto da cabeça
    // antes de assentar inclinado
    const r = c.rotate;
    return {
      corpo: {
        y: 0,
        scaleX: [1, 1.05, c.sx, c.sx, c.sx],
        scaleY: [1, 0.9, c.sy, c.sy, c.sy],
        rotate: [0, 0, r - 3, r + 2, r],
      },
      corpoT: { duration: 0.6, times: [0, 0.18, 0.45, 0.75, 1], ease: "easeInOut" },
    };
  }
  if (efetivo === "consultando") {
    const flutua = Math.min(px2u(2, tamanho), 2.5);
    const loop = { duration: 2.6, repeat: Infinity, ease: "easeInOut" } as const;
    return {
      corpo: { y: [0, -flutua, 0], scaleX: 1, scaleY: 1, rotate: 0 },
      corpoT: { default: transicao, y: loop },
    };
  }
  if (efetivo === "sonolento") {
    // respiro pesado e perceptível — e a cabeça pende devagar junto,
    // como quem vai cochilando sentado
    const loop = { duration: 5.2, repeat: Infinity, ease: "easeInOut" } as const;
    return {
      ...estatico,
      corpo: { y: 0, scaleX: [1, 0.98, 1], scaleY: [1, 1.035, 1], rotate: [0, -3, -3, 0] },
      corpoT: {
        default: transicao,
        scaleX: loop,
        scaleY: loop,
        rotate: { duration: 5.2, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.7, 1] },
      },
    };
  }
  // falando: respiro mais curto e vivo, o corpo acompanha a fala
  if (efetivo === "falando") return respira(0.018, 2.4);
  if (efetivo === "parado" || efetivo === "aberto" || efetivo === "escrevendo") {
    // respiração de repouso: ~2% de escala — perceptível sem virar "mexendo"
    return respira(0.022, 3.8);
  }
  return estatico;
}

export function LizaBlob({ estado, tamanho, seguirCursor = true, className }: LizaProps) {
  const ref = useRef<SVGSVGElement>(null);
  const clipId = `liza-blob-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reduzido = useReduzido();
  const momento = useMomento(estado);
  const detalhe = tamanho >= 28; // boca, pálpebra, sobrancelha, sombra

  const efetivo: LizaEstado = estado === "pronto" && !momento ? "parado" : estado;
  const festa = estado === "pronto" && momento;

  // bichinho: humor interno por cima do estado — só quando está de boa.
  // "aberto" entra depois da saudação (momento) — a mascote do empty state
  // vira pet assim que para de acenar
  const { humor, entrar, sair, tocar } = useBichinho(
    efetivo === "parado" || efetivo === "atento" || (efetivo === "aberto" && !momento),
  );

  // tonto = olhos apertados > < e boquinha ondulada; emburrada = vira o
  // rosto de lado, sobrancelha franzida e bico — sem mudar de cor (vermelho
  // é a cor de risco da interface) e sem efeito por cima
  const pose: Pose =
    humor === "tonto"
      ? { ...BASE, alvo: { x: 0, y: 0 }, forma: "aperto" as const, boca: "onda", corpo: { sx: 1, sy: 0.97, rotate: -3 } }
      : humor === "irritado"
        ? { ...BASE, alvo: { x: -0.8, y: 0.1 }, palpebra: 0.22, olhoBaixo: 0.75, boca: "o", bocaEscala: 0.55, bocaX: -1.5, bravaEsq: detalhe, bravaDir: detalhe, olhoTilt: -3, corpo: { sx: 1.04, sy: 0.95, rotate: -3 } }
        : humor === "timida"
          ? { ...BASE, forma: "arco" as const, boca: "sorriso", bochecha: 0.8, corpo: { sx: 1.03, sy: 0.95, rotate: 0 } }
          : humor === "cochilo"
            ? { ...BASE, alvo: { x: 0, y: 0.35 }, forma: "fenda" as const, boca: "o", bocaEscala: 0.6, olhoTilt: 6, corpo: { sx: 1, sy: 0.96, rotate: -2 } }
            : poseDe(efetivo, momento, detalhe);

  const olhar = useOlhar(ref, {
    seguir: seguirCursor,
    alvo: pose.alvo,
    varrer: efetivo === "escrevendo",
    pensar: efetivo === "consultando",
    reduzido,
  });
  const abertura = usePiscar({
    // sono suspende a piscada: o olho já é uma fenda, não tem o que fechar
    ativo: pose.forma === "oval" && efetivo !== "sonolento" && humor !== "cochilo",
    reduzido,
    lento: efetivo === "consultando",
    gatilho: `${efetivo}:${humor}`,
  });
  const tagarela = useTagarelar(detalhe && pose.boca === "falando", reduzido);
  const inclina = useAlvoMola(efetivo === "atento" ? 1 : 0, reduzido);

  // os olhos crescem na proporção do rosto conforme a mascote encolhe —
  // abaixo de 64px eles interpolam até as medidas do mini (as do <28),
  // senão o FAB do celular (44) e o header (34) liam como pontinhos.
  // k: 0 aos 28px (medidas do mini) → 1 aos 64px+ (medidas cheias)
  const kOlho = Math.min(1, Math.max(0, (tamanho - 28) / 36));
  // olhos ~17% maiores que a primeira versão (feedback de design: a
  // expressão era genérica) e mais ~15% na escala cheia: com o olho menor o
  // disco sobrava embaixo e a Liza lia como gordinha. No mini continuam
  // legíveis sem encostar um no outro
  const olhoDims = detalhe
    ? {
        rx: 12.8 - 0.7 * kOlho,
        ry: 15.8 - 1 * kOlho,
        cy: 48.5 - 3 * kOlho,
        dx: 19 - 0.4 * kOlho,
      }
    : { rx: 12.8, ry: 15.8, cy: 48.5, dx: 19 };
  // cílios em todas as escalas: acima de 40 o par fino; abaixo, um traço
  // só mais grosso — o par fino lia como borrão no header (34) e nos
  // avatares da conversa (22/24)
  const ciliosMini = tamanho < 40;
  // o olho inteiro viaja no rosto (raio) e o reflexo faz um contra-movimento
  // (hx) — o clássico de mascote; a boca anda ~metade: o rosto "vira" em 3D
  const raio = detalhe ? { x: 8, y: 6 } : { x: 5.5, y: 4.5 };
  const ox = useTransform(olhar.x, (v) => v * raio.x);
  const oy = useTransform(olhar.y, (v) => v * raio.y);
  const bx = useTransform(olhar.x, (v) => v * raio.x * 0.55);
  const by = useTransform(olhar.y, (v) => v * raio.y * 0.45);
  // no hover o corpo inteiro tomba pro lado do cursor, pivotando na base
  const tomba = useTransform([olhar.x, inclina], ([g, k]: number[]) => g * k * 6);
  const hx = useTransform(olhar.x, (v) => v * -1.2);

  const transicao: Transition = reduzido ? REDUZIDA : efetivo === "atento" || humor !== "neutro" ? MOLA_RAPIDA : MOLA;

  const { corpo, corpoT } = movimentoDoCorpo({
    efetivo,
    momento,
    festa,
    humor,
    reduzido,
    pose,
    transicao,
    tamanho,
  });

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 100 100"
      width={tamanho}
      height={tamanho}
      overflow="visible"
      aria-hidden
      focusable="false"
      // size-auto: dentro de um Button do kit, o `[&_svg]:size-4` que
      // padroniza ícone espremeria a mascote pra 16px (FAB mobile lia como
      // olhinhos). auto devolve o tamanho pro atributo `width`/`height`
      className={cn("size-auto", className)}
      // fill-box + %: a referência é a própria caixa do svg — o squash
      // ancora na base em QUALQUER tamanho (view-box no svg raiz media em
      // px do viewport e arrastava a criatura no clique)
      style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
      // bichinho: ser encarado cansa, ser cutucado irrita — nos contextos em
      // que o svg recebe ponteiro (vitrine, header, avatar, FAB)
      onPointerEnter={entrar}
      onPointerLeave={sair}
      onPointerDown={tocar}
      // achatamento no toque fica — é a criatura sendo apertada, não botão
      whileTap={reduzido ? undefined : { scaleX: 1.14, scaleY: 0.8 }}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={CORPO} />
        </clipPath>
      </defs>

      <motion.g style={{ rotate: tomba, transformBox: "view-box", transformOrigin: "50px 100px" }}>
        <motion.g
          initial={false}
          animate={corpo}
          transition={corpoT}
          style={{ transformBox: "view-box", transformOrigin: "50px 100px" }}
        >
          <g fill={LIMA}>
            <path d={CORPO} />
            <g clipPath={`url(#${clipId})`}>
              {([-1, 1] as const).map((lado) => (
                <Olho
                  key={lado}
                  lado={lado}
                  cx={50 + lado * olhoDims.dx}
                  cy={olhoDims.cy}
                  rx={olhoDims.rx}
                  ry={olhoDims.ry}
                  pose={pose}
                  ox={ox}
                  oy={oy}
                  hx={hx}
                  abertura={abertura}
                  transicao={transicao}
                  detalhe={detalhe}
                  ciliosMini={ciliosMini}
                />
              ))}
              {/* bochechas rosadas sob os cantos externos dos olhos */}
              {([-1, 1] as const).map((lado) => (
                <motion.ellipse
                  key={`bochecha-${lado}`}
                  cx={50 + lado * (olhoDims.dx + 7.5)}
                  cy={olhoDims.cy + olhoDims.ry + 4.5}
                  rx={detalhe ? 4.4 : 5.2}
                  ry={detalhe ? 2.4 : 2.8}
                  fill="hsl(4 72% 62%)"
                  initial={false}
                  animate={{ opacity: pose.bochecha }}
                  transition={{ opacity: { duration: 0.3, ease: EASE }, default: transicao }}
                />
              ))}
            {detalhe && (efetivo !== "parado" || BOCA_NO_PARADO) && (
              <motion.g style={{ x: bx, y: by }}>
                <g transform="translate(50 63)">
                  <BocaForma ativa={pose.boca === "sorriso"} transicao={transicao} escala={pose.bocaEscala}>
                    <path d="M-4.2 -1.2Q0 2.8 4.2 -1.2" fill="none" stroke={TINTA} strokeWidth={2.6} strokeLinecap="round" />
                  </BocaForma>
                  <BocaForma
                    ativa={pose.boca === "o"}
                    transicao={transicao}
                    escala={pose.bocaEscala}
                    x={pose.bocaX}
                  >
                    <ellipse cx={0} cy={0.4} rx={2.5} ry={2.3} fill={TINTA} />
                  </BocaForma>
                  <BocaForma ativa={pose.boca === "aberta"} transicao={transicao}>
                    <path d="M-5.6 -1.6Q0 -2.4 5.6 -1.6Q5.2 5.6 0 5.8Q-5.2 5.6 -5.6 -1.6Z" fill={TINTA} />
                  </BocaForma>
                  <BocaForma ativa={pose.boca === "falando"} transicao={transicao}>
                    {/* tagarela: a boquinha abre e fecha em sílabas —
                        amplitude irregular pra não parecer metrônomo */}
                    <motion.ellipse
                      cx={0}
                      cy={0.6}
                      rx={2.9}
                      ry={2.7}
                      style={{ scaleY: tagarela, transformBox: "fill-box", transformOrigin: "center" }}
                      fill={TINTA}
                    />
                  </BocaForma>
                  <BocaForma ativa={pose.boca === "reta"} transicao={transicao}>
                    <path d="M-3 0.4H3" fill="none" stroke={TINTA} strokeWidth={2.6} strokeLinecap="round" />
                  </BocaForma>
                  <BocaForma ativa={pose.boca === "onda"} transicao={transicao}>
                    <path
                      d="M-4.6 0.8Q-2.3 -1.4 0 0.8T4.6 0.8"
                      fill="none"
                      stroke={TINTA}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </BocaForma>
                  <BocaForma ativa={pose.boca === "triste"} transicao={transicao}>
                    <path d="M-3.8 1.6Q0 -1.4 3.8 1.6" fill="none" stroke={TINTA} strokeWidth={2.6} strokeLinecap="round" />
                  </BocaForma>
                </g>
              </motion.g>
            )}
          </g>
          </g>

          {/* "zZ" do sono: dois zetas subindo alternados acima da
              cabeça — maior e menor, em contra-tempo. Serve o cochilo
              (afago longo) e o estado sonolento */}
          {detalhe && (humor === "cochilo" || efetivo === "sonolento") && (
            <>
              <motion.g
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{ opacity: [0, 0.85, 0.85, 0], y: [0, -10, -22, -22], x: [0, 3, 6, 6] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeOut" }}
              >
                <path
                  d="M0 0L9 0L0 9L9 9"
                  transform="translate(78 -2)"
                  fill="none"
                  stroke="var(--foreground)"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.g>
              <motion.g
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{ opacity: [0, 0.7, 0.7, 0], y: [0, -8, -17, -17], x: [0, 2, 4, 4] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeOut", delay: 1.4 }}
              >
                <path
                  d="M0 0L6 0L0 6L6 6"
                  transform="translate(90 -6)"
                  fill="none"
                  stroke="var(--foreground)"
                  strokeWidth={2.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.g>
            </>
          )}
        </motion.g>
      </motion.g>
    </motion.svg>
  );
}

function BocaForma({
  ativa,
  transicao,
  escala = 1,
  x = 0,
  children,
}: {
  ativa: boolean;
  transicao: Transition;
  escala?: number;
  x?: number;
  children: ReactNode;
}) {
  return (
    <motion.g
      initial={false}
      animate={{ opacity: ativa ? 1 : 0, scale: ativa ? escala : escala * 0.6, x }}
      transition={{ default: transicao, opacity: FADE }}
    >
      {children}
    </motion.g>
  );
}

/** o olho não é uma elipse fixa: duas cúbicas (topo/base) deixam cada
 *  expressão morfar o formato — base entrando na tagarelice, topo caindo
 *  em curva no sono. Cúbica, não quadrática: a
 *  tangente nas laterais é vertical, então as pontas ficam redondas
 *  (a versão com Q saía em cúspide e lia como losango). A estrutura do
 *  path é sempre a mesma pra transição interpolar os números */
const olhoPath = (rx: number, ry: number, topo: number, baixo: number) =>
  `M ${-rx} 0C${-rx} ${-ry * 1.333 * topo} ${rx} ${-ry * 1.333 * topo} ${rx} 0C${rx} ${ry * 1.333 * baixo} ${-rx} ${ry * 1.333 * baixo} ${-rx} 0Z`;

function Olho({
  lado,
  cx,
  cy,
  rx,
  ry,
  pose,
  ox,
  oy,
  hx,
  abertura,
  transicao,
  detalhe,
  ciliosMini,
}: {
  lado: -1 | 1;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  pose: Pose;
  ox: MotionValue<number>;
  oy: MotionValue<number>;
  hx: MotionValue<number>;
  abertura: MotionValue<number>;
  transicao: Transition;
  detalhe: boolean;
  ciliosMini: boolean;
}) {
  const oval = pose.forma === "oval";
  const arco = pose.forma === "arco";
  const aperto = pose.forma === "aperto";
  const fenda = pose.forma === "fenda";
  const h = ry * 2;
  // assimetria por lado: cético (🤨) tem sobrancelhas em direções
  // opostas e a pálpebra de cima descendo só num olho
  const topo = lado === 1 ? pose.topoDir : pose.olhoTopo;
  const sobrancelha = lado === -1 ? pose.sobrancelhaEsq : pose.sobrancelhaDir;
  const brava = lado === -1 ? pose.bravaEsq : pose.bravaDir;

  // cílios: dois traços curtos no canto externo superior, na raiz do
  // contorno do olho (pontos da cúbica do topo em t≈0,85 e t≈0,75). Quando a
  // pálpebra desce além da raiz, eles montam na borda dela — é a pálpebra
  // que carrega os cílios. Seguem a escala do oval à mão (o grupo de escala
  // do olho ancora no centro do próprio desenho, não no deles)
  const palp = detalhe ? pose.palpebra : -1;
  const borda = (fator: number) => -fator * ry + 2 * ry * palp;
  const r1x = lado * 0.88 * rx * pose.sx;
  const r1y = Math.max(-0.51 * ry * topo * pose.sy, borda(0.86));
  const r2x = lado * 0.69 * rx * pose.sx;
  const r2y = Math.max(-0.75 * ry * topo * pose.sy, borda(0.85));
  const cilio1 = `M${r1x} ${r1y}q${lado * 1.5} ${-1.5} ${lado * 3.8} ${-1.3}`;
  const cilio2 = `M${r2x} ${r2y}q${lado * 1.1} ${-1.8} ${lado * 2.8} ${-2.4}`;
  // na piscada eles somem junto (o olho achata em ~120ms; um traço
  // flutuando sem olho embaixo leria como sujeira)
  const ciliosVisiveis = useTransform(abertura, (v) =>
    Math.min(1, Math.max(0, (v - 0.35) / 0.5)),
  );

  return (
    <motion.g style={{ x: ox, y: oy }}>
      <g transform={`translate(${cx} ${cy})`}>
        {/* inclinação da expressão: o canto interno pende no sono e na
            raiva — fill-box ancora o giro no próprio olho */}
        <motion.g
          initial={false}
          animate={{ rotate: lado * pose.olhoTilt }}
          transition={transicao}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
        <motion.g
          initial={false}
          animate={{ scaleX: oval ? pose.sx : 0.8, scaleY: oval ? pose.sy : 0.25, opacity: oval ? 1 : 0 }}
          transition={{ default: transicao, opacity: FADE }}
        >
          <motion.g style={{ scaleY: abertura, transformOrigin: "50% 60%" }}>
            <motion.path
              initial={false}
              animate={{ d: olhoPath(rx, ry, topo, pose.olhoBaixo) }}
              transition={transicao}
              fill={TINTA}
            />
            {/* brilho em TODOS os tamanhos — o olho fica vivo até no mini.
                pálpebra baixa: o brilho encolhe e desce pra continuar
                dentro da tinta (pálpebra muito baixa → some) */}
            <motion.g
              style={{ x: hx, transformBox: "fill-box", transformOrigin: "center" }}
              initial={false}
              animate={{
                opacity: pose.forma === "oval" && topo >= 0.35 ? 1 : 0,
                y: topo < 0.75 ? ry * 0.15 : 0,
                scale: topo < 0.75 ? 0.82 : 1,
              }}
              transition={{ opacity: FADE, default: transicao }}
            >
              <circle cx={rx * 0.34} cy={-ry * 0.4} r={rx * 0.36} fill="#fff" />
              <motion.circle
                cx={-rx * 0.3}
                cy={ry * 0.32}
                r={rx * 0.2}
                fill="#fff"
                initial={false}
                animate={{ opacity: pose.brilhoExtra ? 0.9 : 0 }}
                transition={FADE}
              />
            </motion.g>
          </motion.g>
        </motion.g>

        {detalhe && (
          <motion.g
            initial={false}
            animate={{ y: pose.palpebra * h }}
            transition={transicao}
            style={{ transformOrigin: "50% 100%" }}
          >
            {/* a pálpebra herda o fill do grupo do corpo; a borda é curva
                (desce no meio), não um corte reto — ao baixar ela abraça o
                olho como pálpebra de verdade */}
            <path
              d={`M${-rx * 2} ${-ry - 16}H${rx * 2}V${-ry}Q0 ${-ry * 0.65} ${-rx * 2} ${-ry}Z`}
            />
          </motion.g>
        )}

      {/* cílios: o par no detalhe; nas escalas pequenas um traço só mais
          grosso (o segundo lia como borrão) */}
      <motion.g
        initial={false}
        animate={{ opacity: oval ? 1 : 0 }}
        transition={{ opacity: FADE }}
      >
        <motion.g style={{ opacity: ciliosVisiveis }}>
          <motion.path
            initial={false}
            animate={{ d: cilio1 }}
            transition={transicao}
            fill="none"
            stroke={TINTA}
            strokeWidth={ciliosMini ? 2.7 : 1.9}
            strokeLinecap="round"
          />
          {!ciliosMini && (
            <motion.path
              initial={false}
              animate={{ d: cilio2 }}
              transition={transicao}
              fill="none"
              stroke={TINTA}
              strokeWidth={1.7}
              strokeLinecap="round"
            />
          )}
        </motion.g>
      </motion.g>

      {/* sobrancelha aflita: canto interno pra cima (só no erro) */}
      {detalhe && (
        <motion.g
          initial={false}
          animate={{ opacity: sobrancelha ? 1 : 0, y: sobrancelha ? 0 : 2 }}
          transition={{ default: transicao, opacity: FADE }}
        >
          <path
            d={`M${lado * 5} ${-ry - 3}L${-lado * 4.2} ${-ry - 6.4}`}
            fill="none"
            stroke={TINTA}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </motion.g>
      )}

      {/* sobrancelha brava: canto interno pra baixo (irritado de bichinho) */}
      {detalhe && (
        <motion.g
          initial={false}
          animate={{ opacity: brava ? 1 : 0, y: brava ? 0 : -2 }}
          transition={{ default: transicao, opacity: FADE }}
        >
          <path
            d={`M${lado * 5} ${-ry - 6.8}L${-lado * 4.2} ${-ry - 3}`}
            fill="none"
            stroke={TINTA}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </motion.g>
      )}

      {/* felicidade: olho vira um arco ^ */}
      <motion.g
        initial={false}
        animate={{ opacity: arco ? 1 : 0, y: arco ? 0 : 3, scale: arco ? 1 : 0.8 }}
        transition={{ default: transicao, opacity: FADE }}
      >
        <path
          d={`M${-rx * 1.2} ${ry * 0.15}Q0 ${-ry * 0.95} ${rx * 1.2} ${ry * 0.15}`}
          fill="none"
          stroke={TINTA}
          strokeWidth={detalhe ? 4.4 : 6}
          strokeLinecap="round"
        />
      </motion.g>

      {/* tonto: olhos apertados > < apontando pro nariz — o "ai" de quem
          levou um susto, lê em qualquer tamanho e não gira sem parar */}
      <motion.g
        initial={false}
        animate={{ opacity: aperto ? 1 : 0, scaleX: aperto ? 1 : 0.6 }}
        transition={{ default: transicao, opacity: FADE }}
      >
        <path
          d={`M${lado * rx * 0.75} ${-ry * 0.5}L${-lado * rx * 0.55} 0L${lado * rx * 0.75} ${ry * 0.5}`}
          fill="none"
          stroke={TINTA}
          strokeWidth={detalhe ? 4 : 5.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>

      {/* sono: olho fechado = uma curva de pontas arredondadas que pende
          suavemente pro meio — preenchido lia como raiva, linha lê sono */}
      <motion.g
        initial={false}
        animate={{ opacity: fenda ? 1 : 0, y: fenda ? 0 : 3 }}
        transition={{ default: transicao, opacity: FADE }}
      >
        <path
          d={`M${-rx * 0.8} ${ry * 0.1}Q0 ${ry * 0.85} ${rx * 0.8} ${ry * 0.1}`}
          fill="none"
          stroke={TINTA}
          strokeWidth={detalhe ? 4.4 : 5.8}
          strokeLinecap="round"
        />
      </motion.g>
        </motion.g>
      </g>
    </motion.g>
  );
}
