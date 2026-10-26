"use client";

// Seletor de contexto de turma (REALIZA-73): "Todas as turmas" + uma opção
// por turma navegável, no header das páginas cobertas. Trocar escreve o
// cookie `turma_foco` e faz router.replace com `?turma=` — a URL fica
// honesta (quem copia o link leva o contexto junto) e os demais params da
// página se preservam. A escrita do cookie mora no client de propósito:
// render de página server não seta cookie de response — `document.cookie`
// é o mesmo mecanismo do tema (tema.ts) e dos cookies demo_*.

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { turmaAno, turmaLonga } from "@/lib/turma";
import {
  gravarTurmaFocoClient,
  lerTurmaFocoClient,
  TURMA_TODAS,
  type TurmaFoco,
} from "@/lib/turma-contexto";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** "Turma 1 · 2026/2027" — a forma longa + o período; fora do padrão, o
 *  label cru. (Não é turmaCurta: o seletor fala o nome por extenso.) */
function rotuloTurma(turma: string): string {
  const ano = turmaAno(turma);
  return ano ? `${turmaLonga(turma)} · ${ano}` : turmaLonga(turma);
}

/** Espelha o foco resolvido no server pro cookie `turma_foco` — é aqui que
 *  `?turma=` vira persistência: origem "param" grava o label, origem
 *  "todas" limpa. "invalido" não toca (link errado não destrói a
 *  preferência) e "cookie"/"padrao" são no-op — nada novo pra gravar. */
function useTurmaFocoSync(foco: Pick<TurmaFoco, "turma" | "origem">) {
  const { turma, origem } = foco;
  useEffect(() => {
    if (origem === "param" && turma != null) {
      if (lerTurmaFocoClient() !== turma) gravarTurmaFocoClient(turma);
    } else if (origem === "todas") {
      if (lerTurmaFocoClient() != null) gravarTurmaFocoClient(null);
    }
  }, [turma, origem]);
}

/** Versão headless do sync: página que honra `?turma=` mas tem controle
 *  próprio de turma (a /duplas filtra pelos chips locais) monta isto pra
 *  que aterrar num deep link `?turma=` também persista no cookie. */
export function TurmaFocoSync({
  foco,
}: {
  foco: Pick<TurmaFoco, "turma" | "origem">;
}) {
  useTurmaFocoSync(foco);
  return null;
}

export function TurmaContextoSelect({
  turmas,
  foco,
  className,
}: {
  /** labels navegáveis (`turmasDisponiveis`) — coordenação vê todas; o
   *  auxiliar recebe só as do escopo dele. */
  turmas: readonly string[];
  /** o foco resolvido pela página — `{ turma, origem }` do resolveTurmaFoco. */
  foco: Pick<TurmaFoco, "turma" | "origem">;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  useTurmaFocoSync(foco);

  const turma = foco.turma;
  // turma em foco fora das navegáveis (encerrada com contexto ativo) entra
  // na lista — é onde a pessoa está; tirar a opção quebraria o Select.
  const opcoes =
    turma != null && !turmas.includes(turma) ? [...turmas, turma] : turmas;

  function trocar(v: string | null) {
    const proxima = !v || v === TURMA_TODAS ? null : v;
    gravarTurmaFocoClient(proxima);
    // window.location.search (não useSearchParams) lê a URL no instante do
    // clique — sempre atual e sem exigir boundary de Suspense
    const params = new URLSearchParams(window.location.search);
    params.set("turma", proxima ?? TURMA_TODAS);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // 1 turma = a UI de sempre: nem seletor nem contexto mudam nada (regra
  // de silêncio). O sync acima já rodou — ainda assim a ?turma= aterrissa.
  if (opcoes.length < 2) return null;

  return (
    <Select
      value={turma ?? TURMA_TODAS}
      onValueChange={trocar}
      items={{
        [TURMA_TODAS]: "Todas as turmas",
        ...Object.fromEntries(opcoes.map((t) => [t, rotuloTurma(t)])),
      }}
    >
      <SelectTrigger
        size="sm"
        className={cn("w-full min-w-44 max-w-64 sm:w-auto", className)}
        aria-label="Turma em foco"
        aria-current={turma != null ? "page" : undefined}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TURMA_TODAS}>Todas as turmas</SelectItem>
        {opcoes.map((t) => (
          <SelectItem
            key={t}
            value={t}
            aria-current={turma === t ? "page" : undefined}
          >
            {rotuloTurma(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
