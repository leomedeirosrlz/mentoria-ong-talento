import type { Metadata, Viewport } from "next";
import { Mitr, JetBrains_Mono } from "next/font/google";
import { MotionConfig } from "motion/react";
import { Toaster } from "@/components/ui/sonner";
import { demoRole } from "@/lib/demo/mode";
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
  themeColor: "#a2ca44",
  // ativa os env(safe-area-inset-*) já escritos no código (sem isto valem 0)
  viewportFit: "cover",
  // teclado virtual encolhe o layout em vez de cobrir dialogs/footers
  // sticky (Chrome/Android; iOS Safari ignora, limitação conhecida)
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const demo = await demoRole();
  return (
    <html
      lang="pt-BR"
      className={`${mitr.variable} ${jbMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* reducedMotion="user": o guard CSS de prefers-reduced-motion não cobre
            animação JS — aqui transform/layout viram instantâneos (fades ficam) */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
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
