/** Entrada de página por rota — mesmo contrato do (app)/template.tsx. Fica em
 *  jovem/, não no grupo (jovem): o layout (JovemShell, com a pill layoutId da
 *  nav e o NotificacoesProvider) mora aqui — um template no nível do grupo
 *  remontaria a shell inteira a cada navegação. .animate-enter é CSS puro:
 *  zero JS, coberto pelo guard de prefers-reduced-motion (§2). */
export default function JovemTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-enter">{children}</div>;
}
