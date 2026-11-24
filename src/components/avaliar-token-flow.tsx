"use client";

import { useState } from "react";
import { CheckCircle, Flask, WifiSlash } from "@phosphor-icons/react";
import { EstadoCard } from "@/components/estado-card";
import { AvaliacaoEncontroForm } from "@/components/avaliacao-encontro-form";
import { privacidadeAvaliacao } from "@/lib/avaliacao-privacidade";

/** Tronco do /avaliar/[token] que decide entre o form e o "já registrada"
 *  NO CLIENT — o submit bem-sucedido revalida a rota e a próxima render
 *  do servidor já vem com o link 'respondido'. Se o corte fosse no server
 *  component, o cartão terminal desmontaria o form na mesma resposta e a
 *  tela de sucesso ("Pode fechar esta página.") nunca apareceria. Como
 *  este componente ocupa a mesma posição nas duas renders, o estado
 *  `submeteu` sobrevive à revalidação e trava o cartão certo. */
export function AvaliarTokenFlow({
  token,
  trilha,
  jaRegistrada,
  primeiroNome,
  contexto,
  sessao = [],
  demo,
  retryHref,
}: {
  token: string;
  /** null = a leitura service-side do link falhou (rede) — o card de
   *  erro com retry é mais honesto que um form que não submeteria. */
  trilha: string | null;
  /** Link já consumido (ou avaliação respondida por outro canal) ANTES
   *  desta render — distinto do pós-submit, que é `submeteu`. */
  jaRegistrada: boolean;
  primeiroNome: string | null;
  /** "Encontro N com Fulano · terça-feira, 24/11 às 19:00" — montado no
   *  servidor ("data a confirmar" quando a data não resolveu). Sobe pro
   *  subtítulo do cabeçalho (022/US2). */
  contexto: string | null;
  /** Números de encontro que o link cobre (`cobertura` da row — [5,6] é
   *  sessão combinada da 018): com mais de um número o gesto é "a
   *  sessão", não "o encontro". */
  sessao?: number[];
  demo: boolean;
  retryHref: string;
}) {
  const [submeteu, setSubmeteu] = useState(false);

  if (jaRegistrada && !submeteu)
    return (
      <EstadoCard icon={CheckCircle} titulo="Avaliação já registrada" ok>
        <p>
          Você já contou como foi este encontro. Obrigado. Suas respostas
          ficam entre você e a equipe da Realiza.vc.
        </p>
      </EstadoCard>
    );

  if (!trilha)
    return (
      <EstadoCard
        icon={WifiSlash}
        titulo="Não foi possível carregar"
        acao={{ href: retryHref, label: "Tentar de novo" }}
      >
        <p>
          A conexão falhou no caminho. Não é problema com o seu link.
          Confira a internet e tente de novo.
        </p>
      </EstadoCard>
    );

  return (
    <>
      {/* a página pública não tem DemoBar — a faixa diz que é visualização
          antes do visitante descobrir no submit */}
      {demo && (
        <p className="mb-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Flask size={13} aria-hidden />
          Modo demonstração: respostas não são gravadas.
        </p>
      )}
      {/* 022/US2 — o cabeçalho da página, antes do form e na gramática
          do cartão de título do /f/: saudação → h1 do gesto → subtítulo
          com a linha `contexto` do servidor (data + dia da semana + hora)
          → h3 com a descrição + a linha de privacidade. Some quando
          `submeteu` — o h1 único da página passa a ser o do cartão de
          sucesso. O form entra embutido pra não duplicar saudação/h1. */}
      {!submeteu && (
        <div className="mb-3 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          <div aria-hidden className="h-1.5 bg-[var(--brand-lime)]" />
          <div className="p-5 sm:p-7">
            {primeiroNome && (
              <p className="text-sm font-medium text-[var(--ok-text)]">
                Olá, {primeiroNome}!
              </p>
            )}
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {trilha === "especialista" || sessao.length > 1
                ? "Como foi a sessão?"
                : "Como foi o encontro?"}
            </h1>
            {contexto && (
              <p className="mt-1 text-sm text-muted-foreground">
                {contexto}
              </p>
            )}
            <h3 className="mt-3 text-sm font-normal leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                1 minuto · só a nota é obrigatória.
              </span>{" "}
              {privacidadeAvaliacao(trilha)}
            </h3>
          </div>
        </div>
      )}
      <AvaliacaoEncontroForm
        token={token}
        trilha={trilha}
        primeiroNome={primeiroNome}
        embutido
        onEnviado={() => setSubmeteu(true)}
      />
    </>
  );
}
