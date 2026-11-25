import type { Icon } from "@phosphor-icons/react";
import { linkSeguro } from "@/lib/ciclo";
import { sistemaDoDoc } from "@/lib/como-conduzir";
import type { Material } from "@/lib/types";
import {
  InstrumentoIcone,
  instrumentoVars,
} from "@/components/instrumento-icone";
import { cn } from "@/lib/utils";

// Capa do card de material (REALIZA-528): tipográfica e derivada do
// título — o feedback aposentou o iframe da 1ª página do PDF (não pinta
// no Android/iOS e onde pinta 96px de recorte era ilegível) e a faixa
// genérica de ícone. A gramática é a do DocumentoHero miniaturizada:
// kicker caps + título + barra de acento. A superfície muda por destino:
// doc de instrumento ganha a tinta --inst-* do sistema (mesmo selo da
// Linha), doc nativo e arquivo ficam no ink+lima do capa-doc (a capa
// oficial da casa) e link externo fica neutro. Imagem segue <img> real —
// é o único preview "de verdade" barato que restou. Sem destino, a
// faixa de ícone de sempre. Tudo decorativo (aria-hidden): o nome
// acessível é o link do card.

// mesma allowlist de imagem do upload (material-actions) — a coluna é
// escrita só pelo app
const EXT_IMG = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

// pr-9 reserva o canto do chip ⋯ que flutua right-2 top-2 sobre a capa
const KICKER = "pr-9 text-[10px] font-semibold uppercase tracking-[0.14em]";
const TITULO = "line-clamp-2 text-sm font-semibold leading-snug";
const BARRA = "mt-1.5 block h-[3px] w-8 rounded-full";

export function CapaMaterial({ m, Icone }: { m: Material; Icone: Icon }) {
  const ehDoc = m.path?.startsWith("doc:") ?? false;
  const sistema = ehDoc ? sistemaDoDoc(m.path!.slice(4)) : null;
  const urlOk = linkSeguro(m.url);

  // imagem real — o único preview genuíno que vale a rede
  if (m.path && EXT_IMG.test(m.path)) {
    return (
      <div aria-hidden className="h-24 overflow-hidden bg-muted/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/material/${m.id}`}
          alt=""
          loading="lazy"
          decoding="async"
          className="pointer-events-none h-full w-full object-cover object-top"
        />
      </div>
    );
  }

  if (!ehDoc && !m.path && !urlOk) {
    // "em breve"/"sem conteúdo" — a faixa de ícone de sempre (o card do
    // jovem nunca chega aqui: os sem destino moram no grupo "A caminho")
    return (
      <div
        aria-hidden
        className="grid h-24 place-items-center bg-muted/60 text-muted-foreground"
      >
        <Icone size={20} weight="duotone" aria-hidden />
      </div>
    );
  }

  if (sistema) {
    // doc de instrumento ao vivo — a tinta do instrumento, com o glifo
    // sangrando no canto como a capa da estante do jovem
    return (
      <div
        aria-hidden
        style={instrumentoVars(sistema)}
        className="relative flex h-24 flex-col justify-between overflow-hidden bg-[var(--ict)] p-3"
      >
        <span className="absolute -right-3 -top-3 text-[var(--ic)] opacity-[0.16]">
          <InstrumentoIcone instrumento={sistema} size={72} neutro />
        </span>
        <p className={cn(KICKER, "text-[var(--ic)]")}>instrumento oficial</p>
        <div>
          <p className={TITULO}>{m.titulo}</p>
          <span aria-hidden className={cn(BARRA, "bg-[var(--ic)]")} />
        </div>
      </div>
    );
  }

  if (ehDoc || m.path) {
    // doc nativo ou arquivo — o ink + glow lima do capa-doc, a identidade
    // dos materiais oficiais. O kicker distingue: "documento" pro doc:,
    // a extensão pro arquivo ("PDF", "DOCX")
    const ext =
      ehDoc || !m.path
        ? null
        : (m.path.match(/\.([a-z0-9]{2,5})$/i)?.[1].toUpperCase() ??
          "arquivo");
    return (
      <div
        aria-hidden
        className="capa-doc relative flex h-24 flex-col justify-between overflow-hidden p-3"
      >
        <p className={cn(KICKER, "text-[var(--destaque)]")}>
          {ehDoc ? "documento" : ext}
        </p>
        <div>
          <p className={cn(TITULO, "text-zinc-100")}>{m.titulo}</p>
          <span
            aria-hidden
            className={cn(
              BARRA,
              "bg-gradient-to-r from-[var(--brand-lime)] to-[var(--info)]"
            )}
          />
        </div>
      </div>
    );
  }

  // link externo — a capa neutra com o destino no kicker (o host que o
  // PreviewLink já ensinava)
  let host = urlOk!;
  try {
    host = new URL(urlOk!).hostname.replace(/^www\./, "");
  } catch {
    // URL inválida não devia passar do linkSeguro — cai no texto cru
  }
  return (
    <div
      aria-hidden
      className="relative flex h-24 flex-col justify-between overflow-hidden bg-muted/60 p-3"
    >
      <p className={cn(KICKER, "truncate text-muted-foreground")}>{host}</p>
      <div>
        <p className={TITULO}>{m.titulo}</p>
        <span aria-hidden className={cn(BARRA, "bg-muted-foreground/30")} />
      </div>
    </div>
  );
}
