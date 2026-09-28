import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // 1. Tratamento de CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Health check simples via GET
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", message: "Barzzo Mercado Pago Webhook Edge Function ativo" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const tipo = body.type || body.topic || url.searchParams.get("type") || url.searchParams.get("topic");
    const dataId = body.data?.id || body.id || url.searchParams.get("data.id") || url.searchParams.get("id");

    if (!dataId) {
      return new Response(
        JSON.stringify({ status: "ignored", message: "Identificador ausente no evento do webhook" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventoId = `${tipo}_${dataId}_${body.action || "notify"}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Idempotência: verificar se este evento específico já foi processado
    const { data: eventoExistente } = await supabase
      .from("eventos_webhook_mercadopago")
      .select("id")
      .eq("evento_id", eventoId)
      .maybeSingle();

    if (eventoExistente) {
      return new Response(
        JSON.stringify({ status: "ok", message: "Evento já processado anteriormente (idempotente)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Registrar recebimento na tabela de auditoria
    await supabase.from("eventos_webhook_mercadopago").insert({
      evento_id: eventoId,
      tipo: tipo || "desconhecido",
      payload: body,
    }).catch(() => {});

    // 5. Consulta autorizada no Mercado Pago para obter status e external_reference autênticos
    const mpAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    let statusOficial: string | null = null;
    let externalRefRaw: string | null = null;
    let preapprovalId: string | null = null;
    let paymentId: string | null = null;
    let valorCobrado: number | null = null;

    if (mpAccessToken) {
      if (tipo === "subscription_preapproval" || tipo === "preapproval") {
        const respMp = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        });
        if (respMp.ok) {
          const mpData = await respMp.json();
          statusOficial = mpData.status; // 'authorized', 'paused', 'cancelled'
          externalRefRaw = mpData.external_reference;
          preapprovalId = String(mpData.id);
          valorCobrado = mpData.auto_recurring?.transaction_amount ? Number(mpData.auto_recurring.transaction_amount) : null;
        }
      } else if (tipo === "payment") {
        const respMp = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        });
        if (respMp.ok) {
          const mpData = await respMp.json();
          statusOficial = mpData.status; // 'approved', 'rejected', 'pending'
          externalRefRaw = mpData.external_reference;
          paymentId = String(mpData.id);
          valorCobrado = mpData.transaction_amount ? Number(mpData.transaction_amount) : null;
        }
      }
    }

    if (!externalRefRaw) {
      return new Response(
        JSON.stringify({ status: "processed", message: "Evento recebido sem external_reference associado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let barbeariaId: string | null = null;
    let planoId: string | null = null;
    let ciclo: string = "mensal";
    let valor: number = valorCobrado || 0;

    try {
      const parsed = JSON.parse(externalRefRaw);
      barbeariaId = parsed.barbearia_id || parsed.barbeariaId || null;
      planoId = parsed.plano_id || parsed.planoId || null;
      ciclo = parsed.ciclo || "mensal";
      if (parsed.valor) valor = Number(parsed.valor);
    } catch {
      // Se for apenas o UUID da barbearia
      if (externalRefRaw.length === 36) {
        barbeariaId = externalRefRaw;
      }
    }

    if (!barbeariaId) {
      return new Response(
        JSON.stringify({ status: "processed", message: "barbearia_id não encontrado no external_reference" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Processamento autônomo do status no banco de dados
    if (statusOficial === "authorized" || statusOficial === "approved") {
      // Ativar assinatura via RPC atômica
      const { error: rpcErr } = await supabase.rpc("processar_confirmacao_pagamento_assinatura", {
        p_barbearia_id: barbeariaId,
        p_plano_id: planoId,
        p_ciclo: ciclo,
        p_valor: valor,
        p_mp_payment_id: paymentId || `MP_PAGAMENTO_${dataId}`,
        p_mp_subscription_id: preapprovalId || (tipo?.includes("preapproval") ? String(dataId) : null),
      });

      if (rpcErr) {
        // Fallback: atualizar status da barbearia diretamente
        await supabase
          .from("barbearias")
          .update({
            status_assinatura: "ativo",
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", barbeariaId);
      }
    } else if (statusOficial === "cancelled" || statusOficial === "paused") {
      // Suspender/Cancelar assinatura
      await supabase
        .from("barbearias")
        .update({
          status_assinatura: "suspenso",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", barbeariaId);

      await supabase
        .from("assinaturas")
        .update({
          status: "cancelada",
          atualizado_em: new Date().toISOString(),
        })
        .eq("barbearia_id", barbeariaId);
    }

    return new Response(
      JSON.stringify({
        status: "success",
        message: `Webhook processado com sucesso para a barbearia ${barbeariaId}`,
        statusOficial,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Erro no processamento do webhook:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno no webhook" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
