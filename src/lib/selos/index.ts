import type { Icon } from "./fun";
import { FAMILIAS_A } from "./familias-a";
import { FAMILIAS_B } from "./familias-b";
import { INSTRUMENTOS } from "./instrumentos";
import { MARCOS } from "./marcos";
import { NIVEIS } from "./niveis";

/** Todo selo da casa pelo id (o `name` do Icon): o que arteDoGlifo devolve
 *  em lib/badges.ts. Um lugar só — o canvas, o teste e o `fi` leem daqui. */
export const ARTE: Readonly<Record<string, Icon>> = {
  ...NIVEIS,
  ...MARCOS,
  ...INSTRUMENTOS,
  ...FAMILIAS_A,
  ...FAMILIAS_B,
};
