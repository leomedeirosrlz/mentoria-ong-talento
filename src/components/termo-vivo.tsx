"use client";

import { useState, type ReactNode } from "react";
import {
  AssinaturaForm,
  type CivisDigitados,
} from "@/components/assinatura-form";
import {
  AutorizacaoDoc,
  TermoMentorandoDoc,
  TermoVoluntarioDoc,
} from "@/components/termo-doc";
import { civisPreview } from "@/lib/documentos/texto";
import type { DadosCivis } from "@/lib/types";

type Resultado = { error?: string; ok?: boolean };

/** Variante do documento renderizado acima do form. */
export type DocTermo = "voluntario" | "mentorando" | "autorizacao";

/** CivisDigitados → o que os docs aceitam (o parentesco é da autorização
 *  e não entra no preâmbulo dos termos). */
function civisVivos(v: CivisDigitados): Partial<DadosCivis> {
  return {
    nome_civil: v.nome_civil,
    rg: v.rg,
    cpf: v.cpf,
    data_nascimento: v.data_nascimento,
    endereco: v.endereco,
  };
}

/** Documento vivo — o texto interpola cada campo conforme a pessoa digita
 *  (REALIZA-497): quem assina vê o próprio nome/RG/endereço no documento
 *  em vez de "______". O que falta continua blank sublinhado, como no
 *  papel; o snapshot e o PDF seguem o que a action recebeu. */
function DocVivo({
  doc,
  vivo,
  alvoNome,
  id,
  continuar,
}: {
  doc: DocTermo;
  vivo: CivisDigitados;
  alvoNome?: string;
  id?: string;
  continuar?: { href: string; rotulo: string };
}) {
  if (doc === "autorizacao") {
    return (
      <AutorizacaoDoc
        dados={{
          mentorado_nome: alvoNome ?? "",
          responsavel: {
            ...civisPreview(vivo),
            parentesco: vivo.parentesco ?? "______",
          },
        }}
        id={id}
        continuar={continuar}
      />
    );
  }
  const Doc = doc === "mentorando" ? TermoMentorandoDoc : TermoVoluntarioDoc;
  return <Doc civis={civisVivos(vivo)} id={id} continuar={continuar} />;
}

/** Documento + seção de dados/assinatura em par vivo — páginas públicas
 *  (/assinar/[token]) e a logada (app/assinar). O AssinaturaForm reemite
 *  o retrato dos civis a cada tecla/autocomplete e o documento interpola
 *  na hora: ninguém assina às cegas vendo lacuna pro dado que acabou de
 *  preencher embaixo. */
export function TermoVivo({
  doc,
  civis,
  alvoNome,
  acao,
  etapas,
  docId,
  secaoId,
  className,
  secaoClasse,
  cabecalho,
  formClasse = "mt-6",
}: {
  doc: DocTermo;
  /** ficha civil já conhecida — prefill do form e início do preview */
  civis?: (DadosCivis & { parentesco?: string | null }) | null;
  /** nome do jovem — autorização usa no preâmbulo e no campo read-only */
  alvoNome?: string;
  acao: (fd: FormData) => Promise<Resultado>;
  /** o "3 · Assine" dentro do form (âncora do índice de etapas) */
  etapas?: boolean;
  docId?: string;
  secaoId?: string;
  className?: string;
  secaoClasse?: string;
  /** título + instrução que abrem a seção de dados (vêm do server) */
  cabecalho: ReactNode;
  formClasse?: string;
}) {
  const [vivo, setVivo] = useState<CivisDigitados>(() => ({
    nome_civil: civis?.nome_civil ?? null,
    rg: civis?.rg ?? null,
    cpf: civis?.cpf ?? null,
    data_nascimento: civis?.data_nascimento ?? null,
    endereco: {
      logradouro: civis?.endereco?.logradouro ?? null,
      numero: civis?.endereco?.numero ?? null,
      complemento: civis?.endereco?.complemento ?? null,
      bairro: civis?.endereco?.bairro ?? null,
      cidade: civis?.endereco?.cidade ?? null,
      uf: civis?.endereco?.uf ?? null,
      cep: civis?.endereco?.cep ?? null,
    },
    parentesco: civis?.parentesco ?? null,
  }));

  return (
    <div className={className}>
      <DocVivo
        doc={doc}
        vivo={vivo}
        alvoNome={alvoNome}
        id={docId}
        continuar={
          secaoId
            ? { href: `#${secaoId}`, rotulo: "Continuar para seus dados ↓" }
            : undefined
        }
      />
      <section id={secaoId} className={secaoClasse}>
        {cabecalho}
        <div className={formClasse}>
          <AssinaturaForm
            modo={doc === "autorizacao" ? "autorizacao" : "termo"}
            alvoNome={alvoNome}
            acao={acao}
            dados={civis}
            parentesco={civis?.parentesco ?? undefined}
            etapas={etapas}
            onMudanca={setVivo}
          />
        </div>
      </section>
    </div>
  );
}

/** Passo de termo nos wizards de primeiro acesso — o mesmo documento vivo,
 *  com a chamada "Seus dados para assinar" e o form sem submit próprio: o
 *  primário mora no rodapé fixo e submete via `form={formId}` (REALIZA-497 —
 *  o "Assinar" sempre à vista, "Assinar depois" como secundário). `dados`
 *  alimenta o prefill e o preview inicial (ficha civil ou o que o wizard
 *  já coletou); `civis` decide a chamada quando a ficha veio completa. */
export function PassoTermo({
  doc,
  civis,
  dados,
  acao,
  demo,
  formId,
  onSucesso,
  onPendingChange,
}: {
  doc: "voluntario" | "mentorando";
  civis?: DadosCivis | null;
  dados?: DadosCivis | null;
  acao: (fd: FormData) => Promise<Resultado>;
  demo?: boolean;
  formId: string;
  onSucesso?: () => void;
  onPendingChange?: (p: boolean) => void;
}) {
  const [vivo, setVivo] = useState<CivisDigitados>(() => ({
    nome_civil: dados?.nome_civil ?? null,
    rg: dados?.rg ?? null,
    cpf: dados?.cpf ?? null,
    data_nascimento: dados?.data_nascimento ?? null,
    endereco: {
      logradouro: dados?.endereco?.logradouro ?? null,
      numero: dados?.endereco?.numero ?? null,
      complemento: dados?.endereco?.complemento ?? null,
      bairro: dados?.endereco?.bairro ?? null,
      cidade: dados?.endereco?.cidade ?? null,
      uf: dados?.endereco?.uf ?? null,
      cep: dados?.endereco?.cep ?? null,
    },
    parentesco: null,
  }));

  return (
    <div className="space-y-4">
      <DocVivo
        doc={doc}
        vivo={vivo}
        continuar={{
          href: "#ob-termo-dados",
          rotulo: "Continuar para seus dados ↓",
        }}
      />
      <div
        id="ob-termo-dados"
        className="scroll-mt-[calc(6rem+env(safe-area-inset-top))] space-y-2"
      >
        <h2 className="text-base font-semibold">Seus dados para assinar</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {civis
            ? "Já temos seus dados do cadastro: confira, corrija se preciso e assine."
            : "Pra assinar precisamos dos seus dados civis: preencha como no documento de identidade. Eles entram no termo exatamente como digitados."}{" "}
          {demo
            ? "Na demonstração a assinatura é simulada: nada sai do seu navegador."
            : doc === "mentorando"
              ? "Eles ficam restritos à coordenação e ao termo."
              : "Eles ficam restritos à coordenação e ao termo, não aparecem no seu perfil."}
        </p>
      </div>
      <AssinaturaForm
        id={formId}
        modo="termo"
        acao={acao}
        dados={dados}
        semBotao
        onMudanca={setVivo}
        onPendingChange={onPendingChange}
        onSucesso={onSucesso}
      />
    </div>
  );
}
