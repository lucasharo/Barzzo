import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@barzzo/ui";
import { Store, Users, Calendar } from "lucide-react";

export default function PaginaInicialParceiro() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Painel do Parceiro</h1>
        <p className="text-sm opacity-70">
          Aplicação independente para donos, gerentes e profissionais de barbearia.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card camada="primaria">
          <CardHeader>
            <Store className="h-6 w-6 text-[#B45A2B] mb-2" />
            <CardTitle className="text-lg">Dono de Barbearia</CardTitle>
            <CardDescription>
              Gestão de equipe, serviços, faturamento, catálogo e configurações.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xs px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 font-medium">
              Task 02 — Barbearias e Equipe
            </span>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardHeader>
            <Calendar className="h-6 w-6 text-[#B45A2B] mb-2" />
            <CardTitle className="text-lg">Profissional</CardTitle>
            <CardDescription>
              Agenda simplificada, atendimentos, início e término de serviços.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xs px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 font-medium">
              Task 03 e 04 — Agenda e Serviços
            </span>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardHeader>
            <Users className="h-6 w-6 text-[#B45A2B] mb-2" />
            <CardTitle className="text-lg">Gerente</CardTitle>
            <CardDescription>
              Operações diárias da barbearia com permissões direcionadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xs px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 font-medium">
              Task 02 — Vínculos Operacionais
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
