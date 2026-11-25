import { Children, type ReactElement } from "react";

// Elemento passado por prop pra um Client Component chega do servidor como
// lazy element do Flight (react#32392): o wrapper expõe `$$typeof`
// react.lazy e nenhum `.type`/`.props` — `cloneElement` nele sai com
// `type` undefined e o render quebra ("Element type is invalid").
// `Children.toArray` resolve o lazy no elemento real — a mesma gambiarra
// do `render` do Base UI (useRenderElement). Elemento normal passa direto.
const REACT_LAZY = Symbol.for("react.lazy");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function elementoReal(el: ReactElement<any>): ReactElement<any> {
  if ((el as { $$typeof?: symbol }).$$typeof !== REACT_LAZY) return el;
  const r = Children.toArray(el)[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (r as ReactElement<any>) ?? el;
}
