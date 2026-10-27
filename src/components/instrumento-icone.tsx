import type { CSSProperties, ReactNode } from "react";
import type { FormularioSistema } from "@/lib/forms/schema";
import type { EstacaoChave } from "@/lib/jornada";
import { cn } from "@/lib/utils";

// Identidade visual dos instrumentos oficiais do programa (spec v5c de
// /materiais + formularios.md item 2): um símbolo SVG e um par cor/tinta
// por instrumento, usados onde o instrumento aparece — seção
// "Instrumentos do programa", ficha da dupla, painel jornada, /formularios.
// Os 8 glifos da régua DPP são os símbolos do sprite do mockup v5c
// (traço 1.7, viewBox 24); os sistemas fora da régua (avaliação da trilha,
// intakes, desfecho) receberam glifo próprio na mesma gramática. A cor mora em tokens --inst-* (globals.css) — o ícone
// tinge a si mesmo, o card aplica --ic/--ict via instrumentoVars().
//
// Server-safe de propósito (nada de hooks): serve nas páginas RSC e nos
// componentes client que o importarem.

/** Chave de um instrumento oficial: as 7 estações da jornada DPP
 *  (jornada.ts), os sistemas de formulário (schema.ts — inclui os
 *  fora-de-régua) e "avaliacao_terceiros" (0103 — instrumento real do
 *  programa que não é formulário `sistema`). Record<> completo embaixo
 *  força cor+glifo pra toda chave nova que entrar nos enums. */
export type InstrumentoChave =
  | EstacaoChave
  | FormularioSistema
  | "avaliacao_terceiros";

/** Par cor/tinta do instrumento — referências aos tokens --inst-*.
 *  `cor` = traço do símbolo (e borda/acento do card); `tinta` = fundo do
 *  emblema (o `.ig` do v5c). */
export const INSTRUMENTO_TOM: Record<
  InstrumentoChave,
  { cor: string; tinta: string }
> = {
  roda_inicial: { cor: "var(--inst-roda)", tinta: "var(--inst-roda-t)" },
  roda_vida: { cor: "var(--inst-roda)", tinta: "var(--inst-roda-t)" },
  roda_formal: {
    cor: "var(--inst-roda-formal)",
    tinta: "var(--inst-roda-formal-t)",
  },
  visao: { cor: "var(--inst-visao)", tinta: "var(--inst-visao-t)" },
  metas: { cor: "var(--inst-metas)", tinta: "var(--inst-metas-t)" },
  pdm: { cor: "var(--inst-pdm)", tinta: "var(--inst-pdm-t)" },
  avaliacao_terceiros: {
    cor: "var(--inst-terceiros)",
    tinta: "var(--inst-terceiros-t)",
  },
  avaliacao_encontro: {
    cor: "var(--inst-avaliacao)",
    tinta: "var(--inst-avaliacao-t)",
  },
  avaliacao_360: { cor: "var(--inst-360)", tinta: "var(--inst-360-t)" },
  avaliacao_especialista: {
    cor: "var(--inst-avaliacao-especialista)",
    tinta: "var(--inst-avaliacao-especialista-t)",
  },
  intake_mentor: {
    cor: "var(--inst-intake-mentor)",
    tinta: "var(--inst-intake-mentor-t)",
  },
  intake_mentorado: {
    cor: "var(--inst-intake-mentorado)",
    tinta: "var(--inst-intake-mentorado-t)",
  },
  desfecho: {
    cor: "var(--inst-desfecho)",
    tinta: "var(--inst-desfecho-t)",
  },
};

/** Estreita `sistema` solto do banco (string) pra chave conhecida —
 *  cobre o caso `sistema: string | null` do database.types sem cast. */
export function ehInstrumentoChave(v: unknown): v is InstrumentoChave {
  return typeof v === "string" && v in INSTRUMENTO_TOM;
}

/** O par --ic/--ict do card-produto do v5c — espalha no `style` do card:
 *  `style={instrumentoVars("metas")}` acende borda/hover na cor do
 *  instrumento sem escrever var solta no markup. */
export function instrumentoVars(chave: InstrumentoChave): CSSProperties {
  const t = INSTRUMENTO_TOM[chave];
  return { "--ic": t.cor, "--ict": t.tinta } as CSSProperties;
}

// ---------- glifos (viewBox 24, traço 1.7 round — gramática do sprite v5c) ----------

const RODA = (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="1.6" />
    <path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" />
  </>
);

const GLIFO: Record<InstrumentoChave, ReactNode> = {
  // i-roda — a roda das 16 áreas (leitura inicial e o form roda_vida)
  roda_inicial: RODA,
  roda_vida: RODA,
  // i-rodaf — a mesma roda com os chevrons do antes × depois
  roda_formal: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M12 3.5v17M3.5 12h17" />
      <path d="M8.5 9.5 6 12l2.5 2.5M15.5 9.5 18 12l-2.5 2.5" />
    </>
  ),
  // i-visao — a bússola do "filme da vida ideal"
  visao: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m14.8 9.2-2 5.6-5.6 2 2-5.6z" />
      <path d="M12 3.5v1.6M20.5 12h-1.6" />
    </>
  ),
  // i-metas — alvo concêntrico
  metas: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
  // i-pdm — caminho pontilhado entre o ponto de partida e a meta
  pdm: (
    <>
      <circle cx="5.5" cy="18.5" r="2.2" />
      <circle cx="18.5" cy="5.5" r="2.2" />
      <path
        d="M6.8 16.3c4.6-.5 2.4-6.4 8.6-7.9"
        strokeDasharray="3 2.6"
      />
      <path d="M18.5 3.5v4M18.5 5.5h4" opacity=".5" />
    </>
  ),
  // i-terc — a pessoa + o balão das respostas de terceiros (0103)
  avaliacao_terceiros: (
    <>
      <circle cx="8" cy="8.5" r="3" />
      <path d="M2.8 19.5c.5-3.2 2.7-4.8 5.2-4.8s4.7 1.6 5.2 4.8" />
      <path
        d="M15 3.8h6.5v6.3l-3-.9-1.5.9v-2.6l-2-.6z"
        fill="none"
      />
    </>
  ),
  // i-aval — a estrela da nota 1–5 pós-encontro
  avaliacao_encontro: (
    <path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
  ),
  // i-360 — a órbita do "como me vejo × como me veem"
  avaliacao_360: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4.2h-4.2" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  // estrela emoldurada — avaliação da trilha de especialista
  avaliacao_especialista: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m12 7.5 1.4 2.8 3 .4-2.2 2.1.5 3L12 14.6l-2.7 1.4.5-3.2-2.2-2 3-.5z" />
    </>
  ),
  // doc + seta entrando — inscrição (o candidato "chega" ao programa)
  intake_mentor: (
    <>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5V8H18" />
      <path d="M12 10.5v5.5M9.8 13.8 12 16l2.2-2.2" />
    </>
  ),
  // doc + caneta — o form sendo preenchido pelo jovem candidato
  intake_mentorado: (
    <>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5V8H18" />
      <path d="m10 16.8 2.8-2.8 1.4 1.4-2.8 2.8H10z" />
    </>
  ),
  // broto saindo do solo — o que o jovem virou depois da mentoria (0124)
  desfecho: (
    <>
      <path d="M12 20.5v-8" />
      <path d="M12 12.5C12 8.8 9.2 6 5.5 6c0 3.7 2.8 6.5 6.5 6.5z" />
      <path d="M12 10.5c0-3.7 2.8-6.5 6.5-6.5 0 3.7-2.8 6.5-6.5 6.5z" />
    </>
  ),
};

/** Símbolo do instrumento — svg 24×24, traço herda currentColor e a cor
 *  própria é aplicada via token --inst-* (a menos que `neutro`, aí herda
 *  do contexto — estado trancado/muted do card). Decorativo por padrão;
 *  `titulo` o promove a role="img" com nome acessível. */
export function InstrumentoIcone({
  instrumento,
  size = 24,
  neutro = false,
  titulo,
  className,
}: {
  instrumento: InstrumentoChave;
  /** lado do quadrado em px — 23 no .ig, 52 no .pthumb, ~15 em células */
  size?: number;
  /** tira a cor própria — herda a cor do texto ao redor (muted, ink) */
  neutro?: boolean;
  /** nome acessível — só quando o ícone aparece sem rótulo de texto ao lado */
  titulo?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      style={neutro ? undefined : { color: INSTRUMENTO_TOM[instrumento].cor }}
      className={cn("shrink-0", className)}
    >
      {titulo && <title>{titulo}</title>}
      {GLIFO[instrumento]}
    </svg>
  );
}

/** Emblema do instrumento — o quadrado `.ig` do v5c: tinta do instrumento
 *  de fundo, glifo a ~57% do lado (23/40). `trancado` é o estado "fora da
 *  janela" do mock: tinta vira muted e o glifo esmaece — a forma continua
 *  reconhecível (a convenção "desabilitado explica o porquê" fica com o
 *  texto ao lado, não com o ícone). */
export function InstrumentoEmblema({
  instrumento,
  size = 40,
  trancado = false,
  titulo,
  className,
}: {
  instrumento: InstrumentoChave;
  /** lado do quadrado em px (40 no card do v5c) */
  size?: number;
  trancado?: boolean;
  titulo?: string;
  className?: string;
}) {
  const tom = INSTRUMENTO_TOM[instrumento];
  return (
    <span
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      className={cn(
        "grid shrink-0 place-items-center rounded-[28%]",
        trancado && "bg-muted text-muted-foreground",
        className
      )}
      style={{
        width: size,
        height: size,
        ...(trancado ? {} : { background: tom.tinta, color: tom.cor }),
      }}
    >
      <InstrumentoIcone
        instrumento={instrumento}
        size={Math.round(size * 0.575)}
        neutro={trancado}
      />
    </span>
  );
}
