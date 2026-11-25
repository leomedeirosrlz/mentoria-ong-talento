// Pedido de magic link persistido na sessionStorage: sem isto um reload ou
// reabertura da aba de /login matava a espera — a tela voltava pro form e o
// clique no e-mail publicava tokens num nonce que ninguém mais lia. O pedido
// (nonce + e-mail + momento do envio) volta pro poll e a página retoma de
// onde parou. sessionStorage, não localStorage: o pedido é da ABA, e um
// resgate cross-tab duplicaria o consumo do handoff de uso único.

export type PedidoLogin = {
  /** nonce que viaja no link (?h=) e casa com a row do login_handoffs */
  h: string;
  /** e-mail do pedido — o resgate só entra se a sessão bater (anti-fixação) */
  email: string;
  /** Date.now() do envio — régua da janela e do cooldown pós-reload */
  em: number;
};

// o link OTP vale 1h (otp_expiry=3600 no GoTrue); +10min de margem pra aba
// do e-mail ainda conseguir abrir/publicar depois de um clique no limite
export const JANELA_PEDIDO = 70 * 60 * 1000;

// cooldown do reenvio do GoTrue — conta a partir do envio real, não da tela
const COOLDOWN_RESEND_MS = 60 * 1000;

const CHAVE = "login:pedido";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function store(): Storage | null {
  try {
    // modo privado pode negar até o ACESSO ao objeto (get joga) — daí o try
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

/** Valida o que veio do storage: JSON com o shape certo, h uuid, e-mail e
 *  em dentro da janela. Tudo que sai do storage é suspeito — a validação é
 *  pura pra ficar testável sem DOM. */
export function pedidoDeJson(
  raw: string | null,
  agora = Date.now()
): PedidoLogin | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<PedidoLogin> | null;
    if (
      p != null &&
      typeof p.h === "string" &&
      UUID_RE.test(p.h) &&
      typeof p.email === "string" &&
      p.email.length > 0 &&
      typeof p.em === "number" &&
      Number.isFinite(p.em) &&
      agora - p.em <= JANELA_PEDIDO
    ) {
      return { h: p.h, email: p.email, em: p.em };
    }
  } catch {
    // cai no null abaixo — JSON quebrado é pedido inválido
  }
  return null;
}

/** Lê o pedido vivo — nulo ou inválido remove a chave (row podre não fica
 *  atrapalhando o próximo pedido). Falha de storage devolve null. */
export function lerPedido(agora = Date.now()): PedidoLogin | null {
  try {
    const st = store();
    if (!st) return null;
    const pedido = pedidoDeJson(st.getItem(CHAVE), agora);
    if (!pedido) st.removeItem(CHAVE);
    return pedido;
  } catch {
    return null;
  }
}

/** Grava SÓ no sucesso do signInWithOtp — gravar num 429 orfanaria o nonce
 *  do link anterior (que ainda pode ser clicado). */
export function gravarPedido(pedido: PedidoLogin): void {
  try {
    store()?.setItem(CHAVE, JSON.stringify(pedido));
  } catch {
    // storage negado: o pedido segue vivo só em memória — melhor que nada
  }
}

/** Toda saída terminal do funil passa por aqui: resgate, falha, expiração,
 *  e-mail trocado ou pedido novo. Pedido órfão ressuscitaria uma espera
 *  morta no próximo mount. */
export function limparPedido(): void {
  try {
    store()?.removeItem(CHAVE);
  } catch {
    // simétrico ao gravar — ignorar
  }
}

/** Segundos de cooldown de reenvio que restam depois de um reload — sem
 *  isso a tela restaurada oferecia reenvio imediato e o GoTrue devolvia 429. */
export function cooldownRestante(em: number, agora = Date.now()): number {
  return Math.max(0, Math.ceil((em + COOLDOWN_RESEND_MS - agora) / 1000));
}
