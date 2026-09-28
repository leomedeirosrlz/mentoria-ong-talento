import { hashSeed, rand } from "@/lib/banner";
import type { AppRole } from "@/lib/types";

/** O papel que o banner anuncia — "mentorado" não é AppRole (tabela própria),
 *  mas na ficha é a quinta identidade visual. */
export type PapelBanner = AppRole | "mentorado" | null;

const INK = "var(--brand-ink)";
const LIME = "var(--brand-lime)";
const AMARELO = "var(--role-mentorado)";

/** Campo × tinta × texto por papel — o banner diz o papel antes de qualquer
 *  leitura: ink pros papéis internos (coordenação, supervisão), lime pros
 *  mentores, amarelo pro mentorado (as cores do logo, trocando quem é campo
 *  e quem é marca). `tinta` é a cor dos relevos e do ghost — a "gravura" do
 *  campo; `texto` é a linha de dados. */
const CAMPO: Record<
  NonNullable<PapelBanner> | "none",
  { bg: string; tinta: string; texto: string }
> = {
  coordenacao: { bg: INK, tinta: LIME, texto: "hsl(0 0% 100% / 0.9)" },
  supervisor: {
    bg: INK,
    tinta: "hsl(0 0% 100%)",
    texto: "hsl(0 0% 100% / 0.9)",
  },
  mentor_dpp: { bg: LIME, tinta: INK, texto: "hsl(0 0% 15% / 0.9)" },
  mentor_especialista: {
    bg: LIME,
    tinta: INK,
    texto: "hsl(0 0% 15% / 0.9)",
  },
  mentorado: { bg: AMARELO, tinta: INK, texto: "hsl(0 0% 15% / 0.9)" },
  none: {
    bg: "var(--muted)",
    tinta: "var(--muted-foreground)",
    texto: "var(--muted-foreground)",
  },
};

/** A marca de papel — mesma composição pra todo mundo do papel (é o
 *  "brasão", estável); a variação por pessoa fica no relevo seedado. Tudo
 *  encosta na borda direita: a marca sangra pra fora do banner. */
function MarcaPapel({ papel }: { papel: PapelBanner }) {
  switch (papel) {
    case "coordenacao":
      // disco lime sólido sangrando no canto superior direito — o ponto do
      // logo ampliado (coordenação é a origem do programa)
      return <circle cx={738} cy={-14} r={96} fill={LIME} />;
    case "supervisor":
      // dois anéis vazados sobrepostos — supervisão é órbita: quem acompanha
      // sem estar dentro da dupla
      return (
        <>
          <circle
            cx={708}
            cy={32}
            r={56}
            fill="none"
            stroke={LIME}
            strokeWidth={2}
          />
          <circle
            cx={778}
            cy={88}
            r={42}
            fill="none"
            stroke={AMARELO}
            strokeWidth={2}
          />
        </>
      );
    case "mentor_dpp":
      // disco ink + ponto amarelo ~30% de overlap — o próprio logo
      return (
        <>
          <circle cx={682} cy={44} r={58} fill={INK} />
          <circle cx={733} cy={85} r={17} fill={AMARELO} />
        </>
      );
    case "mentor_especialista":
      // 5 barras ascendentes — a trilha de 5 passos do especialista
      return (
        <g fill={INK} opacity={0.25}>
          {[36, 58, 80, 102, 124].map((h, i) => (
            <rect key={i} x={642 + i * 29} y={164 - h} width={17} height={h} />
          ))}
        </g>
      );
    case "mentorado":
      // arco tracejado + ponto lime — caminho aberto, a trilha que se desenha
      return (
        <>
          <circle
            cx={700}
            cy={58}
            r={76}
            fill="none"
            stroke={INK}
            strokeOpacity={0.5}
            strokeWidth={1.5}
            strokeDasharray="2 7"
            strokeLinecap="round"
          />
          <circle cx={736} cy={125} r={9} fill={LIME} />
        </>
      );
    default:
      return null;
  }
}

/** Banner generativo da ficha — decorativo (aria-hidden): papel, cidade e
 *  áreas já aparecem como texto real no header. Três camadas:
 *
 *  - campo: a cor do papel;
 *  - relevo: arcos concêntricos com centro e raios seedados pelo id — a
 *    impressão digital estável da pessoa, só traço a 13%;
 *  - território: a cidade em ghost outline gigante, baseline sangrando na
 *    borda inferior;
 *  - linha de dados: mono uppercase no canto superior esquerdo (o canto
 *    inferior esquerdo é do avatar que sobrepõe o banner).
 *
 *  viewBox fixo + slice: nos estreitos o SVG corta os lados em vez de
 *  espremer — por isso a linha de dados é HTML por cima, não texto do SVG. */
export function PessoaBanner({
  papel,
  cidade,
  uf,
  areas,
  seed,
}: {
  papel: PapelBanner;
  cidade?: string | null;
  uf?: string | null;
  /** áreas de atuação (ou interesses) — entram até 3 na linha de dados. */
  areas?: string[];
  /** âncora do relevo — o id da pessoa: estável por definição. */
  seed: string;
}) {
  const cfg = CAMPO[papel ?? "none"];
  const r = rand(hashSeed(seed));

  // relevo — 6 a 8 arcos concêntricos num centro sorteado (a "marca d'água"
  // da pessoa); raio cresce com jitter pra não virar alvo perfeito
  const cx = 110 + r() * 560;
  const cy = -24 + r() * 190;
  const arcos: number[] = [];
  let raio = 24 + r() * 34;
  for (let i = 0, n = 6 + Math.floor(r() * 3); i < n; i++) {
    arcos.push(raio);
    raio += 22 + r() * 28;
  }

  // território — a fonte encolhe conforme o comprimento pra sempre sangrar
  // as duas laterais (ou quase); baseline abaixo do viewBox = letra cortada
  const cidadeUp = cidade?.toUpperCase() ?? null;
  const ghostSize = cidadeUp
    ? Math.max(40, Math.min(152, Math.round(860 / (cidadeUp.length * 0.62))))
    : 0;

  const dados = [cidade, uf, ...(areas ?? []).slice(0, 3)]
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();

  return (
    <div aria-hidden className="relative h-28 w-full sm:h-36">
      <svg
        viewBox="0 0 800 160"
        preserveAspectRatio="xMidYMid slice"
        className="block h-full w-full"
      >
        <rect width={800} height={160} fill={cfg.bg} />
        <g fill="none" stroke={cfg.tinta} strokeOpacity={0.13}>
          {arcos.map((raio) => (
            <circle key={raio} cx={cx} cy={cy} r={raio} />
          ))}
        </g>
        {cidadeUp && (
          // ghost = texto PREENCHIDO de baixa opacidade (marca d'água) —
          // stroke-only em corpo gigante renderizava caixas ocas quebradas
          <text
            x={400}
            y={168}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontWeight={700}
            fontSize={ghostSize}
            letterSpacing="-0.02em"
            fill={cfg.tinta}
            fillOpacity={0.1}
          >
            {cidadeUp}
          </text>
        )}
        <MarcaPapel papel={papel} />
      </svg>
      {dados && (
        <p
          className="absolute top-2.5 left-4 max-w-[calc(100%-2rem)] truncate font-mono text-[11px] uppercase tracking-[0.12em] sm:left-6"
          style={{ color: cfg.texto }}
        >
          {dados}
        </p>
      )}
    </div>
  );
}
