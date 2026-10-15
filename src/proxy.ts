import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // rotas de metadata SEM extensão (opengraph-image gerada, sitemap.xml,
  // llms.txt) precisam passar direto — senão o proxy redireciona a /login e
  // o crawler recebe redirect em vez do conteúdo. `.*opengraph-image.*`
  // cobre raiz E rotas aninhadas (/f/<token>/opengraph-image, se existir)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|llms.txt|.*opengraph-image.*|.*twitter-image.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt)$).*)"],
};
