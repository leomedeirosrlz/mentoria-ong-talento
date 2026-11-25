// Classe de dispositivo da telemetria de produto — a heurística nasceu
// na tentativa de registro (REALIZA-217) e o beacon de adoção
// (REALIZA-433) mede a mesma coisa no meta.dev do pageview. Módulo
// próprio porque tentativa-registro.ts puxa o client do supabase —
// importar de lá arrastaria o supabase-js inteiro pro chunk do beacon.
// Puro e client-safe: dispositivoDe não toca globals (o wrapper lê).

/** Classe de experiência de tela — casa com o CHECK do banco em
 *  tentativas_registro.dispositivo. */
export type ClasseDispositivo = "mobile" | "desktop" | "tablet";

/** Mede a experiência de tela, não o hardware — pura, recebe os sinais
 *  (o wrapper lê os globals): UA móvel/tablet primeiro (iPadOS 13+ se
 *  anuncia como Mac — o fator toque desempata), e uma janela desktop
 *  estreita conta como mobile porque é essa a leitura que o redesign
 *  "1 minuto no celular" precisa. */
export function dispositivoDe(
  ua: string,
  touchPoints: number,
  viewportWidth: number | null
): ClasseDispositivo {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  const touchMac = /macintosh/i.test(ua) && touchPoints > 1;
  if (
    /mobi|android|iphone|ipod|blackberry|windows phone/i.test(ua) ||
    touchMac
  ) {
    return "mobile";
  }
  if (viewportWidth != null && viewportWidth < 768) return "mobile";
  return "desktop";
}

export function dispositivoAtual(): ClasseDispositivo {
  if (typeof navigator === "undefined") return "desktop";
  return dispositivoDe(
    navigator.userAgent,
    navigator.maxTouchPoints,
    typeof window === "undefined" ? null : window.innerWidth
  );
}
