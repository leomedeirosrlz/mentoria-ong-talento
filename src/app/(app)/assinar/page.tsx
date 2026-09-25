import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CaretDown,
  CheckCircle,
  FileArrowDown,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { assinarTermo } from "@/lib/actions-assinaturas";
import { getMe } from "@/lib/queries";
import {
  getMeusDadosCivis,
  getMinhaAssinaturaTermo,
} from "@/lib/queries-assinaturas";
import { formatDateTime } from "@/lib/ciclo";
import {
  ANEXO_I_PARAGRAFOS,
  ANEXO_I_TITULO,
  civisPreview,
  CLAUSULAS_TERMO,
  FECHO_TERMO,
  TERMO_TITULO,
  preambuloTermo,
} from "@/lib/documentos/texto";
import { AssinaturaForm } from "@/components/assinatura-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Termo de adesão" };

// Fluxo do signatário logado (0033): o voluntário lê o termo integral e
// assina com os dados civis + nome digitado — a sessão prova a identidade,
// ip/ua/hash ficam de evidência na row.
export default async function AssinarPage() {
  const me = await getMe();
  if (!me) redirect("/login"); // o layout já barra — convenção das páginas
  const [a, civis] = await Promise.all([
    getMinhaAssinaturaTermo(),
    getMeusDadosCivis(),
  ]);

  if (a?.status === "assinado") {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="animate-enter">
          <CardContent className="py-10 text-center">
            <CheckCircle
              size={32}
              weight="regular"
              aria-hidden
              className="mx-auto text-[var(--ok-text)]"
            />
            <h1 className="mt-3 text-lg font-semibold">
              Termo de adesão assinado
            </h1>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Assinado em {formatDateTime(a.assinado_em)}. A sua via em PDF fica
              disponível aqui.
            </p>
            <div className="mt-5">
              <a
                href={`/api/assinatura/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                <FileArrowDown size={16} aria-hidden />
                Ver o PDF assinado
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // revogado/expirado: a row anterior perdeu validade — reassina pelo form
  const reassinar = a?.status === "revogado" || a?.status === "expirado";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Termo de Adesão ao Trabalho Voluntário
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          São três passos: ler o termo inteiro, conferir seus dados e assinar.
          A assinatura eletrônica tem a mesma validade de uma assinatura em
          papel.
        </p>
        {/* índice da tarefa — âncoras nativas, cada passo aponta pra seção
            que o resolve; três links substituem um form imenso sem mapa */}
        <nav aria-label="Etapas da assinatura" className="mt-3">
          <ol className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <li>
              <a
                href="#termo"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                1 · Leia o termo
              </a>
            </li>
            <li>
              <a
                href="#dados"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                2 · Confira seus dados
              </a>
            </li>
            <li>
              <a
                href="#assinar"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                3 · Assine
              </a>
            </li>
          </ol>
        </nav>
      </header>

      {reassinar && (
        <p className="flex items-start gap-2.5 rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-4 py-3 text-sm">
          <Warning
            size={18}
            aria-hidden
            className="mt-0.5 shrink-0 text-[var(--warn-text)]"
          />
          <span>
            {a?.status === "revogado"
              ? "Sua assinatura anterior foi revogada. Leia o termo e assine novamente."
              : "Sua assinatura anterior expirou. Leia o termo e assine novamente."}
          </span>
        </p>
      )}

      {/* texto integral do termo — mesma fonte (documentos/texto) que o PDF
          renderiza, então o que se lê é exatamente o que se assina */}
      <section
        id="termo"
        aria-label="Texto completo do termo"
        className="scroll-mt-4 rounded-xl bg-card shadow-[var(--shadow-border)]"
      >
        {/* documento integral inline — o que se lê é o que se assina (mesmo
            padrão da rota pública /assinar/[token]); nada de scroll interno
            cortando cláusula no meio */}
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
          <p className="mt-6 border-t border-border pt-5 text-center font-sans">
            <a
              href="#dados"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              Continuar para seus dados ↓
            </a>
          </p>
        </div>
      </section>

      <Card id="dados" className="animate-enter scroll-mt-4">
        <CardContent className="space-y-5">
          <div>
            <h2 className="text-base font-semibold">2 · Confira seus dados</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {civis
                ? "Já temos seus dados do cadastro. Confira, corrija se preciso e assine."
                : "Preencha como no seu documento de identidade. Os dados entram no termo exatamente como digitados."}
            </p>
          </div>
          <AssinaturaForm modo="termo" acao={assinarTermo} dados={civis} etapas />
        </CardContent>
      </Card>
    </div>
  );
}
