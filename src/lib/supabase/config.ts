/** Nome fixo do cookie de sessão no modo proxy local. O @supabase/ssr
 *  deriva o storageKey da URL do projeto por padrão; com o browser em
 *  /supabase e o servidor em 127.0.0.1:54321 os nomes divergiam e o
 *  middleware não enxergava a sessão. Um nome único mantém browser,
 *  middleware e Server Components na mesma chave, inclusive quando a página
 *  é aberta por localhost ou Tailscale.
 *
 *  Fora do proxy (produção) fica undefined de propósito: o default do
 *  @supabase/ssr já casa browser e servidor, e renomear invalidaria as
 *  sessões existentes sem necessidade. */
export const AUTH_COOKIE_NAME =
  process.env.NEXT_PUBLIC_SUPABASE_PROXY === "1" ? "realiza-auth" : undefined;
