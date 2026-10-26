import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { RelatorioCanvas } from "@/components/relatorio-canvas";
import { ResumoDesfechoCard } from "@/components/resumo-desfecho";
import { ResumoSenhaForm } from "@/components/resumo-senha-form";
import { rastroAcesso, resumoCookie } from "@/lib/resumo-acesso";
import {
  colunasDeLink,
  configLinkOk,
  montarLinhas,
  montarLinhasAssinaturas,
  montarLinhasCiclo,
} from "@/lib/relatorio";
import type {
  LinhaRelatorio,
  RelatorioDadosAssinaturas,
  RelatorioDadosCiclo,
  RelatorioDadosGrade,
  RelatorioLinkConfig,
} from "@/lib/relatorio";
import { formatDateTime } from "@/lib/ciclo";
import { montaDesfechoCard, parseDesfechoAgregado } from "@/lib/desfecho";

// Relatório público por link (167 + 170): o gate não é mais uma constante
// nem um recorte na query — relatorio_link_info devolve o shell (existe/
// estado/precisa_senha/título) e abrir_relatorio entrega config+dados já
// allowlisted em SQL, com rate-limit e auditoria dentro da RPC (0110).
// A senha chega pelo cookie httpOnly que a action desbloquearResumo grava;
// a cada render a RPC revalida — revogar ou trocar a senha derruba na hora.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resumo da turma",
  robots: { index: false, follow: false },
};

type InfoLink = {
  existe: boolean;
  estado?: "ativo" | "revogado" | "expirado";
  precisa_senha?: boolean;
  titulo?: string | null;
};

type RespostaAbrir = {
  ok: boolean;
  motivo?: string;
  config?: RelatorioLinkConfig;
  dados?: unknown;
  audit_fail?: boolean;
};

/** Card neutro de link indisponível — a mesma superfície pra revogado,
 *  expirado e config quebrada: o motivo interno já mora na auditoria
 *  (resumo_acessos.motivo), o visitante não ganha oráculo nenhum.
 *  Nunca sem saída: erro transitório oferece retry (mesma rota — senha
 *  já validada segue no cookie); estado terminal oferece falar com a
 *  coordenação por e-mail, como as irmãs de token público já fazem. */
function Indisponivel({
  detalhe,
  acao,
}: {
  detalhe?: string;
  acao?: { href: string; label: string };
}) {
  const cta = acao ?? {
    href: "mailto:mentoria@realiza.vc",
    label: "Falar com a coordenação",
  };
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <main className="grid flex-1 place-items-center px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Resumo indisponível</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {detalhe ??
              "Este resumo não está mais disponível. Peça um novo link à coordenação."}
          </p>
          <a
            href={cta.href}
            className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-5`}
          >
            {cta.label}
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default async function ResumoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // shell do link: inexistente → 404 (o info responde igual pra slug fora
  // do alfabeto — nem a forma é confirmada)
  const { data: infoRaw, error: infoError } = await supabase.rpc(
    "relatorio_link_info",
    { p_slug: slug }
  );
  const info = infoRaw as InfoLink | null;
  if (infoError) {
    console.error("[resumo] relatorio_link_info:", infoError);
    return (
      <Indisponivel
        detalhe="Não foi possível carregar agora. Tente de novo em instantes."
        acao={{ href: `/resumo/${slug}`, label: "Tentar de novo" }}
      />
    );
  }
  if (!info?.existe) notFound();
  if (info.estado && info.estado !== "ativo") return <Indisponivel />;

  // link protegido sem cookie → direto pro form: chamar a RPC sem senha
  // seria uma falha auditada (e conta no rate-limit) por pageview. O nome
  // `resumo_<slug>` é o resumoCookie() que desbloquearResumo grava.
  const senhaCookie =
    (await cookies()).get(resumoCookie(slug))?.value ?? null;
  if (info.precisa_senha && !senhaCookie) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <main className="grid flex-1 place-items-center px-4 py-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <div className="w-full max-w-md">
            <ResumoSenhaForm slug={slug} />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { ipHash, ua } = await rastroAcesso();
  const { data: aberturaRaw, error: abrirError } = await supabase.rpc(
    "abrir_relatorio",
    { p_slug: slug, p_senha: senhaCookie, p_ip_hash: ipHash, p_ua: ua }
  );
  const abertura = aberturaRaw as RespostaAbrir | null;

  if (abrirError) {
    console.error("[resumo] abrir_relatorio:", abrirError);
    return (
      <Indisponivel
        detalhe="Não foi possível carregar agora. Tente de novo em instantes."
        acao={{ href: `/resumo/${slug}`, label: "Tentar de novo" }}
      />
    );
  }
  if (abertura?.audit_fail) {
    // mesma disciplina da action: a auditoria quebrada não é gate pro
    // visitante, mas é sinal de schema fora do lugar — visível no Sentry
    console.error("[resumo] audit_fail na auditoria de acesso");
    Sentry.captureMessage("resumo: auditoria de acesso falhou (audit_fail)", "warning");
  }

  if (!abertura?.ok) {
    switch (abertura?.motivo) {
      case "senha":
        // cookie velho (senha redefinida) ou inexistente — cai no form
        return (
          <div className="flex min-h-[100dvh] flex-col">
            <main className="grid flex-1 place-items-center px-4 py-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
              <div className="w-full max-w-md">
                <ResumoSenhaForm slug={slug} />
              </div>
            </main>
            <SiteFooter />
          </div>
        );
      case "limite":
        return (
          <Indisponivel
            detalhe="Muitas tentativas. Aguarde alguns minutos e tente de novo."
            acao={{ href: `/resumo/${slug}`, label: "Tentar de novo" }}
          />
        );
      case "sem_link":
        notFound();
      default:
        // revogado/expirado/config — superfície única
        return <Indisponivel />;
    }
  }

  const cfg = abertura.config;
  // o SQL já valida o config, mas o cast é fronteira de tipo — config que
  // não passa no espelho vira card neutro em vez de grade quebrada
  if (!cfg || !configLinkOk(cfg)) return <Indisponivel />;

  const colunas = colunasDeLink(cfg);
  const linhas: LinhaRelatorio[] =
    cfg.tipo === "ciclo"
      ? montarLinhasCiclo(abertura.dados as RelatorioDadosCiclo)
      : cfg.tipo === "assinaturas"
        ? montarLinhasAssinaturas(abertura.dados as RelatorioDadosAssinaturas)
        : (() => {
            const dados = abertura.dados as RelatorioDadosGrade;
            return montarLinhas(
              {
                turma: cfg.turma ?? null,
                granularidade: cfg.granularidade ?? "pessoas",
                colunas: colunas.map((c) => c.id),
              },
              dados.duplas,
              new Map(dados.profiles.map((p) => [p.id, p])),
              new Map(dados.mentorados.map((m) => [m.id, m])),
              { fila: dados.inscricoes ?? [] }
            );
          })();

  // a poda da grade serializada é a mesma de antes: a RPC já allowlistou
  // os dados, mas a linha montada carrega campos de colunas fora do
  // recorte (ex.: email de uma linha de outra pessoa não — cada linha só
  // tem o que a RPC mandou; a poda reforça que só coluna visível viaja)
  const permitidas = new Set([
    ...colunas.map((c) => c.id),
    "__status",
    "__papel",
  ]);
  const linhasPodadas = linhas.map(
    (l): LinhaRelatorio =>
      Object.fromEntries(
        Object.entries(l).filter(([k]) => permitidas.has(k))
      )
  );

  const titulo = info.titulo?.trim() || "Resumo da turma";

  // desfecho (0124): a chave entra em dados pela mesma RPC com senha —
  // agregado do recorte do relatório; momento com n < 5 já vem suprimido
  const momentosDesfecho = montaDesfechoCard(
    parseDesfechoAgregado(
      (abertura.dados as Record<string, unknown> | undefined)?.desfecho
    )
  );

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <main className="flex flex-1 flex-col px-4 py-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="w-full">
          <header className="mx-auto max-w-6xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-realiza.png" alt="Realiza.vc" width={1920} height={262} className="h-7 w-auto" />
            <p className="mt-1.5 text-xs text-muted-foreground">Programa de Mentoria Social</p>
          </header>

          <div className="mx-auto mt-6 max-w-6xl">
            <h1 className="text-xl font-semibold">{titulo}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dados vivos, atualizados em {formatDateTime(new Date().toISOString())}.
              Link não listado. Trate como documento interno.
            </p>
          </div>

          <div className="mt-5 border-y border-border bg-card/40 py-3 sm:-mx-4 sm:px-4">
            <div className="mx-auto max-w-6xl">
              <RelatorioCanvas
                key={`resumo-${slug}-${cfg.tipo}`}
                colunas={colunas}
                linhas={linhasPodadas}
                storageKey={`resumo-${slug}-${cfg.tipo}`}
              />
            </div>
          </div>

          {momentosDesfecho.length > 0 && (
            <div className="mx-auto mt-5 max-w-6xl">
              <ResumoDesfechoCard momentos={momentosDesfecho} />
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
