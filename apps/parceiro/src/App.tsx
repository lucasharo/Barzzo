import { Routes, Route, Navigate } from "react-router-dom";
import { NavegacaoParceiro } from "./components/navegacao-parceiro";
import PaginaBloqueios from "./pages/agenda/Bloqueios";
import PaginaAgenda from "./pages/agenda/Agenda";
import PaginaDetalhesAgendamento from "./pages/agendamentos/Detalhes";
import PaginaNovoAgendamento from "./pages/agendamentos/Novo";
import PaginaAssinatura from "./pages/assinatura/Assinatura";
import PaginaAvaliacoes from "./pages/avaliacoes/Avaliacoes";
import PaginaDetalhesCampanha from "./pages/campanhas/Detalhes";
import PaginaCampanhas from "./pages/campanhas/Campanhas";
import PaginaDetalhesCliente from "./pages/clientes/Detalhes";
import PaginaClientes from "./pages/clientes/Clientes";
import PaginaConfiguracoesPerfil from "./pages/configuracoes/Perfil";
import PaginaAceitarConvite from "./pages/convite/AceitarConvite";
import PaginaConvites from "./pages/convites/Convites";
import PaginaJornadaEquipe from "./pages/equipe/Jornada";
import PaginaDetalhesEquipe from "./pages/equipe/Detalhes";
import PaginaEquipe from "./pages/equipe/Equipe";
import PaginaGaleria from "./pages/galeria/Galeria";
import PaginaHorarios from "./pages/horarios/Horarios";
import PaginaInfluenciadorPainel from "./pages/influenciador/Painel";
import PaginaInfluenciadores from "./pages/influenciadores/Influenciadores";
import PaginaNotificacoes from "./pages/notificacoes/Notificacoes";
import PaginaOnboarding from "./pages/onboarding/Onboarding";
import PaginaInicialParceiro from "./pages/Home";
import PaginaPainel from "./pages/painel/Painel";
import PaginaDetalhesProduto from "./pages/produtos/Detalhes";
import PaginaProdutos from "./pages/produtos/Produtos";
import PaginaRelatorios from "./pages/relatorios/Relatorios";
import PaginaDetalhesServico from "./pages/servicos/Detalhes";
import PaginaServicos from "./pages/servicos/Servicos";

export default function App() {
  return (
    <>
      <NavegacaoParceiro />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 pb-24 md:pb-8">
        <Routes>
          <Route path="/agenda/bloqueios" element={<PaginaBloqueios />} />
          <Route path="/agenda" element={<PaginaAgenda />} />
          <Route path="/agendamentos/:id" element={<PaginaDetalhesAgendamento />} />
          <Route path="/agendamentos/novo" element={<PaginaNovoAgendamento />} />
          <Route path="/assinatura" element={<PaginaAssinatura />} />
          <Route path="/avaliacoes" element={<PaginaAvaliacoes />} />
          <Route path="/campanhas/:id" element={<PaginaDetalhesCampanha />} />
          <Route path="/campanhas" element={<PaginaCampanhas />} />
          <Route path="/clientes/:id" element={<PaginaDetalhesCliente />} />
          <Route path="/clientes" element={<PaginaClientes />} />
          <Route path="/configuracoes/perfil" element={<PaginaConfiguracoesPerfil />} />
          <Route path="/convite/:token" element={<PaginaAceitarConvite />} />
          <Route path="/convites" element={<PaginaConvites />} />
          <Route path="/equipe/:id/jornada" element={<PaginaJornadaEquipe />} />
          <Route path="/equipe/:id" element={<PaginaDetalhesEquipe />} />
          <Route path="/equipe" element={<PaginaEquipe />} />
          <Route path="/galeria" element={<PaginaGaleria />} />
          <Route path="/horarios" element={<PaginaHorarios />} />
          <Route path="/influenciador/painel" element={<PaginaInfluenciadorPainel />} />
          <Route path="/influenciadores" element={<PaginaInfluenciadores />} />
          <Route path="/notificacoes" element={<PaginaNotificacoes />} />
          <Route path="/onboarding" element={<PaginaOnboarding />} />
          <Route path="/" element={<PaginaInicialParceiro />} />
          <Route path="/painel" element={<PaginaPainel />} />
          <Route path="/produtos/:id" element={<PaginaDetalhesProduto />} />
          <Route path="/produtos" element={<PaginaProdutos />} />
          <Route path="/relatorios" element={<PaginaRelatorios />} />
          <Route path="/servicos/:id" element={<PaginaDetalhesServico />} />
          <Route path="/servicos" element={<PaginaServicos />} />
          <Route path="*" element={<Navigate to="/painel" replace />} />
        </Routes>
      </main>
    </>
  );
}
