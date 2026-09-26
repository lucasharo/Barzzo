import { Routes, Route, Navigate } from "react-router-dom";
import { NavegacaoCliente } from "./components/navegacao-cliente";
import PaginaInicialCliente from "./pages/Inicio";
import PaginaListagemBarbearias from "./pages/Barbearias";
import PaginaPerfilPublicoBarbearia from "./pages/BarbeariaDetalhes";
import PaginaMeusAgendamentos from "./pages/Agendamentos";
import PaginaDetalhesAgendamentoCliente from "./pages/AgendamentoDetalhes";
import PaginaAvaliacaoAtendimento from "./pages/Avaliacoes";
import PaginaFavoritosCliente from "./pages/Favoritos";
import PaginaNotificacoesCliente from "./pages/Notificacoes";
import PaginaPerfil from "./pages/Perfil";
import PaginaEntrar from "./pages/Entrar";
import PaginaCadastro from "./pages/Cadastro";
import PaginaRecuperarSenha from "./pages/RecuperarSenha";
import PaginaWizardReservaCliente from "./pages/Reservar";
import PaginaConfirmacaoReservaPosLogin from "./pages/ConfirmarReserva";

export default function App() {
  return (
    <>
      <NavegacaoCliente />
      <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 py-6 pb-28 md:pb-6">
        <Routes>
          <Route path="/" element={<PaginaListagemBarbearias />} />
          <Route path="/barbearias" element={<Navigate to="/" replace />} />
          <Route path="/barbearias/:slug" element={<PaginaPerfilPublicoBarbearia />} />
          <Route path="/agendamentos" element={<PaginaMeusAgendamentos />} />
          <Route path="/agendamentos/:id" element={<PaginaDetalhesAgendamentoCliente />} />
          <Route path="/avaliacoes/:agendamento_id" element={<PaginaAvaliacaoAtendimento />} />
          <Route path="/favoritos" element={<PaginaFavoritosCliente />} />
          <Route path="/notificacoes" element={<PaginaNotificacoesCliente />} />
          <Route path="/perfil" element={<PaginaPerfil />} />
          <Route path="/entrar" element={<PaginaEntrar />} />
          <Route path="/cadastro" element={<PaginaCadastro />} />
          <Route path="/recuperar-senha" element={<PaginaRecuperarSenha />} />
          <Route path="/reservar/:slug" element={<PaginaWizardReservaCliente />} />
          <Route path="/reservar/:slug/confirmar" element={<PaginaConfirmacaoReservaPosLogin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-neutral-200/80 dark:border-neutral-800/80 py-6 mb-20 md:mb-0 text-center text-xs opacity-70">
        <p>© {new Date().getFullYear()} Barzzo. Todos os direitos reservados.</p>
      </footer>
    </>
  );
}
