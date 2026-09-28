export { cn } from "cn"

/** minúsculas e sem acentos — "joao" encontra "João", "vila" encontra "Vila". */
export function normaliza(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Só dígitos — canonicalização de CPF/CEP/WhatsApp antes de gravar. */
export const soDigitos = (v: string) => v.replace(/\D/g, "");

/** Partículas de nomes pt que ficam minúsculas no meio do nome. */
const PARTICULAS_NOME = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Palavras curtas que são apelido/nome, não numeral romano ("Vi" de
 *  Vitória, "Li", "Di", "Mi", "Ci", "Xi" — mas "IV" de "João IV" passa). */
const NAO_ROMANO = new Set(["li", "vi", "mi", "di", "ci", "xi"]);

/** Nome próprio em title case pt-BR — "MARIA DE SOUZA" / "maria  de souza"
 *  viram "Maria de Souza". Partículas ficam minúsculas (nunca na 1ª palavra),
 *  numerais romanos (nomes reais e logradouros tipo "Rua XV de Novembro")
 *  voltam pra maiúsculas, e hífen/apóstrofo capitalizam os dois lados
 *  ("ana-lucia" → "Ana-Lúcia", "d'angelo" → "D'Angelo"). Idempotente. */
export function nomeProprio(s: string | null | undefined): string {
  const limpo = (s ?? "").trim().replace(/\s+/g, " ");
  return limpo
    .split(" ")
    .map((palavra, i) => {
      const baixa = palavra.toLowerCase();
      if (i > 0 && PARTICULAS_NOME.has(baixa)) return baixa;
      if (palavra.length >= 2 && /^[ivxlcdm]+$/i.test(palavra) && !NAO_ROMANO.has(baixa)) {
        return palavra.toUpperCase();
      }
      return palavra
        .split(/([-'])/)
        .map((trecho) =>
          /^[-']$/.test(trecho)
            ? trecho
            : trecho.charAt(0).toUpperCase() + trecho.slice(1).toLowerCase()
        )
        .join("");
    })
    .join(" ");
}

/** Capitaliza só a 1ª letra, preservando o resto como digitado — pra campo
 *  de uma palavra ou frase curta (parentesco "mae" → "Mãe"). */
export function capitalizar(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// ---------- máscaras progressivas (input) ----------

/** "1234567890" → "123.456.789-0" enquanto digita; completo vira o CPF
 *  formatado. Aceita input com máscara (re-strip) e trava em 11 dígitos. */
export function maskCpf(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** "01412100" → "01412-100" — progressiva, trava em 8 dígitos. */
export function maskCep(v: string): string {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** WhatsApp BR progressivo: dígitos (com ou sem 55) → "(11) 98765-4003".
 *  Número com DDI não-55 volta cru — máscara errada é pior que nenhuma. */
export function maskWhatsApp(v: string): string {
  let d = soDigitos(v).slice(0, 13);
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  const dd = d.slice(0, 2);
  if (!dd) return "";
  const resto = d.slice(2);
  if (!resto) return `(${dd}`;
  const split = resto.length > 8 ? 5 : 4;
  const p1 = resto.slice(0, split);
  const p2 = resto.slice(split);
  return `(${dd}) ${p1}${p2 ? `-${p2}` : ""}`;
}

/** Só paths internos: "/" sozinho ou "/" + algo que não seja "/" nem "\" —
 *  "//host" e "/\host" normalizam pra externo no URL parser (open redirect). */
export function pathInterno(p: string | null | undefined): string | null {
  if (p === "/") return p;
  return p != null && /^\/[^/\\]/.test(p) ? p : null;
}

/** Traduz erro do Postgres/PostgREST pra mensagem de UI (sem vazar schema nem
 *  inglês). É a base dos actions — quem tem copy própria pro domínio (presença,
 *  especialista) ou passthrough de P0001 trata antes e delega o resto pra cá. */
export function erroAmigavel(e: { message: string; code?: string }): string {
  // exceções de domínio levantadas por trigger já chegam em pt-BR
  if (/apenas a coordenacao resolve pedidos/i.test(e.message)) {
    return "Somente a coordenação pode atender um pedido de apoio.";
  }
  if (e.code === "23505" || /duplicate key/i.test(e.message)) {
    // e-mail é a identidade do magic link — o constraint "..._email_key" diz qual coluna conflitou
    if (/email/i.test(e.message)) return "Esse e-mail já está cadastrado.";
    if (/whatsapp/i.test(e.message))
      return "Esse WhatsApp já está cadastrado em outra pessoa.";
    return "Já existe um cadastro com esses dados.";
  }
  if (e.code === "42501" || /row-level security|row level security/i.test(e.message)) {
    return "Você não tem permissão para essa ação.";
  }
  if (e.code === "23514" || /check constraint|invalid input value/i.test(e.message)) {
    return "Revise os campos: um dos valores não é válido.";
  }
  if (e.code === "23503" || /foreign key/i.test(e.message)) {
    return "Esse cadastro está vinculado a outros dados. Remova os vínculos antes de excluir.";
  }
  // triggers de domínio (0023/0025/0041) levantam P0001 com mensagem própria
  if (/capacidade do mentor excedida/i.test(e.message)) {
    return "Esse mentor já atingiu o número máximo de duplas.";
  }
  // RPC definir_pdm_url (0044) levanta a razão já em pt-BR — repassa direto
  if (/link do pdm|definir o link/i.test(e.message)) return e.message;
  if (/autoria forjada|created_by não pode ser forjado/i.test(e.message)) {
    return "Não foi possível concluir. Recarregue a página e tente de novo.";
  }
  return "Não foi possível concluir. Tente de novo.";
}

/** CPF com dígitos verificadores — documento jurídico não pode aceitar typo. */
export function cpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string) => {
    const soma = base
      .split("")
      .reduce((acc, n, i) => acc + Number(n) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10]);
}
