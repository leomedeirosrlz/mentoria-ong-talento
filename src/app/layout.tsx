import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Mitr, JetBrains_Mono } from "next/font/google";
import { MotionConfig } from "motion/react";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";
import { TemaSync } from "@/components/tema-sync";
import { demoRole } from "@/lib/demo/mode";
import { TEMA_COOKIE, TEMA_SCRIPT, temaValido } from "@/lib/tema";
import { sharedOg } from "@/lib/og";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const mitr = Mitr({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const jbMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
});

const DESCRICAO =
  "Plataforma do Programa de Mentoria Social do Instituto Realiza.vc: encontros, registros e acompanhamento das duplas num lugar só.";

export const metadata: Metadata = {
  // resolve os URLs relativos de openGraph (images, url, canonical) —
  // sem ele, metadata com url relativa é erro de build no Next 16
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Realiza.vc · Programa de Mentoria Social",
    template: "%s · Realiza.vc",
  },
  description: DESCRICAO,
  openGraph: {
    ...sharedOg,
    description: DESCRICAO,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    capable: true,
    title: "Realiza.vc",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // chrome do SO acompanha o tema: lime da marca no claro, o fundo quente
  // escuro do --background no dark (matchMedia do themeColor é da página,
  // não da preferência — quem fixou "claro" no app com SO dark recebe o
  // lime mesmo, é detalhe de chrome aceitável)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#a2ca44" },
    { media: "(prefers-color-scheme: dark)", color: "#161513" },
  ],
  // ativa os env(safe-area-inset-*) já escritos no código (sem isto valem 0)
  viewportFit: "cover",
  // teclado virtual encolhe o layout em vez de cobrir dialogs/footers
  // sticky (Chrome/Android; iOS Safari ignora, limitação conhecida)
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const demo = await demoRole();
  // cookie `tema` (auto/claro/escuro — default auto) resolve a classe do
  // <html> no server: "escuro" já sai com .dark; "auto" o script inline
  // acende via matchMedia antes da primeira pintura (sem flash). data-tema
  // é a fonte que o script e o TemaSync leem. suppressHydrationWarning: o
  // script pode ter adicionado .dark antes do React hidratar o <html>.
  const tema = temaValido((await cookies()).get(TEMA_COOKIE)?.value);
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      data-tema={tema}
      className={`${mitr.variable} ${jbMono.variable} h-full antialiased${
        tema === "escuro" ? " dark" : ""
      }`}
    >
      <body className="min-h-full flex flex-col">
        {/* script crua antes de qualquer conteúdo: resolve o "auto" via
            matchMedia no primeiro paint — a classe mora no <html>, que já
            existe quando o body começa a parsear */}
        <script dangerouslySetInnerHTML={{ __html: TEMA_SCRIPT }} />
        {/* em "auto", troca de tema do SO acompanha sem reload */}
        <TemaSync />
        {/* reducedMotion="user": o guard CSS de prefers-reduced-motion não cobre
            animação JS — aqui transform/layout viram instantâneos (fades ficam) */}
        <MotionConfig reducedMotion="user">
         <QueryProvider>{children}</QueryProvider>
       </MotionConfig>
        {/* mobileOffset acima da bottom nav (~57px) e do footer do wizard
            (~68px); em demo no desktop o offset descola da pill float */}
        <Toaster
          richColors
          position="bottom-right"
          mobileOffset={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
          offset={demo ? { bottom: "4.75rem" } : undefined}
        />
      </body>
    </html>
  );
}
