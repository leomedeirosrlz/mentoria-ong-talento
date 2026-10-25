import Link from "next/link";
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { efetivoDe, pedidoEmAberto } from "@/lib/jovem-especialista";
import type { SolicitacaoEspecialista } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

/** Seção Especialistas da home: aparece só quando há uma ação pra pessoa.
 *  Prioridade: sugestão esperando resposta > contraproposta na negociação >
 *  sessão da trilha sem horário. Sem ação a seção some; o catálogo segue no
 *  menu ("Especialistas"). `disponivel` falso = profile sem ficha de mentorado. */
export function JovemEspecialistas({
  disponivel,
  solicitacoes,
  trilha,
}: {
  disponivel: boolean;
  solicitacoes: SolicitacaoEspecialista[];
  /** Resumo da trilha de especialista em curso (a página escolhe a mais
   *  "viva"). null = nenhuma trilha ativa/pausada. */
  trilha: {
    tema: string;
    /** Primeiro nome do especialista. */
    espNome: string;
    /** Passo do guia da próxima sessão (1..5). */
    sessao: number;
    /** ISO da próxima sessão marcada/remarcada — null = sem horário ainda. */
    proxima: string | null;
    pausada: boolean;
  } | null;
}) {
  if (!disponivel) return null;

  const sugestao = solicitacoes.find((s) => s.status === "sugerida");
  const contraproposta = solicitacoes.find(
    (s) => pedidoEmAberto(s) && efetivoDe(s) === "contra_proposta"
  );

  let acao: React.ReactNode = null;
  if (sugestao) {
    const quem = (sugestao.solicitante?.nome ?? "Seu mentor").split(" ")[0];
    acao = (
      <Acao href="/jovem/especialistas" titulo="1 sugestão esperando você">
        {quem} sugeriu um especialista pra você. Veja quem é e responda.
      </Acao>
    );
  } else if (contraproposta) {
    acao = (
      <Acao href="/jovem/especialistas#pedidos" titulo="1 negociação esperando você">
        Seu pedido está em negociação de horário. Veja a proposta.
      </Acao>
    );
  } else if (trilha && !trilha.pausada && !trilha.proxima) {
    acao = (
      <Acao
        href="/jovem/especialistas#trilhas"
        titulo={`A sessão ${trilha.sessao} ainda precisa de horário`}
      >
        {trilha.tema} com {trilha.espNome}. Escolham o horário.
      </Acao>
    );
  }

  if (!acao) return null;

  return (
    <section aria-labelledby="esp-titulo" className="space-y-3">
      <h2 id="esp-titulo" className="flex items-center gap-2 font-semibold">
        <Sparkle size={18} className="text-muted-foreground" aria-hidden />
        Especialistas
      </h2>
      <Card className="animate-enter">
        <CardContent className="p-0">{acao}</CardContent>
      </Card>
    </section>
  );
}

function Acao({
  href,
  titulo,
  children,
}: {
  href: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-11 items-center gap-3 rounded-xl px-5 py-3.5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {children}
        </span>
      </span>
      <ArrowRight
        size={16}
        aria-hidden
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
