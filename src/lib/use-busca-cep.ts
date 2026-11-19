"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { buscarCep } from "./actions-endereco";
import { maskCep } from "./utils";
import type { ViaCepEndereco } from "./viacep";

export type StatusCep = "idle" | "buscando" | "ok" | "nao_encontrado" | "falha";

/** Linha de status do CEP (aria-live): em repouso não há texto fixo — a
 *  transparência sobre a consulta mora em docs/lgpd/base-legal.md, não num
 *  hint in-situ. Os estados de busca dizem o que houve sem travar a
 *  digitação — autofill é conveniência, nunca portão. */
export const STATUS_CEP: Record<Exclude<StatusCep, "idle">, string> = {
  buscando: "Buscando endereço no ViaCEP…",
  ok: "Endereço preenchido. Confira e ajuste se precisar.",
  nao_encontrado: "CEP não encontrado. Preencha o endereço manualmente.",
  falha: "Não deu pra consultar o ViaCEP. Preencha o endereço manualmente.",
};

/** Autocomplete de endereço por CEP (REALIZA-37/443) — a máquina da busca
 *  compartilhada entre o bloco de dados civis e os forms que têm CEP
 *  próprio (onboarding): máscara progressiva, disparo ao completar 8
 *  dígitos, blur como rede de segurança pra colagem/autofill do browser e
 *  union de status pra UI anunciar. O endereço resolvido sai por
 *  `onEndereco`; quem escreve nos campos é sempre o hospedeiro.
 *
 *  O guard `cepBuscado` registra o CEP que disparou a busca em curso —
 *  resposta atrasada de CEP já editado é descartada e nunca sobrescreve o
 *  que está na tela. Uma busca por CEP, nunca por dígito nem repetição do
 *  mesmo; edição manual posterior sempre vence (até a próxima busca). */
export function useBuscaCep({
  onEndereco,
  cepInicial,
}: {
  onEndereco: (endereco: ViaCepEndereco) => void;
  /** CEP já salvo — nasce exibido sem disparar busca, e um blur sem
   *  mudança não consulta de novo. */
  cepInicial?: string | null;
}) {
  const [cep, setCep] = useState(cepInicial ? maskCep(cepInicial) : "");
  const [status, setStatus] = useState<StatusCep>("idle");
  const [buscando, start] = useTransition();
  const cepBuscado = useRef<string | null>(
    cepInicial ? cepInicial.replace(/\D/g, "") : null
  );
  // a resposta entrega pro callback vigente, não pro da renderização que
  // disparou — o hospedeiro pode ter remontado o passo no meio do voo
  const onEnderecoRef = useRef(onEndereco);
  useEffect(() => {
    onEnderecoRef.current = onEndereco;
  });

  function dispara(digitos: string) {
    cepBuscado.current = digitos;
    setStatus("buscando");
    start(async () => {
      const r = await buscarCep(digitos);
      if (cepBuscado.current !== digitos) return;
      if (r.kind === "ok") {
        onEnderecoRef.current(r.endereco);
        setStatus("ok");
      } else {
        setStatus(r.kind === "nao_encontrado" ? "nao_encontrado" : "falha");
      }
    });
  }

  function onCepChange(raw: string) {
    const v = maskCep(raw);
    setCep(v);
    const digitos = v.replace(/\D/g, "");
    if (digitos.length === 8) {
      if (digitos !== cepBuscado.current) dispara(digitos);
    } else {
      cepBuscado.current = null;
      setStatus("idle");
    }
  }

  function onCepBlur() {
    const digitos = cep.replace(/\D/g, "");
    if (digitos.length === 8 && digitos !== cepBuscado.current) {
      dispara(digitos);
    }
  }

  return { cep, status, buscando, onCepChange, onCepBlur };
}
