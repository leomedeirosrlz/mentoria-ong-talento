// Ponte "pedir pra Liza" (REALIZA-388): a bolha é um FAB persistente no
// AppShell — páginas e botões não têm ref pro painel, então o pedido vai
// por CustomEvent. A AssistenteBolha escuta, abre o painel e envia a
// pergunta pelo mesmo caminho do chip do balão (enviar registrado na
// conversa, keepMounted garante o callback pronto).

export const LIZA_PEDIDO_EVENTO = "realiza:liza-pedido";

export function pedirALiza(pergunta: string) {
  window.dispatchEvent(
    new CustomEvent(LIZA_PEDIDO_EVENTO, { detail: { pergunta } })
  );
}
