import { fuzzyTrechos } from "@/lib/fuzzy";

/** Trechos do texto que bateram na busca (REALIZA-391): cada faixa casa
 *  vira <mark> no amarelo suave da marca — sutil, sem mudar a cor do
 *  texto. `query` vazia ou sem match devolve o texto puro. O match é
 *  tolerante (fuzzyTrechos): mostra os tokens que bateram neste campo
 *  mesmo que o item tenha entrado por outro (nome × e-mail, título ×
 *  descrição). */
export function HighlightText({ texto, query }: { texto: string; query: string }) {
  const trechos = fuzzyTrechos(query, texto);
  if (trechos.length === 0) return <>{texto}</>;
  const partes: React.ReactNode[] = [];
  let ate = 0;
  trechos.forEach(([ini, fim], i) => {
    if (ini > ate) partes.push(texto.slice(ate, ini));
    partes.push(
      <mark
        key={i}
        className="rounded-[3px] bg-[var(--destaque-suave)] px-px text-inherit"
      >
        {texto.slice(ini, fim)}
      </mark>
    );
    ate = fim;
  });
  if (ate < texto.length) partes.push(texto.slice(ate));
  return <>{partes}</>;
}
