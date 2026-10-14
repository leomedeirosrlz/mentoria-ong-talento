"use client";

import {
  startTransition,
  useEffect,
  useState,
  useTransition,
} from "react";
import { submeterRespostaFormulario } from "@/lib/forms/actions";
import {
  campoRespondido,
  coletaRespostas,
  ERRO_VALIDACAO,
  leDeValores,
  validaRespostas,
} from "@/lib/forms/resposta";
import {
  camposPerguntas,
  type FormularioCampo,
  type RespostaValor,
} from "@/lib/forms/schema";

export type RespostaApi = {
  /** mapa campo_id → valor — a fonte única dos instrumentos sob medida */
  valores: Record<string, RespostaValor>;
  /** grava (ou remove, com undefined/"") a resposta de um campo, persiste
   *  o rascunho e limpa o erro do campo — o "onChange" dos instrumentos */
  definir: (id: string, v: RespostaValor | undefined) => void;
  erros: Record<string, string>;
  erro: string | null;
  enviado: boolean;
  pending: boolean;
  /** campos com resposta — progresso do shell */
  respondidos: number;
  total: number;
  perguntas: FormularioCampo[];
  preview: boolean;
  /** handler do <form> — valida, foca o primeiro erro e envia pela action */
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

/** Estado controlado da resposta dos instrumentos sob medida: rascunho
 *  em localStorage (mesma chave/formato do form genérico), validação
 *  espelhada da RPC e envio pela mesma server action — o contrato de
 *  submissão não muda. */
export function useResposta({
  token,
  campos,
  preview = false,
  formEl,
}: {
  token: string;
  campos: FormularioCampo[];
  preview?: boolean;
  /** o <form> em state do chamador (ref={setFormEl} no JSX dele): o
   *  submit lê o honeypot e rola até o primeiro erro — fica no componente
   *  e não na bag devolvida pra nenhum objeto do api virar "ref" pro
   *  lint do React Compiler */
  formEl: HTMLFormElement | null;
}): RespostaApi {
  const perguntas = camposPerguntas(campos);
  const chaveRascunho = preview ? null : `rascunho:/f/${token}`;

  const [valores, setValores] = useState<Record<string, RespostaValor>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [pending, start] = useTransition();

  // rascunho uma vez no mount — estado controlado, então restaurar é só
  // hidratar o mapa (nada de cutucar DOM como no renderer genérico). A
  // hidratação vai numa transition: o primeiro paint sai vazio e o
  // rascunho entra como update não-urgente, sem render em cascata.
  useEffect(() => {
    if (!chaveRascunho) return;
    try {
      const raw = localStorage.getItem(chaveRascunho);
      if (raw)
        startTransition(() => {
          setValores(JSON.parse(raw) as Record<string, RespostaValor>);
        });
    } catch {
      // storage indisponível ou rascunho corrompido — o form segue vazio
    }
  }, [chaveRascunho]);

  function definir(id: string, v: RespostaValor | undefined) {
    setValores((prev) => {
      const next = { ...prev };
      if (v === undefined || v === "") delete next[id];
      else next[id] = v;
      if (chaveRascunho) {
        try {
          localStorage.setItem(chaveRascunho, JSON.stringify(next));
        } catch {
          // quota/storage desligado — o rascunho é conveniência
        }
      }
      return next;
    });
    setErros((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      // último campo marcado corrigido → o banner global de validação
      // sai junto (erro de servidor/rede não é afetado aqui)
      if (!Object.keys(next).length)
        setErro((e) => (e === ERRO_VALIDACAO ? null : e));
      return next;
    });
  }

  const respondidos = perguntas.reduce(
    (n, c) => n + (campoRespondido(c, valores[c.id]) ? 1 : 0),
    0
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) return;
    const { respostas, falhas } = coletaRespostas(
      perguntas,
      leDeValores(valores)
    );
    const mapa = validaRespostas(perguntas, respostas, falhas);
    if (Object.keys(mapa).length) {
      setErros(mapa);
      setErro(ERRO_VALIDACAO);
      const primeiro = perguntas.find((c) => mapa[c.id]);
      const alvo =
        primeiro &&
        formEl?.querySelector(`[data-campo="${CSS.escape(primeiro.id)}"]`);
      if (alvo) {
        alvo.scrollIntoView({ block: "center" });
        // o próprio alvo pode ser o controle (a linha role=slider da roda)
        // — senão procura o controle dentro dele
        const controle = alvo.matches("input, select, textarea, [role='slider']")
          ? (alvo as HTMLElement)
          : alvo.querySelector<HTMLElement>(
              "input, select, textarea, [role='slider']"
            );
        controle?.focus({ preventScroll: true });
      }
      return;
    }
    setErros({});
    setErro(null);
    start(async () => {
      try {
        const r = await submeterRespostaFormulario(
          token,
          respostas,
          // honeypot: input nomeado dentro do form — bots preenchem,
          // humanos não veem; o servidor finge sucesso e não grava
          formEl?.querySelector<HTMLInputElement>("input[name='website']")
            ?.value ?? ""
        );
        if (r.error) {
          setErro(r.error);
          return;
        }
        if (chaveRascunho) {
          try {
            localStorage.removeItem(chaveRascunho);
          } catch {
            /* idem a escrita — conveniência */
          }
        }
        setEnviado(true);
      } catch {
        setErro("Sem conexão. Confira a internet e tente de novo.");
      }
    });
  }

  return {
    valores,
    definir,
    erros,
    erro,
    enviado,
    pending,
    respondidos,
    total: perguntas.length,
    perguntas,
    preview,
    onSubmit,
  };
}
