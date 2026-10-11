import { redirect } from "next/navigation";
import { JovemShell } from "@/components/jovem-shell";
import { TelaConta } from "@/components/telas-conta";
import { getMe, getNotificacoes } from "@/lib/queries";
import { BoasVindas } from "./boas-vindas";

/** Gate do lado do jovem (REALIZA-108): os mesmos três becos do shell de
 *  staff (sem cadastro / desativado / sem papel) + a régua de papel — só
 *  `mentorado` entra; qualquer outro papel vai pra home dele ("/"). O
 *  onboarding vira uma tela de boas-vindas única: nada do wizard de staff. */
export default async function JovemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();

  if (!me) {
    return (
      <TelaConta titulo="Cadastro não encontrado">
        <p>
          Sua conta não está vinculada a um cadastro. Se você entrou com o
          e-mail errado, saia e entre com o e-mail cadastrado pela coordenação.
        </p>
      </TelaConta>
    );
  }

  if (!me.ativo) {
    return (
      <TelaConta titulo="Acesso desativado">
        <p>
          Seu cadastro foi desativado pela coordenação. Se acha que isso é um
          engano, fale com a equipe do Realiza.vc.
        </p>
      </TelaConta>
    );
  }

  if (!me.role) {
    return (
      <TelaConta titulo="Cadastro recebido">
        <p>
          Seu acesso foi criado, mas a coordenação ainda não definiu o seu papel
          no programa. Assim que liberar, entre de novo por aqui.
        </p>
      </TelaConta>
    );
  }

  // o /jovem é do mentorado — staff (e demo, que só simula staff) cai na
  // própria home; o espelho mora no (app)/layout, que devolve mentorado pra cá
  if (me.role !== "mentorado") redirect("/");

  if (!me.onboarded_em) {
    return <BoasVindas nome={me.nome_social || me.nome} />;
  }

  const notificacoes = await getNotificacoes();
  return (
    <JovemShell me={me} notificacoes={notificacoes}>
      {children}
    </JovemShell>
  );
}
