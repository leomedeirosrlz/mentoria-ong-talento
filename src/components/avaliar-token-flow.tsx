"use client";

import { useState } from "react";
import { CheckCircle, Flask, WifiSlash } from "@phosphor-icons/react";
import { EstadoCard } from "@/components/estado-card";
import { AvaliacaoEncontroForm } from "@/components/avaliacao-encontro-form";

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
  /** "Encontro N com Fulano · dd/mm/aaaa hh:mm" — montado no servidor. */
  contexto: string | null;
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
      {contexto && (
        <p className="mb-4 text-center text-xs text-muted-foreground">
          {contexto}
        </p>
      )}
      <AvaliacaoEncontroForm
        token={token}
        trilha={trilha}
        primeiroNome={primeiroNome}
        onEnviado={() => setSubmeteu(true)}
      />
    </>
  );
}
