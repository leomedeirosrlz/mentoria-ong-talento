"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FadeX } from "@/components/fade-x";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Seletor de mentorado (REALIZA-440): o nome do jovem vira o controle que
// filtra os instrumentos — pills-Link até o limiar (o mesmo padrão do
// seletor de instrumentos), dropdown do kit acima dele. A escolha mora em
// `?dupla=` — deep-linkável, e ela atravessa a navegação régua → página
// por instrumento. Com uma dupla só não há o que escolher: some (regra de
// silêncio do seletor de turma).

export type FichaMentor = {
  id: string;
  jovemNome: string;
  /** dupla pausada segue listada, com o estado no rótulo */
  pausada?: boolean;
};

const TODAS = "__todas__";
const LIMIAR_PILLS = 3;

const pillCls =
  "inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function hrefPara(hrefBase: string, duplaId: string | null): string {
  if (!duplaId || duplaId === TODAS) return hrefBase;
  const sep = hrefBase.includes("?") ? "&" : "?";
  return `${hrefBase}${sep}dupla=${duplaId}`;
}

export function MentoradoSeletor({
  fichas,
  selecionada,
  hrefBase,
  comTodas = false,
  className,
}: {
  fichas: FichaMentor[];
  /** a dupla em foco — null = sem filtro (só faz sentido com `comTodas`) */
  selecionada: string | null;
  /** a rota sem o param `dupla` — ex.: "/materiais?aba=instrumentos" ou
   *  "/materiais/instrumentos/roda_inicial" */
  hrefBase: string;
  /** inclui a opção "Todas as duplas" (na régua a escolha é sempre de
   *  uma dupla — sem "todas") */
  comTodas?: boolean;
  className?: string;
}) {
  const router = useRouter();
  if (fichas.length < 2) return null;

  const rotulo = (f: FichaMentor) =>
    f.pausada ? `${f.jovemNome} · pausada` : f.jovemNome;

  // muitos mentorados: as pills viram faixa longa demais — dropdown do
  // kit com o mesmo padrão "selecionar → URL" do seletor de turma
  if (fichas.length > LIMIAR_PILLS) {
    const items: [string, string][] = [
      ...(comTodas ? [[TODAS, "Todas as duplas"] as [string, string]] : []),
      ...fichas.map((f): [string, string] => [f.id, rotulo(f)]),
    ];
    const atual = selecionada ?? (comTodas ? TODAS : fichas[0]!.id);
    return (
      <Select
        value={atual}
        onValueChange={(v) =>
          router.replace(hrefPara(hrefBase, v), { scroll: false })
        }
        items={Object.fromEntries(items)}
      >
        <SelectTrigger
          size="sm"
          className={cn("w-full min-w-44 max-w-64 sm:w-auto", className)}
          aria-label="Mentorado em foco"
          aria-current={selecionada != null ? "page" : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(([v, l]) => (
            <SelectItem
              key={v}
              value={v}
              aria-current={atual === v ? "page" : undefined}
            >
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <FadeX
      tag="nav"
      aria-label="Filtrar por mentorado"
      className={cn(
        "-mx-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      <ul className="flex items-center gap-1 px-1 pb-1">
        {comTodas && (
          <li className="shrink-0">
            <Link
              href={hrefBase}
              scroll={false}
              aria-current={selecionada == null ? "page" : undefined}
              className={cn(
                pillCls,
                selecionada == null
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Todas
            </Link>
          </li>
        )}
        {fichas.map((f) => (
          <li key={f.id} className="shrink-0">
            <Link
              href={hrefPara(hrefBase, f.id)}
              scroll={false}
              aria-current={selecionada === f.id ? "page" : undefined}
              className={cn(
                pillCls,
                selecionada === f.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {rotulo(f)}
            </Link>
          </li>
        ))}
      </ul>
    </FadeX>
  );
}
