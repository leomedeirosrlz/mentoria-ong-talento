import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getMe } from "@/lib/queries";
import { getJovemPerfil } from "@/lib/queries-jovem";
import { ESCOLARIDADE_LABELS } from "@/lib/ciclo";
import type { Escolaridade } from "@/lib/types";
import { JovemPerfilForm } from "./perfil-form";

export const metadata: Metadata = { title: "Meu perfil" };

/** Perfil do jovem — duas fontes honestas: `profiles` é o canônico de
 *  pessoa/contato (ele edita aqui); `jovem_perfil` (o registro de programa
 *  em mentorados) é o que a coordenação mantém — aparece como leitura. */
export default async function JovemPerfil() {
  const [me, perfil] = await Promise.all([getMe(), getJovemPerfil()]);
  if (!me) redirect("/login"); // o layout já barra — convenção das páginas

  const nomeTela = me.nome_social || me.nome;
  const escolaridadeRotulo = perfil?.escolaridade
    ? (ESCOLARIDADE_LABELS[perfil.escolaridade as Escolaridade] ?? perfil.escolaridade)
    : null;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        {/* iniciais na v1 (decisão D2): foto do menor só com cláusula de uso
            de imagem na autorização — o disco amarelo é a identidade */}
        <Avatar nome={nomeTela} papel="mentorado" size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {nomeTela}
          </h1>
          <p className="text-sm text-muted-foreground">Mentorado(a) · {me.email}</p>
        </div>
      </header>

      {/* o que a coordenação mantém — leitura, com honestidade de origem */}
      <Card>
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Sua ficha no programa</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mantida pela coordenação — pra corrigir algo, fale com a equipe.
            </p>
          </div>
          {!perfil ? (
            <p className="text-sm text-muted-foreground">
              Sua ficha de mentorado ainda não está vinculada à sua conta — a
              coordenação faz essa conexão no seu cadastro.
            </p>
          ) : (
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {perfil.objetivos && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Seus objetivos com a mentoria
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {perfil.objetivos}
                  </dd>
                </div>
              )}
              {escolaridadeRotulo && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Escolaridade
                  </dt>
                  <dd className="mt-1 text-sm">{escolaridadeRotulo}</dd>
                </div>
              )}
              {perfil.ong_origem && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Como você chegou
                  </dt>
                  <dd className="mt-1 text-sm">{perfil.ong_origem}</dd>
                </div>
              )}
              {!perfil.objetivos && !escolaridadeRotulo && !perfil.ong_origem && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Sua ficha ainda está vazia — ela é preenchida a partir da
                  sua inscrição e do papo com a coordenação.
                </p>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

      {/* o que ele mesmo mantém — contato e nome de uso */}
      <Card>
        <CardContent>
          <h2 className="text-base font-semibold">Seus dados</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            É daqui que seu mentor e a coordenação falam com você.
          </p>
          <JovemPerfilForm me={me} />
        </CardContent>
      </Card>
    </div>
  );
}
