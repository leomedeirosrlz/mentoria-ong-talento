import { AppShell } from "@/components/app-shell";
import { AssistenteBolhaLazy } from "@/components/assistente-bolha-lazy";
import { DemoBar } from "@/components/demo-bar";
import { OnboardingFlowLazy } from "@/components/onboarding-flow-lazy";
import { TelaConta } from "@/components/telas-conta";
import { getDemoData } from "@/lib/demo/data";
import { demoRole } from "@/lib/demo/mode";
import { getMe, getMeuMentorProfile, getMeusDadosPessoais, getNotificacoes } from "@/lib/queries";
import { getChamadosSemDono } from "@/lib/queries-chamados";
import { getMeusDadosCivis, getMinhaAssinaturaTermo } from "@/lib/queries-assinaturas";
import { providerConfigurado } from "@/lib/ia/provider";
import { pedirAcessoHref } from "@/lib/login-erros";
import { avatarPublicUrl } from "@/lib/avatar";
import { gravatarUrlSeExiste } from "@/lib/gravatar";
import type { AppRole } from "@/lib/types";
import { Children } from "react";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // notificações são self-scoped na RLS — disparam junto com getMe em vez de
  // esperar a cadeia de gates. O catch solto marca a promise como handled
  // pros retornos antecipados que a abandonam (o await real ainda propaga).
  const mePromise = getMe();
  const demoPromise = demoRole();
  const notificacoesPromise = getNotificacoes();
  notificacoesPromise.catch(() => {});
  const chamadosPromise = mePromise.then((m) =>
    m && (m.role === "coordenacao" || m.role === "supervisor")
      ? getChamadosSemDono()
      : 0
  );
  chamadosPromise.catch(() => {});
  const me = await mePromise;
  const demo = await demoPromise;
  // autenticado sem profile vinculado: redirect("/login") voltaria pra cá pelo
  // middleware e viraria loop — tela bloqueada com saída, como os casos abaixo
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
          no programa. Assim que liberar, entre de novo por aqui. Se você entrou
          com o e-mail errado, saia e entre com o e-mail cadastrado pela
          coordenação.
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

  // o jovem tem shell próprio (REALIZA-108): qualquer rota do grupo (app)
  // — inclusive "/" — devolve ele pra home dele. O espelho mora no layout
  // do (jovem): staff pedindo /jovem volta pra cá.
  if (me.role === "mentorado") redirect("/jovem");

  // mapa papel→primeiro nome pra DemoBar — só monta o dataset quando a demo
  // está ativa (fora dela seria leitura à toa, ainda que pura/barata).
  // personas tem uma entrada por AppRole (a da mentorada existe no dataset
  // mesmo sem card na demo) — derivar dela mantém o Record completo e
  // verdadeiro, sem cast sobre DEMO_ROLES.
  const demoPersonas = demo
    ? (Object.fromEntries(
        Object.values(getDemoData().personas).map((p) => [
          p.role,
          p.nome.split(" ")[0],
        ])
      ) as Record<AppRole, string>)
    : null;
  // dock: pill compacta dockada no header mobile (AppShell) e no header do
  // wizard (OnboardingFlow) — badge sempre visível, zero overlay de conteúdo.
  // float: pill fixa do desktop; display:none no mobile remove trigger e
  // popover (o dock já cobre esse breakpoint).
  const demoDock = demo && demoPersonas && (
    <DemoBar variant="dock" papel={demo} personas={demoPersonas} />
  );
  const demoFloat = demo && demoPersonas && (
    <div key="demo-float" className="hidden md:block">
      <DemoBar variant="float" papel={demo} personas={demoPersonas} />
    </div>
  );

  // onboarding pendente (0031): o wizard substitui o shell inteiro, como as
  // telas bloqueadas acima — concluirOnboarding + router.refresh() devolve o app
  if (!me.onboarded_em) {
    // prefill: a importação da coordenação já pode ter trazido a ficha —
    // sensíveis via RPC self-scoped (0048), ficha de mentor via grant próprio.
    // civis + assinatura do termo alimentam o passo opcional de assinatura:
    // "assinado" tira o passo do wizard, pendência mostra o termo pra
    // ler/assinar. Não-voluntário não tem termo — nem busca
    const [pessoal, mentorProfile, civis, assinaturaTermo] = await Promise.all([
      getMeusDadosPessoais(),
      getMeuMentorProfile(),
      getMeusDadosCivis(),
      me.voluntario === false
        ? Promise.resolve(null)
        : getMinhaAssinaturaTermo(),
    ]);
    // o dock vai dentro do header do wizard (prop demo) — clicável em todos
    // os passos pra trocar de papel / rever a apresentação / sair da demo
    return (
      <>
        <OnboardingFlowLazy
          key="onboarding"
          me={me}
          pessoal={pessoal}
          mentorProfile={mentorProfile}
          civis={civis}
          assinaturaTermo={assinaturaTermo}
          demo={demoDock}
        />
        {demoFloat}
      </>
    );
  }

  const [notificacoes, chamadosSemDono] = await Promise.all([
    notificacoesPromise,
    chamadosPromise,
  ]);
  // bolha do assistente (REALIZA-243): o mesmo gate do item de nav que ela
  // substituiu — staff e mentores, nunca o jovem (shell próprio) nem papeis
  // fora da lista. papeis efetivos: primário + secundários (0085), igual ao
  // que a página antiga passava
  const papeisIa =
    me.papeis && me.papeis.length ? me.papeis : me.role ? [me.role] : [];
  // a bolha está DESLIGADA por padrão fora da demo enquanto o assistente
  // fecha a rodada de UI (gravação da demo, out/2026). IA_BOLHA=1 liga no
  // ambiente — na demo ela sempre aparece: é a vitrine do assistente, com
  // respostas e ajustes de exemplo (REALIZA-382)
  const acessoIa =
    (demo != null || process.env.IA_BOLHA === "1") &&
    ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"].some(
      (r) => papeisIa.includes(r as AppRole)
    );

  return (
    <AppShell
      me={me}
      avatarUrl={me.avatar_path ? avatarPublicUrl(me.avatar_path) : null}
      gravatarUrl={demo ? null : await gravatarUrlSeExiste(me.email)}
      notificacoes={notificacoes}
      chamadosSemDono={chamadosSemDono}
      demo={demoDock}
      assistente={
        acessoIa ? (
          <AssistenteBolhaLazy
            key="assistente"
            papeis={papeisIa}
            demo={demo != null}
            configurado={providerConfigurado()}
            nome={me.nome}
          />
        ) : undefined
      }
    >
      {/* toArray atribui keys — dois filhos soltos disparavam o warning
          de "each child in a list" no render do AppShell */}
      {Children.toArray([children, demoFloat])}
    </AppShell>
  );
}
