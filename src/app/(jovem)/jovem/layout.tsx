import { redirect } from "next/navigation";
import { AssistenteBolhaLazy } from "@/components/assistente-bolha-lazy";
import { DemoBar } from "@/components/demo-bar";
import { JovemShell } from "@/components/jovem-shell";
import { TelaConta } from "@/components/telas-conta";
import { getDemoData } from "@/lib/demo/data";
import { papeisDe } from "@/lib/demo/queries";
import { demoRole } from "@/lib/demo/mode";
import { getMe, getNotificacoes } from "@/lib/queries";
import { getJovemAssinaturas, getJovemPerfil } from "@/lib/queries-jovem";
import { garantirDocumentosDevidos } from "@/lib/actions-assinaturas";
import { avatarPublicUrl } from "@/lib/avatar";
import { gravatarUrlSeExiste } from "@/lib/gravatar";
import { providerConfigurado } from "@/lib/ia/provider";
import { pedirAcessoHref } from "@/lib/login-erros";
import type { AppRole } from "@/lib/types";
import { OnboardingJovemLazy } from "./onboarding-jovem-lazy";
import { ProdutoTelemetry } from "@/components/produto-telemetry";

/** Gate do lado do jovem (REALIZA-108): os mesmos três becos do shell de
 *  staff (sem cadastro / desativado / sem papel) + a régua de papel — só
 *  `mentorado` entra; qualquer outro papel vai pra home dele ("/"). O
 *  onboarding é um wizard curto próprio (REALIZA-114): boas-vindas, a
 *  grade de disponibilidade que alimenta o cruzamento da agenda e a
 *  confirmação de contato — nada do wizard de staff. A DemoBar segue o
 *  visitante aqui também — trocar de papel saindo do /jovem é o caminho
 *  de volta pras personas de staff. */
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
        <p className="mt-2">
          Ainda não foi cadastrado?{" "}
          <a
            href={pedirAcessoHref()}
            className="font-medium text-foreground underline underline-offset-2"
          >
            Peça acesso por e-mail
          </a>
          .
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
        <p className="mt-2">
          Dúvidas?{" "}
          <a
            href="mailto:mentoria@realiza.vc"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Fale com a coordenação
          </a>
          .
        </p>
      </TelaConta>
    );
  }

  // o /jovem é do mentorado — staff (demo ou real) cai na própria home; o
  // espelho mora no (app)/layout, que devolve mentorado pra cá
  if (me.role !== "mentorado") redirect("/");

  // auto-cura do login (0206): termo de participação (+ autorização do
  // responsável pra menor) saem emitidos antes dos reads — o wizard ganha
  // o passo do termo no 1º login e a home já mostra os documentos
  // pendentes. Idempotente e self-scoped; erro não derruba o acesso.
  await garantirDocumentosDevidos();

  // mesma montagem do (app)/layout: mapa papel→primeiro nome + dock no header
  // mobile do shell + pill flutuante do desktop
  const demo = await demoRole();
  const demoData = demo ? getDemoData() : null;
  const demoPersonas = demoData
    ? (Object.fromEntries(
        Object.values(demoData.personas).map((p) => [
          p.role,
          p.nome.split(" ")[0],
        ])
      ) as Record<AppRole, string>)
    : null;
  // idem (app)/layout — a persona híbrida rotula "Mentor DPP + especialista"
  const demoPapeis = demoData
    ? (Object.fromEntries(
        Object.values(demoData.personas).map((p) => [
          p.role,
          papeisDe(demoData, p),
        ])
      ) as Record<AppRole, AppRole[]>)
    : null;
  const demoDock = demo && demoPersonas && demoPapeis && (
    <DemoBar variant="dock" papel={demo} personas={demoPersonas} papeis={demoPapeis} />
  );
  const demoFloat = demo && demoPersonas && demoPapeis && (
    <div className="hidden md:block">
      <DemoBar variant="float" papel={demo} personas={demoPersonas} papeis={demoPapeis} />
    </div>
  );
  if (!me.onboarded_em) {
    // a ficha do jovem preenche a grade e o contato do wizard — null = a
    // coordenação ainda não vinculou o cadastro (os passos mostram o
    // estado honesto em vez de quebrar). O termo de participação só vira
    // passo quando a coordenação emitiu e segue pendente (sem row o wizard
    // fica em 3 passos, como no staff sem voluntariado)
    const [perfil, assinaturas] = await Promise.all([
      getJovemPerfil(),
      getJovemAssinaturas(),
    ]);
    const termo = assinaturas.find(
      (a) => a.slug === "termo-mentorando" && a.status === "pendente" && a.token
    );
    return (
      <>
        <OnboardingJovemLazy
          me={me}
          perfil={perfil}
          termo={termo?.token ? { token: termo.token } : null}
          demo={demoDock}
        />
        {demoFloat}
      </>
    );
  }

  const [notificacoes, perfil] = await Promise.all([
    getNotificacoes(),
    // a foto do rodapé da sidebar é a do mentorado (avatar_path via
    // jovem_perfil) — mesma fonte do banner do perfil; o React.cache
    // divide a query com a página que também a pede
    getJovemPerfil(),
  ]);
  // bolha do assistente pro jovem (pacote liza nov/2026, sdd D5): a MESMA
  // flag IA_BOLHA do shell de staff — off por padrão fora da demo, onde
  // ela sempre aparece (vitrine do assistente, REALIZA-382). O /api/ia/chat
  // já responde a mentorado; as tools dele são read-only e leem o recorte
  // que as views jovem_* entregam.
  const acessoIa = demo != null || process.env.IA_BOLHA === "1";
  return (
    <JovemShell
      me={me}
      fotoUrl={
        perfil?.avatar_path ? avatarPublicUrl(perfil.avatar_path) : null
      }
      gravatarUrl={demo ? null : await gravatarUrlSeExiste(me.email)}
      notificacoes={notificacoes}
      demo={demoDock || undefined}
      assistente={
        acessoIa ? (
          <AssistenteBolhaLazy
            key="assistente"
            papeis={["mentorado"]}
            demo={demo != null}
            configurado={providerConfigurado()}
            nome={me.nome_social || me.nome}
          />
        ) : undefined
      }
    >
      {children}
      {demoFloat}
      <ProdutoTelemetry />
    </JovemShell>
  );
}
