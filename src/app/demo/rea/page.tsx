"use client";

import { useEffect, useState, type ComponentType } from "react";
import { ReaBalao } from "@/components/rea/rea-balao";
import { ReaBlob } from "@/components/rea/rea-blob";
import { ReaDisco } from "@/components/rea/rea-disco";
import type { ReaEstado, ReaProps } from "@/components/rea/tipos";

/** Vitrine temporária dos três conceitos da Rea — escolha de conceito para a
 *  bolha do assistente. Remover depois da decisão (troca = trocar o import em
 *  assistente-bolha.tsx). */

const ESTADOS: { id: ReaEstado; label: string; dica: string }[] = [
  { id: "parado", label: "Parado", dica: "ocioso: pisca e segue o cursor" },
  { id: "atento", label: "Atento", dica: "hover/foco no FAB" },
  { id: "aberto", label: "Aberto", dica: "painel acabou de abrir" },
  { id: "consultando", label: "Consultando", dica: "ferramenta rodando" },
  { id: "escrevendo", label: "Escrevendo", dica: "resposta em streaming" },
  { id: "falando", label: "Falando", dica: "boca tagarela despejando resposta" },
  { id: "pronto", label: "Pronto", dica: "resposta pronta, painel fechado" },
  { id: "erro", label: "Erro", dica: "falha na resposta" },
  { id: "sonolento", label: "Sonolento", dica: "ocioso há muito tempo" },
];

const CONCEITOS: { nome: string; Comp: ComponentType<ReaProps> }[] = [
  { nome: "Disco", Comp: ReaDisco },
  { nome: "Blob", Comp: ReaBlob },
  { nome: "Balão", Comp: ReaBalao },
];

export default function ReaVitrine() {
  const [estado, setEstado] = useState<ReaEstado>("parado");
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (!auto) return;
    let i = ESTADOS.findIndex((e) => e.id === estado);
    const t = setInterval(() => {
      i = (i + 1) % ESTADOS.length;
      setEstado(ESTADOS[i].id);
    }, 2600);
    return () => clearInterval(t);
  }, [auto, estado]);

  const ativa = ESTADOS.find((e) => e.id === estado);

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-5 py-10">
      <header className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Vitrine temporária
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Rea: 3 conceitos</h1>
        <p className="text-sm text-muted-foreground">
          Mesma máquina de estados, três rostos. Escolha um estado abaixo e
          compare; os olhos seguem o cursor no estado parado.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {ESTADOS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              setEstado(e.id);
              setAuto(false);
            }}
            className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${
              estado === e.id
                ? "border-foreground/30 bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {e.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAuto((v) => !v)}
          className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${
            auto
              ? "border-[var(--brand-lime)] bg-[var(--brand-lime)] text-[var(--brand-ink)]"
              : "border-dashed border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {auto ? "Ciclando…" : "Ciclar sozinho"}
        </button>
      </div>
      {ativa && (
        <p className="-mt-4 text-xs text-muted-foreground">
          {ativa.label}: {ativa.dica}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {CONCEITOS.map(({ nome, Comp }) => (
          <section
            key={nome}
            className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card px-4 py-8"
          >
            <h2 className="text-base font-semibold">{nome}</h2>
            <div className="flex items-end gap-6">
              <div className="flex flex-col items-center gap-1.5">
                <Comp estado={estado} tamanho={72} />
                <span className="text-[11px] text-muted-foreground">72</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <Comp estado={estado} tamanho={44} />
                <span className="text-[11px] text-muted-foreground">44 · FAB</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <Comp estado={estado} tamanho={34} />
                <span className="text-[11px] text-muted-foreground">34 · chip</span>
              </div>
            </div>
          </section>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        O Blob é bichinho: faz carinho entrando e saindo rapidinho umas 4x
        (ou deixando a mão parada em cima ~2s) que ele fica tímido de olho
        fechado; insiste mais e cochila; cutuca 3x e ele fica emburrado,
        vira o rosto e faz bico; 5+ e fica tonto de olho apertado.
      </p>
      <p className="text-xs text-muted-foreground">
        Trocar o conceito no produto = trocar o import em
        assistente-bolha.tsx. Hoje está ReaBlob.
      </p>
    </main>
  );
}
