import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
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
import { AssinaturaForm } from "@/components/assinatura-form";
import { TermoVoluntarioDoc } from "@/components/termo-doc";
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
      <TermoVoluntarioDoc
        civis={civis}
        id="termo"
        continuar={{ href: "#dados", rotulo: "Continuar para seus dados ↓" }}
      />

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
