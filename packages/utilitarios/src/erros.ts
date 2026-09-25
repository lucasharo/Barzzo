/**
 * Tradutor universal de mensagens de erro para Português (pt-BR).
 * Garante que nenhuma mensagem técnica ou em inglês seja exibida ao usuário final.
 */
export function traduzirErro(erro: unknown, fallback?: string): string {
  if (!erro) {
    return fallback || "Ocorreu um erro inesperado. Tente novamente.";
  }

  let mensagem = "";
  if (typeof erro === "string") {
    mensagem = erro;
  } else if (erro instanceof Error) {
    mensagem = erro.message;
  } else if (typeof erro === "object" && erro !== null) {
    const errObj = erro as Record<string, any>;
    mensagem =
      errObj.message ||
      errObj.error_description ||
      errObj.details ||
      errObj.hint ||
      "";
  }

  const msgLower = mensagem.toLowerCase();

  // 1. Supabase / Autenticação
  if (
    msgLower.includes("invalid login credentials") ||
    msgLower.includes("invalid credentials") ||
    msgLower.includes("invalid grant")
  ) {
    return "E-mail ou senha incorretos. Por favor, verifique seus dados e tente novamente.";
  }

  if (
    msgLower.includes("user already registered") ||
    msgLower.includes("already registered") ||
    msgLower.includes("already exists")
  ) {
    return "Este e-mail já está cadastrado na plataforma. Tente fazer login.";
  }

  if (msgLower.includes("email not confirmed")) {
    return "E-mail ainda não confirmado. Por favor, verifique sua caixa de entrada.";
  }

  if (msgLower.includes("password should be at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }

  if (msgLower.includes("user not found")) {
    return "Usuário não encontrado.";
  }

  if (
    msgLower.includes("too many requests") ||
    msgLower.includes("rate limit")
  ) {
    return "Muitas tentativas em pouco tempo. Por segurança, aguarde alguns instantes e tente novamente.";
  }

  if (
    msgLower.includes("jwt expired") ||
    msgLower.includes("token is expired") ||
    msgLower.includes("invalid jwt")
  ) {
    return "Sua sessão expirou. Por favor, faça login novamente para continuar.";
  }

  if (msgLower.includes("auth session missing")) {
    return "Sessão de usuário não encontrada. Por favor, faça login.";
  }

  // 2. Conexão / Rede / Fetch
  if (
    msgLower.includes("failed to fetch") ||
    msgLower.includes("networkerror") ||
    msgLower.includes("network request failed") ||
    msgLower.includes("load failed") ||
    msgLower.includes("abort")
  ) {
    return "Falha na conexão de internet. Verifique sua rede e tente novamente.";
  }

  // 3. PostgreSQL / RLS / Restrições do Banco de Dados
  if (
    msgLower.includes("row-level security") ||
    msgLower.includes("rls") ||
    msgLower.includes("permission denied")
  ) {
    return "Você não tem permissão para realizar esta ação.";
  }

  if (
    msgLower.includes("conflitante") ||
    msgLower.includes("exclusion_violation") ||
    msgLower.includes("agendamentos_conflitantes")
  ) {
    return "Este horário já foi reservado ou está indisponível. Por favor, selecione outro horário.";
  }

  if (
    msgLower.includes("duplicate key value") ||
    msgLower.includes("unique constraint")
  ) {
    return "Já existe um registro com essas informações cadastradas.";
  }

  if (
    msgLower.includes("foreign key constraint") ||
    msgLower.includes("violates foreign key")
  ) {
    return "Não é possível concluir a operação pois existem dados dependentes vinculados.";
  }

  if (
    msgLower.includes("could not find the table") ||
    msgLower.includes("pgrst205")
  ) {
    return "Não foi possível carregar os dados no momento. Atualize a página e tente novamente.";
  }

  // Se já for uma mensagem em português e não contiver fragmentos em inglês
  const contemPalavrasPt =
    /([áéíóúãõçêâô]|não|senha|email|usuário|barbearia|agendamento|serviço|campo|obrigatório)/i.test(
      mensagem
    );
  const contemGramaticaInglesa =
    /([a-z]\s(is|was|were|has|have|been|the|from|with|error|failed|cannot)\s)/i.test(
      mensagem
    );

  if (contemPalavrasPt && !contemGramaticaInglesa) {
    return mensagem;
  }

  return (
    fallback || "Ocorreu um erro ao processar sua solicitação. Tente novamente."
  );
}
