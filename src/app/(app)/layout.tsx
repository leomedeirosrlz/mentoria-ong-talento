import { AppShell } from "@/components/app-shell";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { signOut } from "@/lib/actions";
import { getMe, getNotificacoes } from "@/lib/queries";
import { avatarPublicUrl, gravatarUrl } from "@/lib/avatar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  // autenticado sem profile vinculado: redirect("/login") voltaria pra cá pelo
  // middleware e viraria loop — tela bloqueada com saída, como os casos abaixo
  if (!me) {
    return (
      <div className="min-h-[100dvh] grid place-items-center px-4">
        <div className="max-w-sm rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)]">
          <p className="font-semibold">Cadastro não encontrado</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Sua conta não está vinculada a um cadastro. Se você entrou com o
            e-mail errado, saia e entre com o e-mail cadastrado pela coordenação.
          </p>
          <form action={signOut} className="mt-4">
            <button type="submit" className="text-sm underline text-muted-foreground hover:text-foreground transition-colors">
              Sair e voltar ao login
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!me.ativo) {
    return (
      <div className="min-h-[100dvh] grid place-items-center px-4">
        <div className="max-w-sm rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)]">
          <p className="font-semibold">Acesso desativado</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Seu cadastro foi desativado pela coordenação. Se acha que isso é um
            engano, fale com a equipe do Realiza.vc.
          </p>
          <form action={signOut} className="mt-4">
            <button type="submit" className="text-sm underline text-muted-foreground hover:text-foreground transition-colors">
              Sair e voltar ao login
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!me.role) {
    return (
      <div className="min-h-[100dvh] grid place-items-center px-4">
        <div className="max-w-sm rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)]">
          <p className="font-semibold">Cadastro recebido</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Seu acesso foi criado, mas a coordenação ainda não definiu o seu papel
            no programa. Assim que liberar, entre de novo por aqui. Se você entrou
            com o e-mail errado, saia e entre com o e-mail cadastrado pela
            coordenação.
          </p>
          <form action={signOut} className="mt-4">
            <button type="submit" className="text-sm underline text-muted-foreground hover:text-foreground transition-colors">
              Sair e voltar ao login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // onboarding pendente (0031): o wizard substitui o shell inteiro, como as
  // telas bloqueadas acima — concluirOnboarding + router.refresh() devolve o app
  if (!me.onboarded_em) {
    return <OnboardingFlow me={me} />;
  }

  const notificacoes = await getNotificacoes();
  return (
    <AppShell
      me={me}
      avatarUrl={me.avatar_path ? avatarPublicUrl(me.avatar_path) : null}
      gravatarUrl={gravatarUrl(me.email)}
      notificacoes={notificacoes}
    >
      {children}
    </AppShell>
  );
}
