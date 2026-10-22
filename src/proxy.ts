import * as Sentry from "@sentry/nextjs";
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // onRequestError do instrumentation não recebe erros do proxy (bug
  // upstream vercel/next.js#85261) — sem isso um Supabase fora do ar viraria
  // 500 silencioso em toda request, sem evento no Sentry.
  try {
    return await updateSession(request);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export const config = {
  // rotas de metadata SEM extensão (opengraph-image gerada, sitemap.xml,
  // llms.txt) precisam passar direto — senão o proxy redireciona a /login e
  // o crawler recebe redirect em vez do conteúdo. `.*opengraph-image.*`
  // cobre raiz E rotas aninhadas (/f/<token>/opengraph-image, se existir).
  // /monitoring é o tunnel do Sentry (withSentryConfig.tunnelRoute): o POST
  // do browser precisa chegar no rewrite sem redirect pra /login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|llms.txt|monitoring(?:/|$)|.*opengraph-image.*|.*twitter-image.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt)$).*)"],
};
