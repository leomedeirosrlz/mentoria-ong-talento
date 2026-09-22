"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleNotch, Signature } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Resultado = { error?: string; ok?: boolean };

/** Campos civis do signatário — compartilhados pelo termo do voluntário
 *  (logado) e pela autorização do responsável (token). Os nomes dos inputs
 *  são o contrato com parseDadosCivis em actions-assinaturas.ts. */
export function DadosCivisFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="nome_civil">Nome civil completo</Label>
        <Input id="nome_civil" name="nome_civil" required autoComplete="name" />
      </div>
      <div>
        <Label htmlFor="rg">RG</Label>
        <Input id="rg" name="rg" required placeholder="12.345.678-9" />
      </div>
      <div>
        <Label htmlFor="cpf">CPF</Label>
        <Input id="cpf" name="cpf" required inputMode="numeric" placeholder="000.000.000-00" />
      </div>
      <div>
        <Label htmlFor="data_nascimento">Data de nascimento</Label>
        <Input id="data_nascimento" name="data_nascimento" type="date" />
      </div>
      <div>
        <Label htmlFor="cep">CEP</Label>
        <Input id="cep" name="cep" required inputMode="numeric" placeholder="00000-000" />
      </div>
      <div className="sm:col-span-2 grid grid-cols-[1fr_100px] gap-4">
        <div>
          <Label htmlFor="logradouro">Logradouro</Label>
          <Input id="logradouro" name="logradouro" required placeholder="Rua, avenida…" />
        </div>
        <div>
          <Label htmlFor="numero">Número</Label>
          <Input id="numero" name="numero" required />
        </div>
      </div>
      <div>
        <Label htmlFor="complemento">Complemento</Label>
        <Input id="complemento" name="complemento" placeholder="Opcional" />
      </div>
      <div>
        <Label htmlFor="bairro">Bairro</Label>
        <Input id="bairro" name="bairro" required />
      </div>
      <div>
        <Label htmlFor="cidade">Cidade</Label>
        <Input id="cidade" name="cidade" required />
      </div>
      <div>
        <Label htmlFor="uf">UF</Label>
        <Input id="uf" name="uf" required maxLength={2} placeholder="SP" className="uppercase" />
      </div>
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
}: {
  modo: "termo" | "autorizacao";
  /** nome do jovem (autorização) — read-only, vem do servidor */
  alvoNome?: string;
  acao: (formData: FormData) => Promise<Resultado>;
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
            <Label>Jovem autorizado(a)</Label>
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
            />
          </div>
        </>
      )}

      <DadosCivisFields />

      <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed">
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
        <Label htmlFor="assinatura_texto">Assinatura — digite seu nome completo</Label>
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
