import { notFound } from "next/navigation";
import Link from "next/link";
import { montarRoteiroDoPlano } from "@/lib/plano-roteiros-servico";
import type { LadoPlano } from "@/lib/plano-servico";
import { parseDocBlocos } from "@/lib/doc-bloco-schema";
import {
  blocosParaJovem,
  roteiroForaDeVersao,
  rotuloStatusRoteiro,
} from "@/lib/plano-roteiros";
import { diaMes } from "@/lib/plano-combinado";
import { RoteiroDoc } from "@/components/roteiro-doc";
import { RoteiroEditor } from "@/components/roteiro-editor";
import { GerarRoteiroButton } from "@/components/roteiro-gerar-button";
import type {
  CicloEvento,
  Dupla,
  DuplaPlano,
  DuplaPlanoRoteiro,
} from "@/lib/types";

/** Corpo da rota do roteiro (020) — o mesmo pros dois públicos; só o
 *  "voltar" e o papel mudam. Vigente publicado vira leitura; rascunho
 *  abre o editor (todo mundo com acesso revisa e publica); semana sem
 *  roteiro mostra a prévia + o gesto da equipe. `?v=<id>` lê substituída. */
export async function RoteiroSemana({
  numero,
  versaoPedida,
  dupla,
  plano,
  roteiros,
  autores,
  eventos,
  lado,
  voltarHref,
  tituloDoc,
}: {
  numero: number;
  versaoPedida?: string;
  dupla: Dupla;
  plano: DuplaPlano | null;
  roteiros: readonly DuplaPlanoRoteiro[];
  autores: ReadonlyMap<string, string>;
  eventos: readonly CicloEvento[];
  lado: LadoPlano | null;
  voltarHref: string;
  tituloDoc: string;
}) {
  const rows = roteiros.filter(
    (x) => x.numero === numero && (!plano || x.plano_id === plano.id)
  );
  const doCombinado = plano?.escopo?.numeros?.includes(numero) === true;
  if (!rows.length && !doCombinado) notFound();

  const pedida =
    versaoPedida != null
      ? (rows.find((x) => x.id === versaoPedida) ?? null)
      : null;
  const atual =
    pedida ??
    rows.find((r) => r.status === "publicado") ??
    [...rows]
      .filter((r) => r.status === "rascunho")
      .sort((a, b) => b.versao - a.versao)[0] ??
    null;

  const autor = (id: string | null) =>
    id ? (autores.get(id)?.split(" ")[0] ?? "alguém da equipe") : null;
  const metaDe = (r: DuplaPlanoRoteiro) =>
    [
      rotuloStatusRoteiro(r),
      `gerado em ${diaMes(r.gerado_em.slice(0, 10))}`,
      autor(r.gerado_por) ? `por ${autor(r.gerado_por)}` : null,
      r.publicado_em
        ? `publicado em ${diaMes(r.publicado_em.slice(0, 10))}` +
          (autor(r.publicado_por) ? ` por ${autor(r.publicado_por)}` : "")
        : null,
      plano && roteiroForaDeVersao(r, plano)
        ? "de versão anterior do plano"
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const anteriores = rows
    .filter((x) => x.status === "substituido")
    .sort((a, b) => a.versao - b.versao);

  // QA 25/11: o doc é um só, mas a leitura do jovem corta o que é do(a)
  // mentor(a) — preparação, pós-encontro e a nota — e derruba os
  // checkboxes que não persistem
  const paraLado = (bs: ReturnType<typeof blocosParaJovem>) =>
    lado === "mentorado" ? blocosParaJovem(bs) : bs;

  return (
    <div className="space-y-4">
      {/* versões substituídas seguem legíveis — trilha do combinado */}
      {anteriores.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Versões anteriores:{" "}
          {anteriores.map((x, i) => (
            <span key={x.id}>
              {i > 0 && (i === anteriores.length - 1 ? " e " : ", ")}
              <Link
                href={`?v=${x.id}`}
                className="underline underline-offset-2"
              >
                v{x.versao}
              </Link>
            </span>
          ))}
        </p>
      )}

      {atual ? (
        <RoteiroDoc
          kicker={`${numero}º encontro · guia da dupla`}
          titulo={tituloDoc}
          meta={metaDe(atual)}
          blocos={paraLado(
            parseDocBlocos(atual.conteudo) ??
              // conteúdo inválido nunca renderiza: cai no guia do corpus
              (plano
                ? await montarRoteiroDoPlano(dupla, plano, numero, eventos)
                : [])
          )}
          voltar={{ href: voltarHref, rotulo: "Voltar" }}
        >
          {atual.status === "rascunho" && !pedida && (
            <RoteiroEditor
              duplaId={dupla.id}
              roteiroId={atual.id}
              updatedAt={atual.updated_at}
              numero={numero}
              blocos={parseDocBlocos(atual.conteudo) ?? []}
              podeRegerar={lado === "staff"}
            />
          )}
        </RoteiroDoc>
      ) : (
        <RoteiroDoc
          kicker={`${numero}º encontro · guia da dupla`}
          titulo={tituloDoc}
          destaque={
            lado === "staff"
              ? "A semana ainda não tem roteiro. A prévia abaixo é a montagem do guia com o contexto do plano."
              : "A semana ainda não tem roteiro. A equipe publica quando ele estiver pronto."
          }
          meta="Prévia · ainda não publicado"
          blocos={paraLado(
            plano
              ? await montarRoteiroDoPlano(dupla, plano, numero, eventos)
              : []
          )}
          voltar={{ href: voltarHref, rotulo: "Voltar" }}
        >
          {lado === "staff" && (
            <GerarRoteiroButton duplaId={dupla.id} numero={numero} />
          )}
        </RoteiroDoc>
      )}
    </div>
  );
}
