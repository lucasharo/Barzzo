-- O identificador interno do influenciador (codigo_ref) deixou de ser usado: a divulgação e a
-- atribuição são sempre pelo cupom. A coluna fica para o histórico, mas deixa de ser obrigatória
-- e única por barbearia.

ALTER TABLE public.influenciadores ALTER COLUMN codigo_ref DROP NOT NULL;
ALTER TABLE public.influenciadores DROP CONSTRAINT IF EXISTS influenciadores_codigo_barbearia_unique;

-- O painel do influenciador não é da equipe da barbearia, então não lê a tabela de cupons:
-- recebe só os códigos ativos do próprio cadastro.
CREATE OR REPLACE FUNCTION public.obter_cupons_do_influenciador(p_influenciador_id uuid)
RETURNS TABLE (codigo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT c.codigo
    FROM public.influenciadores i
    JOIN public.cupons c ON c.influenciador_id = i.id AND c.ativo = true
    WHERE i.id = p_influenciador_id
      AND i.ativo = true
      AND i.usuario_id = auth.uid()
    ORDER BY c.created_at DESC NULLS LAST, c.codigo;
$$;

REVOKE ALL ON FUNCTION public.obter_cupons_do_influenciador(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_cupons_do_influenciador(uuid) TO authenticated, service_role;
