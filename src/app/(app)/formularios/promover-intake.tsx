"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleNotch, UserCheck } from "@phosphor-icons/react";
import {
  finalizarPromocaoIntake,
  promoverRespostaIntake,
} from "@/lib/forms/actions";
import type { PrefillIntake } from "@/lib/forms/intake";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Promoção de inscrição → cadastro (REALIZA-70), em dois passos humanos:
// 1) "Revisar e cadastrar" lê a resposta no servidor e mostra o que vira
//    cadastro (prefill puro de intake.ts, recalculado lá);
// 2) "Cadastrar" confirma — finalizarPromocaoIntake insere profile
//    mentor_dpp + mentor_profiles e carimba a resposta (guard único).
// Nenhum passo grava sozinho: abrir o dialog não cria ninguém.

const GENERO_LABEL: Record<string, string> = {
  feminino: "Feminino",
  masculino: "Masculino",
  nao_binario: "Não binário",
  outro: "Outro",
  prefiro_nao_dizer: "Prefere não dizer",
};

const COR_LABEL: Record<string, string> = {
  branca: "Branca",
  negra: "Negra",
  parda: "Parda",
  amarela: "Amarela",
  indigena: "Indígena",
  outro: "Outra",
  prefiro_nao_dizer: "Prefere não dizer",
};

const PREF_LABEL: Record<string, string> = {
  feminino: "Mentorada mulher",
  masculino: "Mentorado homem",
  indiferente: "Sem preferência",
};

/** No intake de mentorados a preferência é sobre o mentor do par — o
 *  mesmo enum lido do outro lado (REALIZA-229). */
const PREF_LABEL_MENTORADO: Record<string, string> = {
  feminino: "Mentor mulher",
  masculino: "Mentor homem",
  indiferente: "Sem preferência",
};

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 flex-1 break-words">{valor}</span>
    </div>
  );
}

export function PromoverIntakeButton({ respostaId }: { respostaId: string }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<PrefillIntake | null>(null);
  const [sistema, setSistema] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ url: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  // a mesma dupla de passos serve as duas vias de intake (mentor × mentorado)
  const ehMentorado = sistema === "intake_mentorado";

  function abrir() {
    start(async () => {
      const r = await promoverRespostaIntake(respostaId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setPrefill(r.prefill!);
      setSistema(r.sistema ?? null);
      setPronto(null);
      setOpen(true);
    });
  }

  function confirmar() {
    start(async () => {
      const r = await finalizarPromocaoIntake(respostaId);
      if (r.error) {
        toast.error(r.error);
        setOpen(false);
        router.refresh();
        return;
      }
      if (r.aviso) toast.warning(r.aviso);
      toast.success("Cadastro criado a partir da inscrição.");
      setPronto({ url: r.url! });
      router.refresh();
    });
  }

  const nCelulas = prefill?.disponibilidade?.celulas.length ?? 0;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={abrir}
      >
        {pending ? (
          <CircleNotch className="animate-spin" aria-hidden />
        ) : (
          <UserCheck aria-hidden />
        )}
        Revisar e cadastrar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>
              {pronto ? "Cadastro criado" : "Cadastrar a partir da inscrição"}
            </DialogTitle>
            <DialogDescription>
              {pronto
                ? ehMentorado
                  ? "A pessoa entrou na base como mentorado(a), pronta pro matching."
                  : "A pessoa entrou na base como mentor(a) DPP, capacidade 1."
                : "Confira o que vira cadastro. O restante da inscrição (trajetória, documentos, horários finos) segue gravado na resposta."}
            </DialogDescription>
          </DialogHeader>
          {pronto ? (
            <div className="py-2">
              <Link
                href={pronto.url}
                className="text-sm font-medium underline underline-offset-4"
              >
                Abrir a ficha da pessoa
              </Link>
            </div>
          ) : (
            prefill && (
              <div className="scroll-fina max-h-72 space-y-1.5 overflow-y-auto py-1 pr-1">
                <Linha rotulo="Nome" valor={prefill.nome} />
                <Linha rotulo="Nome social" valor={prefill.nome_social} />
                <Linha rotulo="E-mail" valor={prefill.email} />
                <Linha rotulo="WhatsApp" valor={prefill.whatsapp} />
                <Linha rotulo="Nascimento" valor={prefill.data_nascimento} />
                <Linha rotulo="Gênero" valor={GENERO_LABEL[prefill.genero] ?? null} />
                <Linha rotulo="Cor/raça" valor={COR_LABEL[prefill.cor_raca] ?? null} />
                <Linha
                  rotulo="Cidade/UF"
                  valor={
                    [prefill.cidade, prefill.uf].filter(Boolean).join(" · ") ||
                    null
                  }
                />
                <Linha
                  rotulo="Preferência de par"
                  valor={
                    (ehMentorado ? PREF_LABEL_MENTORADO : PREF_LABEL)[
                      prefill.pref_genero_par
                    ] ?? null
                  }
                />
                {/* ficha de mentor × mentorado: os campos abaixo só existem
                    na via de mentores (o form do jovem não pergunta grade
                    nem trajetória profissional) */}
                {!ehMentorado && (
                  <>
                    <Linha rotulo="Cargo" valor={prefill.cargo} />
                    <Linha rotulo="Empresa" valor={prefill.empresa} />
                    <Linha
                      rotulo="Disponibilidade"
                      valor={
                        nCelulas
                          ? `${nCelulas} faixa${nCelulas === 1 ? "" : "s"} marcada${nCelulas === 1 ? "" : "s"}`
                          : "Não informada"
                      }
                    />
                    <Linha rotulo="Experiência" valor={prefill.experiencia_previa} />
                    <Linha rotulo="Formação" valor={prefill.formacao_externa} />
                  </>
                )}
                <Linha rotulo="Motivação" valor={prefill.motivacao} />
              </div>
            )
          )}
          <DialogFooter>
            {pronto ? (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Voltar
                </Button>
                <Button onClick={confirmar} disabled={pending}>
                  {pending ? (
                    <CircleNotch className="animate-spin" aria-hidden />
                  ) : null}
                  {pending ? "Cadastrando…" : ehMentorado ? "Cadastrar mentorado(a)" : "Cadastrar mentor(a)"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
