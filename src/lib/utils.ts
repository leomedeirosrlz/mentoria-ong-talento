export { cn } from "cn"

/** minúsculas e sem acentos — "joao" encontra "João", "vila" encontra "Vila". */
export function normaliza(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
    return "Revise os campos — um dos valores não é válido.";
  }
  if (e.code === "23503" || /foreign key/i.test(e.message)) {
    return "Esse cadastro está vinculado a outros dados — remova os vínculos antes de excluir.";
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
