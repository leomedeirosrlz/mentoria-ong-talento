/** Entrada de página por rota: o template remonta a cada navegação (a chave é
 *  o caminho — a shell fica no layout, fora daqui, e a pill da nav viaja sem
 *  piscar), então o fade+y:4 do .animate-enter roda uma vez por troca de
 *  página. CSS puro — zero JS no caminho, e o guard global de
 *  prefers-reduced-motion zera a animação (§2). Âncoras internas (#sec-*) são
 *  scroll no mesmo documento, não navegação: não remontam nem regredem. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-enter">{children}</div>;
}
