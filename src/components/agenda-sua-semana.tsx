import Link from "next/link";
import { semanaBounds, toDateStr } from "@/lib/ciclo";
import type { AgendaItem } from "@/lib/agenda-minha";
import { cn } from "@/lib/utils";

/** Strip "Sua semana" do mock v6 (7 células seg–dom) no topo do
 *  "Por mentorado" — a mesma leitura da Minha agenda condensada por dia:
 *  contador lime = compromisso seu (só quando 2+, senão o rótulo já diz),
 *  âmbar tracejado = item que você só acompanha (sessão esp / evento do
 *  jovem). Dias já fechados recebem os itens de `passadosSemana` — "livre"
 *  só sai quando o dia é livre de verdade; o badge passado fica muted
 *  (lima/âmbar pedem ação, e dia fechado não a pede).
 *  Cada célula é um Link pro dia no calendário (?aba=calendario&dia= — o
 *  deep-link que a coordenação já usa) com aria-label que verbaliza os
 *  contadores. */

const DOW = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;

/** Rótulo curto por tipo — o que cabe numa célula de ~100px. */
function rotuloStrip(i: AgendaItem): string {
  switch (i.tipo) {
    case "encontro":
      return `enc. ${i.numero}`;
    case "sessao_esp":
      return "sessão esp";
    case "programa":
      return i.rotulo.startsWith("Formação")
        ? "formação"
        : i.rotulo.startsWith("Recesso")
          ? "recesso"
          : "evento";
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
    // um evento oficial rende um item por dupla/turma — no strip é o
    // MESMO evento, então a contagem e os rótulos veem uma linha só
    // (mesma régua de merge do escopo "tudo": chave oficial, com o
    // eventoId de fallback pra item sem carimbo)
    const vistos = new Set<string>();
    const doDia = itens.filter((it) => {
      if (it.dia !== iso) return false;
      const chave = it.oficial?.chave ?? it.eventoId;
      if (chave == null) return true;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
    return {
      iso,
      dow: DOW[i],
      diaNum: Number(iso.slice(8, 10)),
      ehHoje: iso === hoje,
      passado: iso < hoje,
      itens: doDia,
    };
  });
  const baseAgenda = hibrido ? "/agenda?visao=dpp&" : "/agenda?";

  return (
    <section aria-label="Sua semana" className="space-y-2.5">
      <h2 className="text-base font-semibold">Sua semana</h2>
      <ol className="grid grid-cols-7 gap-1.5">
        {dias.map((d) => {
          // "a agendar" é intenção, não compromisso — fica fora da contagem
          // de "seus" (o próprio rótulo "a agendar" já o declara)
          const aAgendar = d.itens.filter(
            (i) => !i.convidado && i.tipo === "a_agendar"
          ).length;
          const itensProprios = d.itens.filter(
            (i) => !i.convidado && i.tipo !== "a_agendar"
          );
          const proprios = itensProprios.length;
          const convidados = d.itens.length - proprios - aAgendar;
          // a bolinha nomeia o encontro (a mentora lia "1" esperando o 7º):
          // dia com só encontros seus mostra os nºs separados por "·"
          // enquanto couber ("7·8"); item próprio de outro tipo volta a
          // mostrar a contagem
          const numerosProprios = itensProprios
            .filter((i) => i.tipo === "encontro" && i.numero != null)
            .map((i) => i.numero!);
          const soEncontros =
            proprios > 0 && numerosProprios.length === proprios;
          const badgeProprios =
            soEncontros && numerosProprios.join("·").length <= 5
              ? numerosProprios.join("·")
              : String(proprios);
          const labels =
            [...new Set(d.itens.map(rotuloStrip))].slice(0, 3).join(" · ") ||
            "livre";
          // resumo falado: mesma gramática da legenda ("é seu" / "só
          // acompanha") — com só encontros ele nomeia os nºs que a bolinha
          // mostra
          const resumo =
            [
              proprios > 0
                ? soEncontros
                  ? `${proprios === 1 ? "encontro" : "encontros"} ${numerosProprios.join(" e ")}`
                  : `${proprios} ${proprios === 1 ? "seu" : "seus"}`
                : null,
              convidados > 0 ? `${convidados} só acompanhando` : null,
              aAgendar > 0 ? `${aAgendar} a agendar` : null,
            ]
              .filter(Boolean)
              .join(", ") || "livre";
          return (
            <li key={d.iso} className="min-w-0">
              <Link
                href={`${baseAgenda}aba=calendario&dia=${d.iso}`}
                prefetch={false}
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
                {/* rótulo em todos os tamanhos — a pill sozinha ("1" solto)
                    não dizia o quê; o número só entra quando o rótulo não
                    dá conta (2+ itens) */}
                <span className="mt-0.5 max-w-full truncate text-[10px] leading-tight text-muted-foreground md:text-[11px]">
                  {labels}
                </span>
                {proprios > 0 && (
                  <span
                    className={cn(
                      "mt-1 grid min-w-[22px] place-items-center rounded-full px-1 py-0.5 text-[11px] font-bold tabular-nums",
                      d.passado
                        ? "bg-muted text-muted-foreground"
                        : "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
                    )}
                  >
                    {badgeProprios}
                  </span>
                )}
                {convidados > 1 && (
                  <span
                    className={cn(
                      "mt-1 grid min-w-[22px] place-items-center rounded-full border border-dashed px-1 py-0.5 text-[11px] font-bold tabular-nums",
                      d.passado
                        ? "border-border bg-muted text-muted-foreground"
                        : "border-[var(--warn)]/70 bg-[var(--warn)]/15 text-[var(--warn-text)]"
                    )}
                  >
                    {convidados}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
