import Link from "next/link";
import { semanaBounds, toDateStr } from "@/lib/ciclo";
import type { AgendaItem } from "@/lib/agenda-minha";
import { cn } from "@/lib/utils";

/** Strip "Sua semana" do mock v6 (7 células seg–dom) no topo do
 *  "Por mentorado" — a mesma leitura da Minha agenda condensada por dia:
 *  contador lime = compromisso seu, âmbar tracejado = item que você só
 *  acompanha (sessão esp / evento do jovem). Datas passadas não têm fonte
 *  aqui — o derive da agenda é pra frente, então dias anteriores a hoje
 *  aparecem "livre" (o strip é um planejador, não um histórico).
 *  Cada célula é um Link pro dia no calendário (?aba=calendario&dia= — o
 *  deep-link que a coordenação já usa) com aria-label que verbaliza os
 *  contadores: sem ele o SR lia "ter 14 2 1" sem sentido no mobile, onde
 *  os rótulos ficam escondidos (md:block). */

const DOW = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;

/** Rótulo curto por tipo — o que cabe numa célula de ~100px. */
function rotuloStrip(i: AgendaItem): string {
  switch (i.tipo) {
    case "encontro":
      return `enc. ${i.numero}`;
    case "sessao_esp":
      return "sessão esp";
    case "supervisao":
      return "supervisão";
    case "programa":
      return i.rotulo.startsWith("Formação") ? "formação" : "evento";
    case "a_agendar":
      return "a agendar";
  }
}

export function AgendaSuaSemana({
  itens,
  hoje,
  hibrido = false,
}: {
  /** Os MESMOS AgendaItem da Minha agenda — a página deriva uma vez e
   *  reusa aqui. */
  itens: AgendaItem[];
  /** "YYYY-MM-DD" de hoje (São Paulo). */
  hoje: string;
  /** Quem chega via ?visao=dpp (staff+mentor, DPP+esp) precisa do param no
   *  deep-link do dia — sem ele o link cai na visão errada (mesma regra do
   *  AbasAgendaMentor). */
  hibrido?: boolean;
}) {
  // meio-dia UTC: datas puras vivem em espaço UTC — meio-dia local anda um
  // dia pra trás em fusos a frente de SP (mesma régua do resto do WP5)
  const { seg } = semanaBounds(new Date(`${hoje}T12:00:00Z`));
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.parse(`${seg}T12:00:00Z`) + i * 86_400_000);
    const iso = toDateStr(d);
    const doDia = itens.filter((it) => it.dia === iso);
    return {
      iso,
      dow: DOW[i],
      diaNum: Number(iso.slice(8, 10)),
      ehHoje: iso === hoje,
      itens: doDia,
    };
  });
  const baseAgenda = hibrido ? "/agenda?visao=dpp&" : "/agenda?";

  return (
    <section aria-label="Sua semana" className="space-y-2.5">
      <h2 className="text-base font-semibold">Sua semana</h2>
      <ol className="grid grid-cols-7 gap-1.5">
        {dias.map((d) => {
          const proprios = d.itens.filter((i) => !i.convidado).length;
          const convidados = d.itens.length - proprios;
          const labels =
            [...new Set(d.itens.map(rotuloStrip))].slice(0, 3).join(" · ") ||
            "livre";
          // resumo falado: mesma gramática da legenda ("é seu" / "só
          // acompanha") — o aria-label cobre o que o rótulo md+ esconde
          const resumo =
            [
              proprios > 0
                ? `${proprios} ${proprios === 1 ? "seu" : "seus"}`
                : null,
              convidados > 0 ? `${convidados} só acompanhando` : null,
            ]
              .filter(Boolean)
              .join(", ") || "livre";
          return (
            <li key={d.iso} className="min-w-0">
              <Link
                href={`${baseAgenda}aba=calendario&dia=${d.iso}`}
                aria-label={`${d.dow} ${d.diaNum}: ${resumo}. Abrir o dia no calendário`}
                className={cn(
                  "grid h-full min-h-[68px] content-start justify-items-center gap-0.5 rounded-xl border bg-card px-1 py-2 text-center transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-[104px] md:px-2 md:py-2.5",
                  d.ehHoje && "border-foreground ring-1 ring-foreground/60"
                )}
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {d.dow}
                </span>
                <b className="text-lg font-bold leading-none tabular-nums">
                  {d.diaNum}
                </b>
                {/* os labels moram escondidos no mobile — o contador já conta
                    a história; em md+ eles aparecem */}
                <span className="mt-0.5 hidden text-[11px] leading-tight text-muted-foreground md:block">
                  {labels}
                </span>
                {proprios > 0 && (
                  <em className="mt-1 grid min-w-[22px] place-items-center rounded-full bg-[var(--brand-lime)] px-1 py-0.5 text-[11px] font-bold not-italic tabular-nums text-[var(--brand-ink)]">
                    {proprios}
                  </em>
                )}
                {convidados > 0 && (
                  <em className="mt-1 grid min-w-[22px] place-items-center rounded-full border border-dashed border-[var(--warn)]/70 bg-[var(--warn)]/15 px-1 py-0.5 text-[11px] font-bold not-italic tabular-nums text-[var(--warn-text)]">
                    {convidados}
                  </em>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        Contador colorido = é seu · âmbar tracejado = só acompanha. Toque num
        dia pra abrir no calendário.
      </p>
    </section>
  );
}
