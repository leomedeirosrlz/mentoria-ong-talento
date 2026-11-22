"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleNotch, Signature } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCpf } from "@/lib/utils";
import { STATUS_CEP, useBuscaCep } from "@/lib/use-busca-cep";
import type { ViaCepEndereco } from "@/lib/viacep";
import type { DadosCivis, Endereco } from "@/lib/types";

type Resultado = { error?: string; ok?: boolean };

/** Retrato dos dados civis conforme digitados no form — alimenta o preview
 *  vivo do documento (o que falta volta a virar blank sublinhado, como no
 *  papel). `parentesco` só existe no modo autorização. */
export type CivisDigitados = {
  nome_civil: string | null;
  rg: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  endereco: Endereco;
  parentesco: string | null;
};

/** máscara live no input uncontrolled — reformat a cada tecla */
const onInputMask = (mask: (v: string) => string) => (e: React.FormEvent<HTMLInputElement>) => {
  e.currentTarget.value = mask(e.currentTarget.value);
};
const cpfMask = maskCpf;

/** Campos civis do signatário — compartilhados pelo termo do voluntário
 *  (logado), pela autorização do responsável (token) e pela ficha de
 *  cadastro (0046 — `opcional` porque a coordenação pode não ter tudo na
 *  mão ainda; a exigência real acontece no ato da assinatura). Os nomes
 *  dos inputs são o contrato com parseDadosCivis em actions-assinaturas.ts
 *  — `prefix` distingue o bloco do responsável na ficha do mentorado.
 *  `defaults` preenche com o que já está na ficha (prefill de 0046).
 *  `compacto` (cadastro) omite nome civil/nascimento/cidade/UF — a ficha
 *  já pede esses, o parser do action junta tudo no jsonb. `onEndereco`
 *  recebe o endereço resolvido pelo ViaCEP: no compacto o hospedeiro usa
 *  pra alimentar os campos simples cidade/UF que vivem fora do bloco. */
export function DadosCivisFields({
  defaults,
  opcional,
  prefix = "",
  compacto,
  onEndereco,
}: {
  defaults?: DadosCivis | null;
  opcional?: boolean;
  prefix?: string;
  compacto?: boolean;
  onEndereco?: (endereco: ViaCepEndereco) => void;
}) {
  const req = opcional ? undefined : true;
  const n = (k: string) => `${prefix}${k}`;
  const e = defaults?.endereco;
  // bloco de endereço controlado: o autofill do ViaCEP (REALIZA-37) precisa
  // escrever nos inputs — defaultValue não dá. Os `name`s seguem os mesmos,
  // então FormData e parseCivis não veem diferença nenhuma. A máquina da
  // busca (máscara, race-guard, status) mora no useBuscaCep compartilhado.
  const [end, setEnd] = useState({
    logradouro: e?.logradouro ?? "",
    numero: e?.numero ?? "",
    complemento: e?.complemento ?? "",
    bairro: e?.bairro ?? "",
    cidade: e?.cidade ?? "",
    uf: e?.uf ?? "",
  });
  const busca = useBuscaCep({
    cepInicial: e?.cep,
    onEndereco: (endereco) => {
      // numero/complemento nunca vêm do ViaCEP; em compacto cidade/UF
      // não renderizam aqui — o hospedeiro alimenta os campos simples
      // dele via onEndereco (só CEP novo dispara: edição manual segue
      // valendo até a próxima busca)
      setEnd((atual) => ({
        ...atual,
        logradouro: endereco.logradouro,
        bairro: endereco.bairro,
        ...(compacto
          ? {}
          : { cidade: endereco.cidade, uf: endereco.uf }),
      }));
      onEndereco?.(endereco);
    },
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {!compacto && (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={n("nome_civil")}>Nome civil completo</Label>
          <Input
            id={n("nome_civil")}
            name={n("nome_civil")}
            required={req}
            autoComplete="name"
            autoCapitalize="words"
            defaultValue={defaults?.nome_civil ?? ""}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={n("rg")}>RG</Label>
        <Input
          id={n("rg")}
          name={n("rg")}
          required={req}
          placeholder="12.345.678-9"
          autoComplete="off"
          defaultValue={defaults?.rg ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={n("cpf")}>CPF</Label>
        <Input
          id={n("cpf")}
          name={n("cpf")}
          required={req}
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          placeholder="000.000.000-00"
          onInput={onInputMask(maskCpf)}
          defaultValue={defaults?.cpf ? cpfMask(defaults.cpf) : ""}
        />
      </div>
      {!compacto && (
        <div className="space-y-2">
          <Label htmlFor={n("data_nascimento")}>Data de nascimento</Label>
          <Input
            id={n("data_nascimento")}
            name={n("data_nascimento")}
            type="date"
            autoComplete="bday"
            defaultValue={defaults?.data_nascimento ?? ""}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={n("cep")}>CEP</Label>
        <div className="relative">
          <Input
            id={n("cep")}
            name={n("cep")}
            required={req}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={9}
            placeholder="00000-000"
            value={busca.cep}
            onChange={(ev) => busca.onCepChange(ev.target.value)}
            onBlur={busca.onCepBlur}
            aria-describedby={n("cep_status")}
          />
          {busca.buscando && (
            <CircleNotch
              size={16}
              aria-hidden
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          )}
        </div>
        {busca.status !== "idle" && (
          <p
            id={n("cep_status")}
            aria-live="polite"
            className="text-xs text-muted-foreground"
          >
            {STATUS_CEP[busca.status]}
          </p>
        )}
      </div>
      {/* a 320px o grid fixo [1fr_100px] espremia o Logradouro em ~124px —
          número vira linha própria abaixo de 420px */}
      <div className="sm:col-span-2 grid grid-cols-1 min-[420px]:grid-cols-[1fr_100px] gap-4">
        <div className="space-y-2">
          <Label htmlFor={n("logradouro")}>Logradouro</Label>
          <Input
            id={n("logradouro")}
            name={n("logradouro")}
            required={req}
            placeholder="Rua, avenida…"
            autoComplete="street-address"
            autoCapitalize="words"
            value={end.logradouro}
            onChange={(ev) => setEnd({ ...end, logradouro: ev.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={n("numero")}>Número</Label>
          <Input
            id={n("numero")}
            name={n("numero")}
            required={req}
            value={end.numero}
            onChange={(ev) => setEnd({ ...end, numero: ev.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={n("complemento")}>Complemento</Label>
        <Input
          id={n("complemento")}
          name={n("complemento")}
          placeholder="Opcional"
          value={end.complemento}
          onChange={(ev) => setEnd({ ...end, complemento: ev.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={n("bairro")}>Bairro</Label>
        <Input
          id={n("bairro")}
          name={n("bairro")}
          required={req}
          autoComplete="address-level3"
          autoCapitalize="words"
          value={end.bairro}
          onChange={(ev) => setEnd({ ...end, bairro: ev.target.value })}
        />
      </div>
      {!compacto && (
        <>
          <div className="space-y-2">
            <Label htmlFor={n("cidade")}>Cidade</Label>
            <Input
              id={n("cidade")}
              name={n("cidade")}
              required={req}
              autoComplete="address-level2"
              autoCapitalize="words"
              value={end.cidade}
              onChange={(ev) => setEnd({ ...end, cidade: ev.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={n("uf")}>UF</Label>
            <Input
              id={n("uf")}
              name={n("uf")}
              required={req}
              maxLength={2}
              placeholder="SP"
              autoComplete="address-level1"
              className="uppercase"
              value={end.uf}
              onChange={(ev) =>
                setEnd({ ...end, uf: ev.target.value.toUpperCase() })
              }
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
  onSucesso,
  id,
  semBotao,
  onMudanca,
  onPendingChange,
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
  /** chamada depois do ok da action — o passo de termo do onboarding usa
   *  pra avançar pro fechamento (o router.refresh() interno continua; a
   *  instância do wizard sobrevive ao refresh e preserva o step) */
  onSucesso?: () => void;
  /** id do <form> — o botão externo do rodapé fixo submete via `form=` */
  id?: string;
  /** o primário mora no rodapé fixo do wizard — sem submit interno */
  semBotao?: boolean;
  /** cada tecla/autocomplete reemite o retrato dos civis — o preview do
   *  documento interpola o que já foi digitado (REALIZA-497) */
  onMudanca?: (d: CivisDigitados) => void;
  /** espelha `pending` pro rodapé fixo (desabilita/subtitui o primário) */
  onPendingChange?: (p: boolean) => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  /** FormData → retrato dos civis — mesmos `name`s do parseDadosCivis, só
   *  que tolerante: vazio vira null e o preview repõe o blank sublinhado. */
  function retrato(): CivisDigitados {
    const f = formRef.current;
    const s = (k: string) => String(f ? new FormData(f).get(k) ?? "" : "").trim();
    return {
      nome_civil: s("nome_civil") || null,
      rg: s("rg") || null,
      cpf: s("cpf").replace(/\D/g, "") || null,
      data_nascimento: s("data_nascimento") || null,
      endereco: {
        logradouro: s("logradouro") || null,
        numero: s("numero") || null,
        complemento: s("complemento") || null,
        bairro: s("bairro") || null,
        cidade: s("cidade") || null,
        uf: s("uf") || null,
        cep: s("cep").replace(/\D/g, "") || null,
      },
      parentesco: s("parentesco") || null,
    };
  }

  /** O autofill do ViaCEP escreve nos inputs controlados fora do ciclo de
   *  change — junta o endereço resolvido ao retrato atual e reemite. */
  function reportarAutofill(endereco: ViaCepEndereco) {
    const atual = retrato();
    onMudanca?.({
      ...atual,
      endereco: {
        ...atual.endereco,
        logradouro: endereco.logradouro,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
      },
    });
  }

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
      onSucesso?.();
    });
  }

  return (
    <form
      ref={formRef}
      id={id}
      onSubmit={onSubmit}
      onChange={() => onMudanca?.(retrato())}
      className="grid gap-6"
    >
      {modo === "autorizacao" && (
        <>
          <div className="space-y-2">
            {/* rotula um <p> read-only — <p> em vez de <Label> órfão */}
            <p className="text-sm font-medium">Jovem autorizado(a)</p>
            <p className="rounded-lg bg-muted px-3 py-2.5 text-sm font-medium">
              {alvoNome}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parentesco">Seu parentesco com o(a) jovem</Label>
            <Input
              id="parentesco"
              name="parentesco"
              required
              placeholder="Mãe, pai, avó, tio…"
              autoCapitalize="sentences"
              defaultValue={parentesco ?? ""}
            />
          </div>
        </>
      )}

      <DadosCivisFields defaults={dados} onEndereco={reportarAutofill} />

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

      <div className="space-y-2">
        <Label htmlFor="assinatura_texto">Assinatura: digite seu nome completo</Label>
        <Input
          id="assinatura_texto"
          name="assinatura_texto"
          required
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Como consta no documento"
          className="font-medium italic"
        />
      </div>

      {erro && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {/* w-full no mobile como todo CTA público — no desktop volta ao
          tamanho natural alinhado à esquerda do form. `semBotao`: no
          wizard o primário mora no rodapé fixo (submit via form=id) */}
      {!semBotao && (
        <Button type="submit" disabled={pending} className="w-full justify-center sm:w-auto sm:px-8">
          {pending ? (
            <CircleNotch size={16} className="animate-spin" aria-hidden />
          ) : (
            <Signature size={16} aria-hidden />
          )}
          {pending ? "Assinando…" : "Assinar eletronicamente"}
        </Button>
      )}
    </form>
  );
}
