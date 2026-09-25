"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleNotch, Signature } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DadosCivis } from "@/lib/types";

type Resultado = { error?: string; ok?: boolean };

const cpfMask = (v: string) =>
  v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const cepMask = (v: string) =>
  v.replace(/(\d{5})(\d{3})/, "$1-$2");

/** Campos civis do signatário — compartilhados pelo termo do voluntário
 *  (logado), pela autorização do responsável (token) e pela ficha de
 *  cadastro (0046 — `opcional` porque a coordenação pode não ter tudo na
 *  mão ainda; a exigência real acontece no ato da assinatura). Os nomes
 *  dos inputs são o contrato com parseDadosCivis em actions-assinaturas.ts
 *  — `prefix` distingue o bloco do responsável na ficha do mentorado.
 *  `defaults` preenche com o que já está na ficha (prefill de 0046).
 *  `compacto` (cadastro) omite nome civil/nascimento/cidade/UF — a ficha
 *  já pede esses, o parser do action junta tudo no jsonb. */
export function DadosCivisFields({
  defaults,
  opcional,
  prefix = "",
  compacto,
}: {
  defaults?: DadosCivis | null;
  opcional?: boolean;
  prefix?: string;
  compacto?: boolean;
}) {
  const req = opcional ? undefined : true;
  const n = (k: string) => `${prefix}${k}`;
  const e = defaults?.endereco;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {!compacto && (
        <div className="sm:col-span-2">
          <Label htmlFor={n("nome_civil")}>Nome civil completo</Label>
          <Input
            id={n("nome_civil")}
            name={n("nome_civil")}
            required={req}
            autoComplete="name"
            defaultValue={defaults?.nome_civil ?? ""}
          />
        </div>
      )}
      <div>
        <Label htmlFor={n("rg")}>RG</Label>
        <Input
          id={n("rg")}
          name={n("rg")}
          required={req}
          placeholder="12.345.678-9"
          defaultValue={defaults?.rg ?? ""}
        />
      </div>
      <div>
        <Label htmlFor={n("cpf")}>CPF</Label>
        <Input
          id={n("cpf")}
          name={n("cpf")}
          required={req}
          inputMode="numeric"
          placeholder="000.000.000-00"
          defaultValue={defaults?.cpf ? cpfMask(defaults.cpf) : ""}
        />
      </div>
      {!compacto && (
        <div>
          <Label htmlFor={n("data_nascimento")}>Data de nascimento</Label>
          <Input
            id={n("data_nascimento")}
            name={n("data_nascimento")}
            type="date"
            defaultValue={defaults?.data_nascimento ?? ""}
          />
        </div>
      )}
      <div>
        <Label htmlFor={n("cep")}>CEP</Label>
        <Input
          id={n("cep")}
          name={n("cep")}
          required={req}
          inputMode="numeric"
          placeholder="00000-000"
          defaultValue={e?.cep ? cepMask(e.cep) : ""}
        />
      </div>
      <div className="sm:col-span-2 grid grid-cols-[1fr_100px] gap-4">
        <div>
          <Label htmlFor={n("logradouro")}>Logradouro</Label>
          <Input
            id={n("logradouro")}
            name={n("logradouro")}
            required={req}
            placeholder="Rua, avenida…"
            defaultValue={e?.logradouro ?? ""}
          />
        </div>
        <div>
          <Label htmlFor={n("numero")}>Número</Label>
          <Input
            id={n("numero")}
            name={n("numero")}
            required={req}
            defaultValue={e?.numero ?? ""}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={n("complemento")}>Complemento</Label>
        <Input
          id={n("complemento")}
          name={n("complemento")}
          placeholder="Opcional"
          defaultValue={e?.complemento ?? ""}
        />
      </div>
      <div>
        <Label htmlFor={n("bairro")}>Bairro</Label>
        <Input
          id={n("bairro")}
          name={n("bairro")}
          required={req}
          defaultValue={e?.bairro ?? ""}
        />
      </div>
      {!compacto && (
        <>
          <div>
            <Label htmlFor={n("cidade")}>Cidade</Label>
            <Input
              id={n("cidade")}
              name={n("cidade")}
              required={req}
              defaultValue={e?.cidade ?? ""}
            />
          </div>
          <div>
            <Label htmlFor={n("uf")}>UF</Label>
            <Input
              id={n("uf")}
              name={n("uf")}
              required={req}
              maxLength={2}
              placeholder="SP"
              className="uppercase"
              defaultValue={e?.uf ?? ""}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** Form de assinatura — o preview do documento fica por conta da página;
 *  aqui são os dados civis, o aceite e o nome digitado. `acao` é a server
 *  action (assinarTermo logado / assinarComToken por link). */
export function AssinaturaForm({
  modo,
  alvoNome,
  acao,
  dados,
  parentesco,
  etapas,
}: {
  modo: "termo" | "autorizacao";
  /** nome do jovem (autorização) — read-only, vem do servidor */
  alvoNome?: string;
  acao: (formData: FormData) => Promise<Resultado>;
  /** dados civis já na ficha (0046) — o form nasce preenchido, a pessoa só
   *  confere/corrige e digita o nome */
  dados?: DadosCivis | null;
  /** parentesco já cadastrado (autorização) */
  parentesco?: string;
  /** passo a passo numerado da página — quando ativo, o bloco final ganha
   *  o título "3 · Assine" com a âncora que o índice de etapas aponta */
  etapas?: boolean;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      setErro(null);
      const res = await acao(fd);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      toast.success("Documento assinado.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {modo === "autorizacao" && (
        <>
          <div>
            {/* rotula um <p> read-only — <p> em vez de <Label> órfão */}
            <p className="text-sm font-medium">Jovem autorizado(a)</p>
            <p className="mt-1.5 rounded-lg bg-muted px-3 py-2.5 text-sm font-medium">
              {alvoNome}
            </p>
          </div>
          <div>
            <Label htmlFor="parentesco">Seu parentesco com o(a) jovem</Label>
            <Input
              id="parentesco"
              name="parentesco"
              required
              placeholder="Mãe, pai, avó, tio…"
              defaultValue={parentesco ?? ""}
            />
          </div>
        </>
      )}

      <DadosCivisFields defaults={dados} />

      {etapas && (
        <h3
          id="assinar"
          className="scroll-mt-4 border-t border-border pt-5 text-sm font-semibold"
        >
          3 · Assine
        </h3>
      )}

      <label className="flex items-start gap-3 rounded-xl border border-input bg-muted/40 p-4 text-sm leading-relaxed">
        <input
          type="checkbox"
          name="aceite"
          required
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span>
          Li o documento acima e declaro que as informações são verdadeiras.
          Entendo que esta assinatura eletrônica tem a mesma validade de uma
          assinatura em papel.
        </span>
      </label>

      <div>
        <Label htmlFor="assinatura_texto">Assinatura: digite seu nome completo</Label>
        <Input
          id="assinatura_texto"
          name="assinatura_texto"
          required
          autoComplete="name"
          placeholder="Como consta no documento"
          className="font-medium italic"
        />
      </div>

      {erro && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <Button type="submit" disabled={pending} className="justify-center">
        {pending ? (
          <CircleNotch size={16} className="animate-spin" aria-hidden />
        ) : (
          <Signature size={16} aria-hidden />
        )}
        {pending ? "Assinando…" : "Assinar eletronicamente"}
      </Button>
    </form>
  );
}
