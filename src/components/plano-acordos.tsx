"use client";

import { useState, useTransition } from "react";
import { Check, X, CalendarPlus } from "@phosphor-icons/react";
import {
  aplicarPassoPlano,
  responderPlano,
} from "@/lib/actions-plano";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** O que o card precisa do plano — a projeção mínima comum ao embed da
 *  ficha (DuplaPlano) e ao recorte do jovem (jovem_plano). */
export type PlanoCombinado = {
  id: string;
  status: string;
  versao: number;
  aprovado_lado: "mentor" | "mentorado" | null;
  escopo?: {
    ritmo?: number | null;
    passos?: { numero: number; data: string; acao?: string }[];
  } | null;
  passos?: { numero: number; data_nova: string }[];
};

/** Card do plano "ficar em dia" persistido (0219 — REALIZA-459): o
 *  combinado, não a sugestão — status, versão, ritmo e os passos com as
 *  datas combinadas. A mesma peça serve a ficha (mentor/equipe) e a
 *  agenda do jovem: responder e aplicar passo passam pelas RPCs do
 *  plano, que validam lado e janela no banco. */
export function PlanoAcordosCard({
  plano,
  duplaId,
  podeResponder,
  podeAplicar,
}: {
  plano: PlanoCombinado;
  /** id da dupla pra revalidar a ficha — o jovem não tem, e não
   *  precisa: a RPC valida pelo plano. */
  duplaId?: string;
  /** mentor/jovem respondem; equipe só acompanha */
  podeResponder: boolean;
  /** aplicar passo = agendar data combinada — mentor e jovem */
  podeAplicar: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [datas, setDatas] = useState<Record<number, string>>({});
  const aberto = ["proposto", "aceito", "ativo"].includes(plano.status);
  const aplicados = new Map(
    (plano.passos ?? []).map((p) => [p.numero, p])
  );
  const statusTexto: Record<string, string> = {
    proposto: "Proposto, esperando aceitar",
    aceito: "Aceito, combinando as datas",
    ativo: "Em andamento",
    concluido: "Concluído",
    expirado: "Expirado",
    contestado: "Contestado",
  };

  const responder = (acao: "aceitar" | "contestar") => {
    setErro(null);
    iniciar(async () => {
      const r = await responderPlano(plano.id, acao, undefined, duplaId);
      if ("error" in r) setErro(r.error);
    });
  };

  const aplicar = (numero: number) => {
    const v = datas[numero];
    if (!v) return;
    setErro(null);
    iniciar(async () => {
      const r = await aplicarPassoPlano(
        plano.id,
        numero,
        new Date(v).toISOString(),
        undefined,
        undefined,
        duplaId
      );
      if ("error" in r) setErro(r.error);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--destaque)]/15 px-2.5 py-0.5 text-xs font-semibold">
          {statusTexto[plano.status] ?? plano.status}
        </span>
        {plano.versao > 1 && (
          <span className="text-xs text-muted-foreground">
            versão {plano.versao}
          </span>
        )}
        {plano.escopo?.ritmo != null && (
          <span className="text-xs text-muted-foreground">
            {plano.escopo.ritmo === 1
              ? "1 encontro por semana"
              : `até ${plano.escopo.ritmo} encontros por semana`}
          </span>
        )}
      </div>

      <ol className="space-y-2">
        {(plano.escopo?.passos ?? []).map((p) => {
          const aplicado = aplicados.get(p.numero);
          return (
            <li key={p.numero} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{p.numero}º encontro</span>
              {aplicado ? (
                <span className="text-muted-foreground">
                  marcado pra{" "}
                  {new Date(aplicado.data_nova).toLocaleDateString("pt-BR")}
                </span>
              ) : (
                <>
                  <span className="text-muted-foreground">
                    sugestão {new Date(`${p.data}T12:00:00`).toLocaleDateString("pt-BR")}
                  </span>
                  {aberto && podeAplicar && plano.status !== "proposto" && (
                    <span className="flex items-center gap-1.5">
                      <Input
                        type="datetime-local"
                        aria-label={`Data do ${p.numero}º encontro`}
                        className="w-auto text-xs"
                        value={datas[p.numero] ?? ""}
                        onChange={(e) =>
                          setDatas((d) => ({ ...d, [p.numero]: e.target.value }))
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendente || !datas[p.numero]}
                        onClick={() => aplicar(p.numero)}
                      >
                        <CalendarPlus aria-hidden />
                        Confirmar
                      </Button>
                    </span>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {aberto && podeResponder && plano.status === "proposto" && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={pendente} onClick={() => responder("aceitar")}>
            <Check aria-hidden />
            Aceitar o combinado
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pendente}
            onClick={() => responder("contestar")}
          >
            <X aria-hidden />
            Não combina
          </Button>
        </div>
      )}
      {aberto && podeResponder && plano.status !== "proposto" && (
        <p className="text-xs text-muted-foreground">
          Aceito por{" "}
          {plano.aprovado_lado === "mentorado" ? "você" : "seu mentor"}.
          Se algo mudou, ainda dá pra contestar antes do próximo encontro.
        </p>
      )}
    </div>
  );
}
