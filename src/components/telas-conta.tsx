import { SignOutButton } from "@/components/signout-button";

/** Telas de conta bloqueada — o mesmo trio de gates nos dois shells
 *  ((app) staff e /jovem): autenticado sem profile, cadastro desativado e
 *  cadastro sem papel. Cada uma é um beco sem saída — o signOut é a única
 *  ação honesta (redirect pro login faria o middleware devolver pra cá).
 *  flex+m-auto (não place-items-center): conteúdo alto segue rolável do topo. */
export function TelaConta({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col px-4">
      <div className="m-auto max-w-sm rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)]">
        <p className="font-semibold">{titulo}</p>
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
        <SignOutButton
          icone={false}
          iconSize={13}
          label="Sair e voltar ao login"
          formClassName="mt-4"
          className="text-sm text-muted-foreground underline transition-colors hover:text-foreground"
        />
      </div>
    </div>
  );
}
