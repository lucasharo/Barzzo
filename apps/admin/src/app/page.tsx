import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@barzzo/ui";
import { Shield, Building2, CreditCard, Activity } from "lucide-react";

export default function PaginaInicialAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Painel Administrativo Barzzo</h1>
        <p className="text-sm opacity-70">
          Aplicação web independente para supervisão, assinaturas e governança da plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card camada="primaria">
          <CardHeader>
            <Building2 className="h-6 w-6 text-[#B45A2B] mb-2" />
            <CardTitle className="text-lg">Barbearias</CardTitle>
            <CardDescription>Gerenciamento geral de tenants</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xs px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 font-medium">
              Task 02
            </span>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardHeader>
            <CreditCard className="h-6 w-6 text-[#B45A2B] mb-2" />
            <CardTitle className="text-lg">Assinaturas</CardTitle>
            <CardDescription>Planos, trials e faturamento Mercado Pago</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xs px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 font-medium">
              Task 10
            </span>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardHeader>
            <Shield className="h-6 w-6 text-[#B45A2B] mb-2" />
            <CardTitle className="text-lg">Auditoria & Logs</CardTitle>
            <CardDescription>Rastreamento de ações administrativas</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xs px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 font-medium">
              Task 10
            </span>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardHeader>
            <Activity className="h-6 w-6 text-[#B45A2B] mb-2" />
            <CardTitle className="text-lg">Métricas Globais</CardTitle>
            <CardDescription>Volume de agendamentos e saúde do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xs px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 font-medium">
              Task 09 e 10
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
