"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AVALIACAO_LABEL,
  DIFICULDADE_LABEL,
} from "@/lib/ciclo";
import type { DuplaOpcao, FiltrosRegistro } from "@/lib/queries";

const TODAS = "todas";

/** Barra de filtros de /registros — estado na URL (searchParams), navegação
 *  por replace pra não sujar o histórico a cada tecla. */
export function RegistrosFiltros({
  filtros,
  duplas,
  maxEncontro,
}: {
  filtros: FiltrosRegistro;
  duplas: DuplaOpcao[];
  maxEncontro: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState(filtros.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  // params de fora (chip de triagem, limpar) sincronizam o campo de busca
  const qExterno = filtros.q ?? "";
  const [qSincronizado, setQSincronizado] = useState(qExterno);
  if (qExterno !== qSincronizado) {
    setQSincronizado(qExterno);
    setQ(qExterno);
  }

  function aplicar(patch: Record<string, string | null>) {
    const p = new URLSearchParams();
    const atual: Record<string, string | undefined> = {
      encontro: filtros.encontro ? String(filtros.encontro) : undefined,
      avaliacao: filtros.avaliacao,
      apoio: filtros.apoio ? "1" : undefined,
      dificuldade: filtros.dificuldade,
      dupla: filtros.dupla,
      q: filtros.q,
      ...patch,
    };
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    const qs = p.toString();
    router.replace(`/registros${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    if (q === (filtros.q ?? "")) return;
    timer.current = setTimeout(() => {
      aplicar({ q: q || null });
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aplicar depende dos filtros; só q dispara
  }, [q]);

  const triggerCls = "w-full sm:w-auto sm:min-w-36";

  return (
    <div
      role="search"
      aria-label="Filtrar registros"
      className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
    >
      <div className="relative col-span-2 sm:flex-1 sm:min-w-52">
        <MagnifyingGlass
          size={15}
          aria-hidden
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar tema, reflexão ou observação"
          aria-label="Buscar no conteúdo dos registros"
          className="pl-8"
        />
      </div>
      <Select
        value={filtros.encontro ? String(filtros.encontro) : TODAS}
        onValueChange={(v) =>
          aplicar({ encontro: v === TODAS ? null : String(v) })
        }
      >
        <SelectTrigger className={triggerCls} aria-label="Filtrar por encontro">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS}>Todos os encontros</SelectItem>
          {Array.from({ length: maxEncontro }, (_, i) => i + 1).map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}º encontro
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filtros.avaliacao ?? TODAS}
        onValueChange={(v) =>
          aplicar({ avaliacao: v === TODAS ? null : String(v) })
        }
      >
        <SelectTrigger className={triggerCls} aria-label="Filtrar por avaliação">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS}>Toda avaliação</SelectItem>
          {Object.entries(AVALIACAO_LABEL).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filtros.dificuldade ?? TODAS}
        onValueChange={(v) =>
          aplicar({ dificuldade: v === TODAS ? null : String(v) })
        }
      >
        <SelectTrigger className={triggerCls} aria-label="Filtrar por dificuldade">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS}>Toda dificuldade</SelectItem>
          <SelectItem value="com">Qualquer dificuldade</SelectItem>
          {Object.entries(DIFICULDADE_LABEL).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filtros.dupla ?? TODAS}
        onValueChange={(v) => aplicar({ dupla: v === TODAS ? null : String(v) })}
      >
        <SelectTrigger
          className={`${triggerCls} col-span-2 sm:min-w-56`}
          aria-label="Filtrar por dupla"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS}>Todas as duplas</SelectItem>
          {duplas.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.mentor?.nome ?? "—"} e {d.mentorado?.nome ?? "—"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
