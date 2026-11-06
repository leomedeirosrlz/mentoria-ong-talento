// Miolo compartilhado dos fluxos de link de formulário — o dialog em massa
// (app/(app)/formularios/formulario-links) e o da ficha da dupla
// (components/enviar-formulario-dialog) usavam cópias que já tinham
// divergido; a fonte única mora aqui.
// Módulo PURO (sem hooks/imports de React): Server Components como
// respostas-section também importam daqui — useOrigem mora em use-origem.ts.

export const VALIDADE_OPCOES = [
  { v: "0", l: "Sem validade" },
  { v: "7", l: "Expira em 7 dias" },
  { v: "15", l: "Expira em 15 dias" },
  { v: "30", l: "Expira em 30 dias" },
  { v: "60", l: "Expira em 60 dias" },
] as const;

export function primeiroNome(nome: string | null | undefined): string {
  return nome?.split(" ")[0] ?? "";
}

/** URL do link público — montada no client porque o servidor não sabe a
 *  origem de deploy. Regra: quem chama NO RENDER passa `origem` (de
 *  useOrigem) pra SSR não quebrar (window não existe lá); em handler
 *  (click/copiar) pode omitir — window já está disponível.
 *  `caminho` deixa servir outros links públicos ("/assinar" pros termos). */
export function urlPublica(
  token: string,
  origem?: string | null,
  caminho = "/f"
): string {
  const base =
    origem ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${base}${caminho}/${token}`;
}

/** Convite único pros dois pontos de envio — o WhatsApp abre com o mesmo
 *  texto vindo da lista de links, do dialog em massa e da ficha da dupla.
 *  `origem` idem urlPublica. */
export function msgLinkWhatsApp(
  formularioTitulo: string,
  nome: string | null | undefined,
  token: string,
  origem?: string | null,
  /** Quando quem envia é o mentor da dupla (ficha, aba Instrumentos): a voz
   *  institucional "a equipe" vinda do número dele lê errado — ele assina
   *  como pessoa conhecida. Omitido = texto de equipe (coordenação). */
  remetenteMentorNome?: string
): string {
  const p = primeiroNome(nome);
  const url = urlPublica(token, origem);
  if (remetenteMentorNome !== undefined) {
    const m = primeiroNome(remetenteMentorNome);
    return `Olá${p ? `, ${p}` : ""}! ${m ? `Aqui é ${m}, seu mentor. ` : "Aqui é seu mentor. "}Pode responder "${formularioTitulo}" por aqui, leva poucos minutos: ${url}`;
  }
  return `Olá${p ? `, ${p}` : ""}! A equipe Realiza.vc te convida pra responder "${formularioTitulo}". Leva poucos minutos: ${url}`;
}

/** Fallback do lote: o WhatsApp do kit é do MENTOR porque o jovem não tem
 *  — o convite genérico mandaria a pessoa errada responder. O repasse diz
 *  de quem é o link e pede a ponte (paralelo ao emailInstrumentoRepasseMentor). */
export function msgLinkWhatsAppRepasse(
  formularioTitulo: string,
  mentorNome: string | null | undefined,
  jovemNome: string | null | undefined,
  token: string,
  origem?: string | null
): string {
  const m = primeiroNome(mentorNome);
  const j = primeiroNome(jovemNome) || "sua jovem";
  const url = urlPublica(token, origem);
  return `Olá${m ? `, ${m}` : ""}! Aqui é a equipe do Realiza.vc. O link de "${formularioTitulo}" é pra ${j}, que não tem WhatsApp cadastrado. Pode repassar pra ${j}? ${url}`;
}
