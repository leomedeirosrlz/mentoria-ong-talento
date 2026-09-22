import type { Metadata } from "next";
import {
  CheckCircle,
  ClockCountdown,
  FileArrowDown,
  FileX,
  LinkBreak,
} from "@phosphor-icons/react/dist/ssr";
// import type não emite runtime — o barrel principal usa createContext e
// quebraria a página (server component) se viesse como import de valor
import type { Icon } from "@phosphor-icons/react";
import { assinarComToken, assinaturaPorToken } from "@/lib/actions-assinaturas";
import { AssinaturaForm } from "@/components/assinatura-form";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/ciclo";
import {
  AUTORIZACAO_TITULO,
  CLAUSULAS_AUTORIZACAO,
  dataPorExtenso,
  FECHO_AUTORIZACAO,
  preambuloAutorizacao,
} from "@/lib/documentos/texto";
import type { DadosAutorizacao } from "@/lib/types";

export const metadata: Metadata = {
  title: "Assinatura de documento",
  description:
    "Assinatura eletrônica de documento do Programa de Mentoria Social — Realiza.vc.",
};

// uuid do token na URL — formato errado nem vai ao banco (e a RPC espera uuid,
// então qualquer outra coisa daria erro feio em vez de tela amigável)
const TOKEN_RE = /^[0-9a-f-]{36}$/;

/** Telas terminais do link (inválido, já assinado, revogado, expirado) — quem
 *  abre é o responsável pelo jovem, então a mensagem é direta e sem jargão. */
function EstadoLink({
  icon: Icone,
  titulo,
  children,
}: {
  icon: Icon;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm animate-rise text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-realiza.png" alt="Realiza.vc" className="mx-auto h-6 w-auto" />
        <div className="mt-8 rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
          <Icone size={28} className="mx-auto text-muted-foreground" aria-hidden />
          <h1 className="mt-3 text-base font-semibold">{titulo}</h1>
          <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {children}
          </div>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Realiza.vc — Programa de Mentoria
        </p>
      </div>
    </div>
  );
}

export default async function AssinarTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const info = TOKEN_RE.test(token) ? await assinaturaPorToken(token) : null;

  if (!info) {
    return (
      <EstadoLink icon={LinkBreak} titulo="Link inválido">
        <p>
          Este link de assinatura não é válido — ele pode ter sido copiado
          incompleto ou substituído por um mais recente. Peça um novo link à
          coordenação do programa.
        </p>
      </EstadoLink>
    );
  }

  if (info.status === "assinado") {
    return (
      <EstadoLink icon={CheckCircle} titulo="Documento assinado">
        <p>
          Este documento já foi assinado
          {info.assinado_em ? ` em ${formatDateTime(info.assinado_em)}` : ""}.
          Guarde a via em PDF para seus registros.
        </p>
        <p className="mt-4">
          <a
            href={`/api/assinar-token/${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileArrowDown size={15} aria-hidden />
            Baixar a via do documento
          </a>
        </p>
      </EstadoLink>
    );
  }

  if (info.status === "revogado") {
    return (
      <EstadoLink icon={FileX} titulo="Documento cancelado">
        <p>
          Este documento foi cancelado pela coordenação do programa e não pode
          mais ser assinado por este link. Se você acha que isso é um engano,
          fale com a coordenação.
        </p>
      </EstadoLink>
    );
  }

  if (info.status === "expirado") {
    return (
      <EstadoLink icon={ClockCountdown} titulo="Link expirado">
        <p>
          O prazo deste link de assinatura terminou. Peça um novo link à
          coordenação do programa — a assinatura leva poucos minutos.
        </p>
      </EstadoLink>
    );
  }

  // pendente: preview do documento com os dados do responsável em branco —
  // eles só entram no snapshot no ato da assinatura (o form abaixo alimenta)
  const dadosPreview: DadosAutorizacao = {
    mentorado_nome: info.alvo.nome,
    responsavel: {
      nome_civil: "______",
      rg: "______",
      cpf: "______",
      data_nascimento: null,
      parentesco: "______",
      endereco: {
        logradouro: "______",
        numero: "______",
        complemento: null,
        bairro: "______",
        cidade: "______",
        uf: "______",
        cep: "______",
      },
    },
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-realiza.png" alt="Realiza.vc" className="h-6 w-auto" />

        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Assinatura eletrônica
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-snug tracking-tight">
          {info.template.titulo}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Você recebeu este link como responsável por{" "}
          <strong className="font-semibold text-foreground">
            {info.alvo.nome}
          </strong>
          . Leia o documento abaixo e assine com seus dados civis — a assinatura
          eletrônica tem a mesma validade de uma assinatura em papel.
        </p>

        {/* o documento como será emitido — o texto é o mesmo que entra no PDF
            (src/lib/documentos/texto.ts é a fonte única dos dois) */}
        <section className="mt-8 rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.06em]">
            {AUTORIZACAO_TITULO}
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-relaxed">
            {preambuloAutorizacao(dadosPreview).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {CLAUSULAS_AUTORIZACAO.map(([titulo, paragrafos]) => (
              <div key={titulo} className="pt-1">
                <h3 className="font-semibold">{titulo}</h3>
                {paragrafos.map((p) => (
                  <p key={p} className="mt-1.5">
                    {p}
                  </p>
                ))}
              </div>
            ))}
            <p>{FECHO_AUTORIZACAO}</p>
            <p>{dataPorExtenso(new Date())}</p>
          </div>
        </section>

        <section className="mt-6 rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8">
          <h2 className="text-base font-semibold">Seus dados para assinar</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Preencha como consta no seu documento oficial — as informações entram
            na autorização e a assinatura registra data, hora e endereço de rede.
          </p>
          <div className="mt-6">
            <AssinaturaForm
              modo="autorizacao"
              alvoNome={info.alvo.nome}
              acao={assinarComToken.bind(null, token)}
            />
          </div>
        </section>
      </main>

      <div className="border-t border-border px-4 py-6 sm:px-6">
        <SiteFooter />
      </div>
    </div>
  );
}
