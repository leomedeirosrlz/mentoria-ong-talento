import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Privacidade e LGPD",
  description:
    "Como a Realiza.vc coleta, usa e protege os dados pessoais do Programa de Mentoria Social.",
};

const SECOES: { titulo: string; corpo: React.ReactNode }[] = [
  {
    titulo: "1. Introdução",
    corpo: (
      <p>
        A Realiza.vc está comprometida com a proteção da sua privacidade. Esta
        política descreve como coletamos, usamos, armazenamos e protegemos as
        informações pessoais tratadas na plataforma do Programa de Mentoria
        Social, em conformidade com a Lei Geral de Proteção de Dados (Lei
        nº 13.709/2018 — LGPD).
      </p>
    ),
  },
  {
    titulo: "2. Dados coletados",
    corpo: (
      <>
        <p>Coletamos os seguintes tipos de informação:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Equipe e mentores:</strong> nome, e-mail, WhatsApp e foto de
            perfil (opcional).
          </li>
          <li>
            <strong>Mentorados:</strong> nome, e-mail, WhatsApp, ONG de origem,
            foto e documentos oficiais (como autorização do responsável),
            cadastrados pela coordenação.
          </li>
          <li>
            <strong>Operação do programa:</strong> registros de encontros,
            avaliações, combinados, anexos de evidência, notas de acompanhamento
            e histórico de agendamentos.
          </li>
        </ul>
      </>
    ),
  },
  {
    titulo: "3. Finalidade do tratamento",
    corpo: (
      <>
        <p>Utilizamos os dados para:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Operar o programa de mentoria: formação de duplas, agenda de encontros e acompanhamento</li>
          <li>Permitir a comunicação entre mentor, mentorado e coordenação (inclusive por WhatsApp)</li>
          <li>Registrar evidências e produzir relatórios e prestações de contas do ciclo</li>
          <li>Cumprir obrigações legais e regulatórias</li>
        </ul>
      </>
    ),
  },
  {
    titulo: "4. Compartilhamento de dados",
    corpo: (
      <>
        <p>
          Os dados circulam <strong>somente dentro do programa</strong>, no
          mínimo necessário para cada papel:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Coordenação:</strong> acesso completo, incluindo documentos
            oficiais e evidências.
          </li>
          <li>
            <strong>Supervisores:</strong> dados das duplas que supervisionam.
          </li>
          <li>
            <strong>Mentor e mentorado:</strong> dados de contato e registros da
            própria dupla.
          </li>
        </ul>
        <p>
          Fotos de perfil são servidas por link direto do nosso provedor de
          armazenamento: quem tem o link consegue visualizá-las, mesmo sem
          entrar na plataforma. Documentos oficiais e evidências de encontro,
          por outro lado, ficam em área privada com links temporários.
        </p>
        <p>
          A coordenação pode exportar listas de contato (nome, e-mail e
          WhatsApp) para operar o programa. Não vendemos dados pessoais nem os
          compartilhamos com empresas ou terceiros para fins comerciais.
        </p>
      </>
    ),
  },
  {
    titulo: "5. Segurança",
    corpo: (
      <p>
        Implementamos medidas técnicas e organizacionais para proteger os dados:
        acesso autenticado por e-mail, controle de permissões por papel (cada
        usuário enxerga apenas o que precisa), documentos e evidências em
        armazenamento privado com links temporários de acesso, e exportação de
        dados restrita à coordenação.
      </p>
    ),
  },
  {
    titulo: "6. Seus direitos",
    corpo: (
      <>
        <p>A LGPD garante a você os seguintes direitos:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Confirmar a existência de tratamento e acessar seus dados</li>
          <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
          <li>Solicitar a exclusão de dados tratados com base no consentimento</li>
          <li>Solicitar a portabilidade dos seus dados</li>
          <li>Revogar o consentimento a qualquer momento</li>
        </ul>
        <p>
          Para exercer seus direitos, fale com a coordenação do programa ou
          escreva para contato@realiza.vc.
        </p>
      </>
    ),
  },
  {
    titulo: "7. Cookies",
    corpo: (
      <p>
        Utilizamos apenas cookies essenciais de sessão, necessários para manter
        você conectado à plataforma. Não usamos cookies de publicidade ou
        rastreamento de terceiros.
      </p>
    ),
  },
  {
    titulo: "8. Retenção e exclusão",
    corpo: (
      <p>
        Mantemos os dados pelo tempo necessário à operação do programa e ao
        cumprimento de obrigações legais e de prestação de contas. Pedidos de
        exclusão podem ser feitos à coordenação; dados cuja guarda seja exigida
        por lei serão retidos pelo prazo legal.
      </p>
    ),
  },
  {
    titulo: "9. Contato",
    corpo: (
      <p>
        Para exercer seus direitos ou esclarecer dúvidas sobre privacidade,
        entre em contato:{" "}
        <a href="mailto:contato@realiza.vc" className="font-medium text-foreground underline underline-offset-2">
          contato@realiza.vc
        </a>
      </p>
    ),
  },
];

export default function PrivacidadePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-realiza.png" alt="Realiza.vc" className="h-5 w-auto" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Última atualização: setembro de 2026
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Privacidade e proteção de dados
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Política de privacidade da plataforma do Programa de Mentoria Social,
          em conformidade com a LGPD — Lei Geral de Proteção de Dados.
        </p>

        {/* long-form: medida ~70ch e corpo 16px — legibilidade antes de
            alinhar com o container */}
        <div className="mt-10 max-w-prose space-y-8">
          {SECOES.map((s) => (
            <section key={s.titulo}>
              <h2 className="text-base font-semibold">{s.titulo}</h2>
              <div className="mt-2 space-y-3 text-base leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
                {s.corpo}
              </div>
            </section>
          ))}
        </div>
      </main>

      <div className="border-t border-border px-4 py-6 sm:px-6">
        <SiteFooter />
      </div>
    </div>
  );
}
