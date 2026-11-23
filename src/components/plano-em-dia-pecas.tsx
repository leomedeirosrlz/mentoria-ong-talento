import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CaretRight,
  CheckCircle,
  Clock,
} from "@phosphor-icons/react/dist/ssr";
import { PILL_SITUACAO, PONTO_SITUACAO, type TomSituacao } from "@/components/dupla-linha";
import { buttonVariants } from "@/components/ui/button";
import {
  diaCurto,
  diaMes,
  type ResumoCombinado,
} from "@/lib/plano-combinado";
import { cn } from "@/lib/utils";

// Peças do "ficar em dia" (REALIZA-513) na gramática dos cards de dupla:
// pill de estado com rótulo, quadradinhos por encontro e superfície
// neutra. A cor de status mora só na pill e nos quadrados.

export function PillPlano({
  tom,
  children,
}: {
  tom: TomSituacao;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        PILL_SITUACAO[tom]
      )}
    >
      {PONTO_SITUACAO[tom] && (
        <span aria-hidden className={cn("size-1.5 rounded-full", PONTO_SITUACAO[tom])} />
      )}
      {children}
    </span>
  );
}

/** Estado de um encontro na régua do plano. */
export type EstadoQuadrado =
  | "feito"
  | "plano"
  | "marcado"
  | "fora"
  | "vazio";

const QUADRADO: Record<EstadoQuadrado, string> = {
  feito: "bg-muted-foreground",
  plano: "bg-[var(--destaque)] shadow-[inset_0_0_0_1px_var(--destaque-borda)]",
  marcado: "bg-[var(--ok)]",
  fora: "bg-[var(--danger)]",
  vazio: "bg-muted shadow-[inset_0_0_0_1px_var(--border)]",
};

const LEGENDA: Record<EstadoQuadrado, string> = {
  feito: "feito",
  plano: "no plano",
  marcado: "com data",
  fora: "não cabe até o encerramento",
  vazio: "na data oficial",
};

/** Um quadrado por encontro da trilha, como na linha de dupla, com a
 *  legenda em texto (status nunca só por cor). */
export function QuadradosPlano({
  itens,
  rotulo,
}: {
  itens: { numero: number; estado: EstadoQuadrado }[];
  /** "6 de 16 feitos" — texto acima da barra */
  rotulo: string;
}) {
  const presentes = (Object.keys(LEGENDA) as EstadoQuadrado[]).filter((e) =>
    itens.some((i) => i.estado === e)
  );
  const contagem = presentes
    .map((e) => `${itens.filter((i) => i.estado === e).length} ${LEGENDA[e]}`)
    .join(", ");
  return (
    <div>
      <p className="text-xs font-semibold tabular-nums">{rotulo}</p>
      <div
        role="img"
        aria-label={`${rotulo}: ${contagem}`}
        className="mt-1.5 flex h-2.5 gap-px"
      >
        {itens.map((i) => (
          <span
            key={i.numero}
            className={cn("min-w-0 flex-1 rounded-[2px]", QUADRADO[i.estado])}
          />
        ))}
      </div>
      <ul
        aria-hidden
        className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
      >
        {presentes.map((e) => (
          <li key={e} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-[2px]", QUADRADO[e])} />
            {LEGENDA[e]}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Os dois aceites lado a lado: quem já disse sim e quem falta. */
export function AceitesPlano({
  resumo,
  mentor,
  jovem,
}: {
  resumo: ResumoCombinado;
  mentor: string;
  jovem: string;
}) {
  const lados = [
    { nome: mentor, papel: "mentor", ok: resumo.aceites.mentor },
    { nome: jovem, papel: "jovem", ok: resumo.aceites.mentorado },
  ];
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Aceites do plano">
      {lados.map((l) => (
        <li
          key={l.papel}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs",
            l.ok
              ? "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-text)]"
              : "border-border bg-muted/50 text-foreground"
          )}
        >
          {l.ok ? (
            <CheckCircle size={14} weight="fill" aria-hidden />
          ) : (
            <Clock size={14} aria-hidden />
          )}
          <span>
            <b className="font-semibold">{l.nome}</b>{" "}
            {l.ok ? "aceitou" : "ainda não aceitou"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A régua do combinado em quadrados: feito, com data ou pendente. */
export function QuadradosCombinado({ resumo }: { resumo: ResumoCombinado }) {
  return (
    <QuadradosPlano
      rotulo={`${resumo.marcados} de ${resumo.total} encontros do plano com data`}
      itens={resumo.passos.map((p) => ({
        numero: p.numero,
        estado:
          p.estado === "feito"
            ? "feito"
            : p.estado === "marcado"
              ? "marcado"
              : "plano",
      }))}
    />
  );
}

export type PerspectivaPlano = "mentor" | "jovem";

/** A frase do banner: o que falta agora, do ponto de vista de quem lê. */
export function fraseDoCombinado(
  r: ResumoCombinado,
  p: PerspectivaPlano,
  outro: string
): { tom: TomSituacao; pill: string; texto: string; cta: string } {
  if (r.falta) {
    const euFalto =
      r.falta === "os_dois" ||
      (p === "mentor" ? r.falta === "mentor" : r.falta === "mentorado");
    return euFalto
      ? {
          tom: "atencao",
          pill: "Falta o seu aceite",
          texto:
            r.falta === "os_dois"
              ? `A equipe propôs um plano pra vocês ficarem em dia até ${diaMes(r.ate ?? "")}. Ele começa a valer quando os dois aceitarem.`
              : `${outro} já aceitou o plano pra vocês ficarem em dia até ${diaMes(r.ate ?? "")}. Falta você.`,
          cta: "Ver e responder",
        }
      : {
          tom: "neutro",
          pill: `Falta ${outro} aceitar`,
          texto: `Você já aceitou. O plano começa a valer quando ${outro} aceitar também.`,
          cta: "Ver o plano",
        };
  }
  if (r.proximo) {
    return {
      tom: "neutro",
      pill: "Plano combinado",
      texto: `Próximo: ${r.proximo.numero}º encontro, sugestão ${diaCurto(r.proximo.data)}. Confirmem a data pra seguir no plano.`,
      cta: "Confirmar data",
    };
  }
  return {
    tom: "neutro",
    pill: "Plano combinado",
    texto: `Todos os encontros do plano têm data. Em dia em ${diaMes(r.ate ?? "")}.`,
    cta: "Ver o plano",
  };
}

/** Banner das homes (mentor e jovem): próximo passo e progresso do
 *  plano, com uma saída pro detalhe. Não repete a lista de passos. */
export function PlanoBanner({
  resumo,
  perspectiva,
  outro,
  href,
  titulo = "Plano para ficar em dia",
}: {
  resumo: ResumoCombinado;
  perspectiva: PerspectivaPlano;
  /** primeiro nome de quem está do outro lado da dupla */
  outro: string;
  href: string;
  titulo?: string;
}) {
  const f = fraseDoCombinado(resumo, perspectiva, outro);
  return (
    <section
      aria-label={titulo}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--destaque-suave)] text-[var(--destaque-foreground)]"
        >
          <CalendarCheck size={20} />
        </span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className="text-sm font-semibold">{titulo}</h3>
            <PillPlano tom={f.tom}>{f.pill}</PillPlano>
          </div>
          <p className="text-sm text-pretty">{f.texto}</p>
          <QuadradosCombinado resumo={resumo} />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Link
          href={href}
          className={cn(
            buttonVariants({ variant: f.tom === "atencao" ? "default" : "outline", size: "sm" }),
            "group min-h-11 sm:min-h-8"
          )}
        >
          {f.cta}
          <CaretRight aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
