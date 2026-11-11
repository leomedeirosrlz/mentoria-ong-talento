import { AVALIACAO_LABEL, AVANCEI_AVALIACAO_LABEL } from "@/lib/ciclo";
import type { ContextoAvaliacao } from "@/lib/forms/queries";
import { EstrelasMedia } from "@/components/estrelas";
import { cn } from "@/lib/utils";

// Card "Sua trajetória neste ciclo" (0191 · REALIZA-71) — o recorte
// read-only da dupla dentro do 360º público, entre o cabeçalho e a 1ª
// pergunta. O que chega já veio filtrado pela RPC pelo sistema do link:
// mentor recebe a série 1–4 dele + a média do jovem quantizada (só quando
// a régua da 0071 libera); mentorado, as próprias estrelas. Sem
// comentário/sentimento/pedir_apoio — o payload nem traz essas chaves.

// mesma escala de cor do TrajetoriaAvaliacoes (verde → âmbar → vermelho)
const COR_AVALIACAO: Record<string, string> = {
  excelente: "bg-[var(--ok)]",
  boa: "bg-[var(--brand-lime)]",
  regular: "bg-[var(--warn)]",
  baixa: "bg-[var(--danger)]",
};

const mediaTexto = (v: number) => v.toFixed(1).replace(".", ",");

/** Lado do mentor: a série 1–4 dos próprios registros em dots (o
 *  TrajetoriaAvaliacoes da ficha usa o mesmo vocabulário) + a média do
 *  jovem quando a régua do lote libera — e a explicação honesta quando
 *  não libera (o critério não é segredo: é a proteção dele). */
function ContextoMentor({
  registros,
  media_jovem,
}: {
  registros: { numero: number; avaliacao: string | null }[];
  media_jovem: number | null;
}) {
  const avaliados = registros.filter((r) => r.avaliacao != null);
  if (!avaliados.length && media_jovem == null) return null;
  return (
    <>
      {avaliados.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">
            suas avaliações de encontro
          </p>
          <ol
            aria-label={`${avaliados.length} encontros avaliados por você`}
            className="mt-1.5 flex flex-wrap items-center gap-1"
          >
            {avaliados.map((r) => (
              <li
                key={r.numero}
                title={`Encontro ${r.numero} · ${
                  AVALIACAO_LABEL[r.avaliacao!] ?? r.avaliacao
                }`}
                className={cn(
                  "size-2.5 rounded-full",
                  COR_AVALIACAO[r.avaliacao!] ?? "bg-muted-foreground/40"
                )}
              />
            ))}
          </ol>
        </div>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        {avaliados.length > 0 && (
          <>
            você avaliou {avaliados.length}{" "}
            {avaliados.length === 1 ? "encontro" : "encontros"}
          </>
        )}
        {media_jovem != null ? (
          <>
            {avaliados.length > 0 ? " · " : ""}quem você mentora avaliou a
            jornada com média {mediaTexto(media_jovem)} de 5
          </>
        ) : (
          <>
            {avaliados.length > 0 ? " · " : ""}a nota média de quem você
            mentora aparece aqui quando houver 3 avaliações enviadas
          </>
        )}
      </p>
      {media_jovem != null && (
        <EstrelasMedia media={media_jovem} size={13} className="mt-1.5" />
      )}
    </>
  );
}

/** Lado do mentorado: uma barra por encontro avaliado (altura = estrelas,
 *  ponto abaixo = marcou que avançou) + a linha-resumo da spec ("você
 *  avaliou N encontros · média X,X · avançou em M"). */
function ContextoMentorado({
  estrelas,
}: {
  estrelas: {
    numero: number;
    estrelas: number;
    avancei: string | null;
  }[];
}) {
  if (!estrelas.length) return null;
  const n = estrelas.length;
  const media = estrelas.reduce((s, a) => s + a.estrelas, 0) / n;
  const avancou = estrelas.filter((a) => a.avancei === "sim").length;
  return (
    <>
      <ol
        aria-label={`${n} encontros avaliados por você`}
        className="flex items-end gap-[3px]"
      >
        {estrelas.map((a) => (
          <li
            key={a.numero}
            title={
              `Encontro ${a.numero} · ${a.estrelas} de 5` +
              (a.avancei
                ? ` · ${AVANCEI_AVALIACAO_LABEL[a.avancei] ?? a.avancei}`
                : "")
            }
            className="flex flex-col items-center gap-1"
          >
            <span
              className="w-3 rounded-sm bg-[var(--warn)]"
              style={{ height: 4 + a.estrelas * 4 }}
            />
            <span
              className={cn(
                "size-1 rounded-full",
                a.avancei === "sim" ? "bg-[var(--ok)]" : "bg-transparent"
              )}
            />
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">
        você avaliou {n} {n === 1 ? "encontro" : "encontros"} · média{" "}
        {mediaTexto(media)}
        {avancou > 0 && <> · avançou em {avancou}</>}
      </p>
    </>
  );
}

export function ContextoAvaliacaoCard({
  contexto,
}: {
  contexto: ContextoAvaliacao;
}) {
  // link sem série nenhuma (dupla recém-formada, avaliação ainda não
  // respondida) → sem card: uma casca vazia só distrairia do form
  const vazio =
    "registros" in contexto
      ? !contexto.registros.some((r) => r.avaliacao != null) &&
        contexto.media_jovem == null
      : !contexto.estrelas.length;
  if (vazio) return null;
  return (
    <section
      aria-label="Sua trajetória neste ciclo"
      className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-7"
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Sua trajetória neste ciclo
      </h2>
      <div className="mt-3">
        {"registros" in contexto ? (
          <ContextoMentor
            registros={contexto.registros}
            media_jovem={contexto.media_jovem}
          />
        ) : (
          <ContextoMentorado estrelas={contexto.estrelas} />
        )}
      </div>
    </section>
  );
}
