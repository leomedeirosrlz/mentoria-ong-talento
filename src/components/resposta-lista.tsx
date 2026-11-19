import type { ReactNode } from "react";
import {
  camposPerguntas,
  respostaFormatada,
  type FormularioCampo,
  type RespostaValor,
} from "@/lib/forms/schema";
import { agrupaEmSecoes } from "@/lib/forms/instrumentos";
import { Badge } from "@/components/ui/badge";
import {
  NumeroPergunta,
  PERGUNTA_TEXTO,
  RESPOSTA_TEXTO,
} from "@/components/forms/pergunta";
import { cn } from "@/lib/utils";

// Lista pergunta → resposta de um formulário (leitura pós-envio): as
// seções viram eyebrows separando grupos, cada pergunta carrega o número
// que tinha na definição do form (a "pergunta 3" da resposta é a 3 do
// /f/<token>, mesmo quando uma opcional ficou vazia e some da lista).
// Substituí os pares dt/dd ad hoc — dialog do jovem, acordeões de
// respostas da coordenação e a visão narrativa do instrumento. Componente
// puro: serve a server e a client components.

type LinhaResposta = {
  id: string;
  /** posição entre as perguntas da definição — undefined nas órfãs */
  n?: number;
  label: ReactNode;
  valor: string;
  /** dd customizado (ex.: link de anexo) — vence o texto formatado */
  extra?: ReactNode;
};

/** O valor conta como resposta? "—" (respostaFormatada sem valor) e
 *  string vazia não; dd customizado (renderValor) mantém a linha mesmo
 *  com valor cru vazio. */
function respondida(l: Pick<LinhaResposta, "valor" | "extra">): boolean {
  return l.extra != null || (l.valor !== "—" && l.valor.trim() !== "");
}

/** Órfã: a pergunta saiu do modelo e o tipo se perdeu — formata pelo
 *  formato do valor. Objeto nunca vira "—" muda: anexo mostra o nome,
 *  grade mostra a contagem (a linha NUNCA some — o CSV já fazia assim). */
function valorOrfaFormatado(v: RespostaValor): string {
  if (v == null) return "—";
  if (v === "sim") return "Sim";
  if (v === "nao") return "Não";
  if (Array.isArray(v)) return v.filter((x) => x != null).join(", ");
  if (typeof v === "object") {
    const o = v as { nome?: string; horas?: unknown[]; celulas?: unknown[] };
    if (typeof o.nome === "string" && o.nome) return o.nome;
    const n = (o.horas ?? o.celulas)?.length ?? 0;
    return n ? `${n} opções marcadas` : "resposta registrada";
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T12:00:00-03:00`);
    if (!isNaN(d.getTime()))
      return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  return String(v);
}

export function RespostaLista({
  campos,
  respostas,
  className,
  renderValor,
}: {
  /** definição do form — vazio/undefined cai no recorte cru das
   *  respostas (rótulo = id do campo) */
  campos: FormularioCampo[] | undefined;
  respostas: Record<string, RespostaValor>;
  className?: string;
  /** dd sob medida por campo (o link de download do 'arquivo' no
   *  intake). Devolver null/undefined usa o valor formatado. */
  renderValor?: (
    campo: FormularioCampo | undefined,
    valor: RespostaValor | undefined
  ) => ReactNode;
}) {
  const defs = campos ?? [];

  // sem definição: recorte cru do que veio no payload (resposta de
  // instrumento cujo form não viajou junto)
  if (!defs.length) {
    const cruas = Object.entries(respostas).filter(
      ([, v]) => v != null && String(v).trim() !== ""
    );
    if (!cruas.length) {
      return (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o detalhe desta resposta.
        </p>
      );
    }
    return (
      <dl className={cn("space-y-3", className)}>
        {cruas.map(([id, v]) => (
          <div key={id}>
            <dt className={PERGUNTA_TEXTO}>{id.replace(/_/g, " ")}</dt>
            <dd className={cn("mt-1 whitespace-pre-wrap", RESPOSTA_TEXTO)}>
              {renderValor?.(undefined, v) ?? respostaFormatada(undefined, v)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  const numeroPorId = new Map(
    camposPerguntas(defs).map((c, i) => [c.id, i + 1])
  );
  const campoPorId = new Map(defs.map((c) => [c.id, c]));

  // blocos na ordem da definição — a 'secao' abre o grupo (eyebrow) e
  // não espera resposta; pergunta sem resposta some da lista
  const blocos: {
    secao: FormularioCampo | null;
    hint?: string;
    linhas: LinhaResposta[];
  }[] = agrupaEmSecoes(defs)
    .map((b) => ({
      secao: b.secao,
      linhas: b.campos
        .map((c): LinhaResposta => ({
          id: c.id,
          n: numeroPorId.get(c.id),
          label: c.label,
          valor: respostaFormatada(c, respostas[c.id]),
          extra: renderValor?.(c, respostas[c.id]) ?? undefined,
        }))
        .filter(respondida),
    }))
    .filter((b) => b.linhas.length > 0);

  // resposta de pergunta removida da definição: o enunciado original não
  // é guardado (a edição sobrescreve `campos`), então a evidência vai num
  // bloco próprio com o id do campo como pista do assunto
  const orfas: LinhaResposta[] = Object.entries(respostas)
    .filter(([id, v]) => !campoPorId.has(id) && v != null)
    .map(([id, v]): LinhaResposta => {
      const extra = renderValor?.(undefined, v) ?? undefined;
      return {
        id,
        label: (
          <>
            {id.replace(/_/g, " ")}
            <Badge
              variant="outline"
              className="ml-1.5 align-middle font-normal text-muted-foreground"
            >
              pergunta removida
            </Badge>
          </>
        ),
        valor: valorOrfaFormatado(v),
        extra,
      };
    })
    .filter(respondida);
  if (orfas.length)
    blocos.push({
      secao: {
        id: "__removidas__",
        tipo: "secao",
        label: "Respondidas antes de a pergunta sair do modelo",
        obrigatorio: false,
      },
      hint: "O texto original da pergunta não fica guardado. O nome do campo ajuda a identificar o assunto.",
      linhas: orfas,
    });

  if (!blocos.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar o detalhe desta resposta.
      </p>
    );
  }

  return (
    <div className={cn("divide-y divide-border/60", className)}>
      {blocos.map((b, i) => (
        <div key={b.secao?.id ?? `b${i}`} className="py-3 first:pt-0 last:pb-0">
          {b.secao && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {b.secao.label}
            </p>
          )}
          {b.hint && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {b.hint}
            </p>
          )}
          <dl className={cn("space-y-3", b.secao && "mt-2.5")}>
            {b.linhas.map((l) => (
              <div key={l.id}>
                <dt className={cn("flex items-start gap-2.5", PERGUNTA_TEXTO)}>
                  {l.n != null && <NumeroPergunta n={l.n} compacto />}
                  <span className="min-w-0 flex-1 pt-0.5">{l.label}</span>
                </dt>
                <dd
                  className={cn(
                    "mt-1 whitespace-pre-wrap",
                    RESPOSTA_TEXTO,
                    // resposta alinha com o enunciado, não com o disco
                    l.n != null && "pl-[34px]"
                  )}
                >
                  {l.extra ?? l.valor}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
