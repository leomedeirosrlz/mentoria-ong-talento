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
  // filtros da prop congelam no render que armou o timer — o debounce leria
  // valores velhos e reverteria um Select trocado dentro dos 350ms
  const filtrosRef = useRef(filtros);
  useEffect(() => {
    filtrosRef.current = filtros;
  });
  // echo local: o Select mostra a escolha já, sem esperar o roundtrip do RSC
  const [echo, setEcho] = useState<Record<string, string | undefined>>({});

  // qualquer mudança de filtro (Select, chip de triagem, limpar, debounce)
  // resincroniza o estado local — eco só vale até a URL refletir a escolha
  const assinatura = JSON.stringify([
    filtros.encontro,
    filtros.avaliacao,
    filtros.apoio,
    filtros.dificuldade,
    filtros.dupla,
    filtros.q,
  ]);
  const [sync, setSync] = useState(assinatura);
  if (assinatura !== sync) {
    setSync(assinatura);
    setEcho({});
    setQ(filtros.q ?? "");
  }

  function aplicar(patch: Record<string, string | null>) {
    setEcho((e) => ({ ...e, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v ?? undefined])) }));
    const f = filtrosRef.current;
    const p = new URLSearchParams();
    const atual: Record<string, string | undefined> = {
      encontro: f.encontro ? String(f.encontro) : undefined,
      avaliacao: f.avaliacao,
      apoio: f.apoio ? "1" : undefined,
      dificuldade: f.dificuldade,
      dupla: f.dupla,
      q: f.q,
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

  // valor exibido: echo imediato se a chave foi tocada, senão o da URL
  const val = (
    k: "encontro" | "avaliacao" | "dificuldade" | "dupla",
    atual?: string | number | null
  ) => (k in echo ? echo[k] : atual != null ? String(atual) : TODAS) ?? TODAS;

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
        value={val("encontro", filtros.encontro)}
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
        value={val("avaliacao", filtros.avaliacao)}
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
        value={val("dificuldade", filtros.dificuldade)}
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
        value={val("dupla", filtros.dupla)}
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
