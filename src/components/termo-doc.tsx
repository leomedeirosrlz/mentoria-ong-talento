import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import {
  ANEXO_I_PARAGRAFOS,
  ANEXO_I_TITULO,
  civisPreview,
  CLAUSULAS_TERMO,
  FECHO_TERMO,
  preambuloTermo,
  TERMO_TITULO,
} from "@/lib/documentos/texto";
import type { DadosCivis } from "@/lib/types";

/** Documento integral do termo de adesão ao trabalho voluntário — extraído
 *  da página /assinar pra reutilizar no passo de termo do onboarding. O que
 *  se lê é exatamente o que se assina: a fonte é documentos/texto, a mesma
 *  que o PDF renderiza. Componente universal (só dados + <details> nativo):
 *  renderiza no servidor na página /assinar e no cliente no wizard. */
export function TermoVoluntarioDoc({
  civis,
  id,
  continuar,
}: {
  /** dados civis da qualificação do signatário — parcial/null vira blank
   *  sublinhado, como no papel (civisPreview) */
  civis?: Partial<DadosCivis> | null;
  /** âncora da seção — /assinar usa "termo" no índice de etapas */
  id?: string;
  /** link de rodapé dentro do documento (ex.: "Continuar para seus dados ↓"
   *  apontando pro bloco do form) — omitido quando não faz sentido */
  continuar?: { href: string; rotulo: string };
}) {
  return (
    <section
      id={id}
      aria-label="Texto completo do termo"
      className="scroll-mt-4 rounded-xl bg-card shadow-[var(--shadow-border)]"
    >
      {/* documento integral inline — nada de scroll interno cortando
          cláusula no meio */}
      <div className="px-5 py-6 sm:px-8">
        <div className="space-y-4 font-serif text-[15px] leading-relaxed">
          <h2 className="text-center font-bold uppercase tracking-wide">
            {TERMO_TITULO}
          </h2>
          {preambuloTermo(civisPreview(civis)).map((p, i) => (
            <p key={i} className="text-justify">
              {p}
            </p>
          ))}
          {CLAUSULAS_TERMO.map(([titulo, paragrafos]) => (
            <div key={titulo} className="space-y-2">
              <h3 className="font-bold uppercase">{titulo}</h3>
              {paragrafos.map((p, i) => (
                <p key={i} className="text-justify">
                  {p}
                </p>
              ))}
            </div>
          ))}
          <p className="text-justify">{FECHO_TERMO}</p>
          {/* o anexo é transcrição legal de apoio — <details> nativo tira
              meia página de lei do caminho sem esconder que ela existe;
              título e parágrafos seguem verbatim a fonte oficial */}
          <details className="group/anexo border-t border-border pt-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-lg text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <CaretDown
                size={16}
                aria-hidden
                className="shrink-0 text-muted-foreground transition-transform group-open/anexo:rotate-180"
              />
              Anexo I · transcrição integral da Lei nº 9.608/1998
            </summary>
            <div className="mt-3 space-y-3">
              <h3 className="text-center font-bold uppercase">
                {ANEXO_I_TITULO}
              </h3>
              {ANEXO_I_PARAGRAFOS.map((p, i) => (
                <p key={i} className="text-justify">
                  {p}
                </p>
              ))}
            </div>
          </details>
        </div>
        {continuar && (
          <p className="mt-6 border-t border-border pt-5 text-center font-sans">
            <a
              href={continuar.href}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              {continuar.rotulo}
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
