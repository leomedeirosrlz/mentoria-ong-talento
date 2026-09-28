import { hashSeed, rand } from "@/lib/banner";
import type { AppRole } from "@/lib/types";

/** O papel que o banner anuncia — "mentorado" não é AppRole (tabela própria),
 *  mas na ficha é a quinta identidade visual. */
export type PapelBanner = AppRole | "mentorado" | null;

const INK = "var(--brand-ink)";
const LIME = "var(--brand-lime)";
const AMARELO = "var(--role-mentorado)";

/** Campo × tinta × texto por papel — campo ink pra todo mundo (o banner é
 *  a faixa escura da marca); o papel mora na marca do canto e no matiz
 *  sutil da `tinta`, que colore os relevos e o nome fantasma. `texto` é a
 *  linha de dados. */
const CAMPO: Record<
  NonNullable<PapelBanner> | "none",
  { bg: string; tinta: string; texto: string }
> = {
  coordenacao: { bg: INK, tinta: LIME, texto: "hsl(0 0% 100% / 0.9)" },
  supervisor: { bg: INK, tinta: "hsl(0 0% 100%)", texto: "hsl(0 0% 100% / 0.9)" },
  mentor_dpp: { bg: INK, tinta: LIME, texto: "hsl(0 0% 100% / 0.9)" },
  mentor_especialista: { bg: INK, tinta: LIME, texto: "hsl(0 0% 100% / 0.9)" },
  mentorado: { bg: INK, tinta: AMARELO, texto: "hsl(0 0% 100% / 0.9)" },
  none: { bg: INK, tinta: "hsl(0 0% 100%)", texto: "hsl(0 0% 100% / 0.9)" },
};

/** A marca de papel — mesma composição pra todo mundo do papel (é o
 *  "brasão", estável); a variação por pessoa fica no relevo seedado. Uma
 *  gramática só pra todos: motivo de traço fino + um ponto pequeno cheio
 *  (eco do "." amarelo do logo), nunca discos sólidos grandes — traço lê
 *  como selo, bola lê como ornamento solto. A âncora é a borda direita:
 *  o slice do viewBox corta topo/base conforme a largura, mas a direita
 *  está sempre à vista, então cada motivo sangra por ela e mantém o
 *  miolo na faixa vertical central. */
function MarcaPapel({ papel }: { papel: PapelBanner }) {
  switch (papel) {
    case "coordenacao":
      // alvo no canto — coordenação é a origem, o ponto de onde o programa
      // parte: anéis concêntricos + ponto cheio no centro
      return (
        <g opacity={0.85}>
          <circle
            cx={770}
            cy={72}
            r={54}
            fill="none"
            stroke={LIME}
            strokeWidth={2}
            strokeOpacity={0.45}
          />
          <circle
            cx={770}
            cy={72}
            r={35}
            fill="none"
            stroke={LIME}
            strokeWidth={2.5}
          />
          <circle cx={770} cy={72} r={7} fill={LIME} />
        </g>
      );
    case "supervisor":
      // duas órbitas encadeadas — supervisão acompanha a dupla de fora:
      // um anel lime maior cruzado por um anel amarelo menor
      return (
        <g fill="none" strokeWidth={2} opacity={0.85}>
          <circle cx={712} cy={52} r={46} stroke={LIME} />
          <circle cx={776} cy={90} r={34} stroke={AMARELO} />
        </g>
      );
    case "mentor_dpp":
      // o próprio logo em traço — anel lime + o "." amarelo pousado no
      // traço: a dupla é o encontro dos dois
      return (
        <g opacity={0.85}>
          <circle
            cx={764}
            cy={74}
            r={50}
            fill="none"
            stroke={LIME}
            strokeWidth={2.5}
          />
          <circle cx={729} cy={109} r={8} fill={AMARELO} />
        </g>
      );
    case "mentor_especialista":
      // 5 barras ascendentes — a trilha de 5 passos do especialista,
      // enraizadas na borda inferior
      return (
        <g fill={LIME} opacity={0.5}>
          {[34, 56, 78, 100, 122].map((h, i) => (
            <rect
              key={i}
              x={682 + i * 28}
              y={162 - h}
              width={14}
              height={h}
              rx={2}
            />
          ))}
        </g>
      );
    case "mentorado":
      // arco tracejado + ponto lime — a trilha aberta que a dupla desenha;
      // o ponto do mentor marca o caminho
      return (
        <g opacity={0.8}>
          <circle
            cx={748}
            cy={64}
            r={56}
            fill="none"
            stroke={AMARELO}
            strokeWidth={2}
            strokeDasharray="3 9"
            strokeLinecap="round"
          />
          <circle cx={708} cy={104} r={7} fill={LIME} />
        </g>
      );
    default:
      return null;
  }
}

/** Banner generativo da ficha — decorativo (aria-hidden): papel, nome e
 *  cidade já aparecem como texto real no header. Três camadas sobre o
 *  campo ink:
 *
 *  - relevo: arcos concêntricos com centro e raios seedados pelo id — a
 *    impressão digital estável da pessoa, traço a 13% na cor do papel;
 *  - nome fantasma: o primeiro nome gigante a 10%, baseline sangrando na
 *    borda inferior — a marca d'água pessoal;
 *  - marca de papel: glifo no canto superior direito nas cores do papel;
 *  - linha de dados: mono uppercase no canto superior esquerdo (o canto
 *    inferior esquerdo é do avatar que sobrepõe o banner).
 *
 *  viewBox fixo + slice: nos estreitos o SVG corta os lados em vez de
 *  espremer — por isso a linha de dados é HTML por cima, não texto do SVG. */
export function PessoaBanner({
  papel,
  nome,
  cidade,
  uf,
  areas,
  seed,
}: {
  papel: PapelBanner;
  /** nome completo — o ghost usa só o primeiro. */
  nome: string;
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

  // nome fantasma — só o primeiro, gigante; a fonte encolhe conforme o
  // comprimento pra sempre sangrar as laterais; baseline abaixo do viewBox
  // = letra cortada
  const nomeUp = nome.split(" ")[0]?.toUpperCase() ?? null;
  const ghostSize = nomeUp
    ? Math.max(48, Math.min(170, Math.round(860 / (nomeUp.length * 0.62))))
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
        {nomeUp && (
          // nome fantasma — texto preenchido de baixa opacidade na cor do
          // papel (marca d'água pessoal)
          <text
            x={400}
            y={168}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontWeight={700}
            fontSize={ghostSize}
            letterSpacing="-0.02em"
            fill={cfg.tinta}
            fillOpacity={0.12}
          >
            {nomeUp}
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
