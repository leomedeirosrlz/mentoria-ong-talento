import Link from "next/link";
import { ArrowRight, ListChecks } from "@phosphor-icons/react/dist/ssr";
import type { FormularioListaItem } from "@/lib/forms/queries";
import { camposPerguntas } from "@/lib/forms/schema";
import { formatDate } from "@/lib/ciclo";
import {
  ehInstrumentoChave,
  InstrumentoEmblema,
} from "@/components/instrumento-icone";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// REALIZA-199 — "Instrumentos do sistema": a prateleira dos formulários
// oficiais que não são a régua DPP (anamnese, inscrições, autoavaliação,
// avaliação da trilha). Read-only por natureza — o catálogo é imutável,
// então a linha não tem ação de builder: abre a ficha do form, onde moram
// links, respostas e prévia. Os instrumentos da régua (Visão, Metas, PDM,
// Roda da Vida, 360º) não aparecem nem aqui — a casa deles é a seção
// "Instrumentos do programa" em /materiais, que faz deep-link pras
// respostas daqui. O emblema é o mesmo símbolo da régua (item 2 do plano).
export function InstrumentosSistemaLista({
  formularios,
}: {
  formularios: FormularioListaItem[];
}) {
  return (
    <section aria-labelledby="sec-instrumentos-sistema">
      <h2
        id="sec-instrumentos-sistema"
        className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
      >
        Instrumentos do sistema
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Catálogo oficial do programa — as perguntas vêm do guia e não são
        editáveis. Links e respostas ficam dentro de cada instrumento.
      </p>
      <ul className="mt-3 space-y-2">
        {formularios.map((f) => (
          <li key={f.id}>
            <Link
              href={`/formularios/${f.id}`}
              className={cn(
                "group flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:shadow-[var(--shadow-border-hover)]",
                !f.ativo && "opacity-60"
              )}
            >
              {ehInstrumentoChave(f.sistema) ? (
                <InstrumentoEmblema instrumento={f.sistema} size={36} />
              ) : (
                // sistema fora do enum conhecido — fallback neutro, nunca
                // quebra a seção por um valor novo do banco
                <span className="grid size-9 shrink-0 place-items-center rounded-[28%] bg-muted text-muted-foreground">
                  <ListChecks size={18} aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold leading-snug">
                    {f.titulo}
                  </h3>
                  {!f.ativo && <Badge variant="secondary">Encerrado</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {camposPerguntas(f.campos).length}{" "}
                  {camposPerguntas(f.campos).length === 1
                    ? "pergunta"
                    : "perguntas"}
                  {" · "}
                  {f.linksTotal}{" "}
                  {f.linksTotal === 1 ? "link" : "links"}
                  {f.pendentes > 0 && f.ativo && (
                    <>
                      {" · "}
                      <span className="font-medium text-[var(--warn-text)]">
                        {f.pendentes}{" "}
                        {f.pendentes === 1 ? "pendente" : "pendentes"}
                      </span>
                    </>
                  )}
                  {f.respondidos > 0 && (
                    <>
                      {" · "}
                      <span className="font-medium text-[var(--ok-text)]">
                        {f.respondidos}{" "}
                        {f.respondidos === 1 ? "resposta" : "respostas"}
                      </span>
                    </>
                  )}
                  {f.ultimaResposta && ` · até ${formatDate(f.ultimaResposta)}`}
                </p>
              </div>
              <ArrowRight
                size={16}
                aria-hidden
                className="shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
      {/* a régua saiu daqui de propósito — a nota aponta a casa nova em vez
          de deixar a coord procurando os instrumentos da jornada */}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Visão, Metas, PDM, Roda da Vida e Avaliação 360º — os instrumentos
        da jornada — ficam em{" "}
        <Link
          href="/materiais"
          className="font-medium underline underline-offset-2 hover:text-foreground"
        >
          Materiais
        </Link>
        .
      </p>
    </section>
  );
}
