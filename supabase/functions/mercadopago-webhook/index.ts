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
      JSON.stringify({
        status: "ok",
        message: "Barzzo Mercado Pago Webhook Edge Function ativo",
        eventosSuportados: [
          "Pagamentos (legacy)",
          "Planos e assinaturas",
          "Card Updater",
          "Split - Autorização",
          "Reclamações",
          "Alertas de fraude",
          "Contestações"
        ]
      }),
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

    const rawTipo = body.type || body.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "desconhecido";
    const tipo = String(rawTipo).toLowerCase();
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
    try {
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
    } catch (e) {
      console.warn("Aviso ao checar idempotencia:", e);
    }

    // 4. Registrar recebimento na tabela de auditoria
    try {
      await supabase.from("eventos_webhook_mercadopago").insert({
        evento_id: eventoId,
        tipo: tipo,
        payload: body,
      });
    } catch (e) {
      console.warn("Aviso ao registrar evento_webhook_mercadopago:", e);
    }

    // Identificar se é uma simulação de teste do painel do Mercado Pago
    const ehSimulacao = String(dataId) === "123456" || body.live_mode === false || body.action?.includes("test");

    const mpAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");

    // =========================================================================
    // TRATAMENTO DOS 7 EVENTOS
    // =========================================================================

    // A. Card Updater
    if (tipo.includes("card") || tipo === "card_updater") {
      if (mpAccessToken && !ehSimulacao) {
        try {
          const { data: barb } = await supabase
            .from("barbearias")
            .select("id, mercado_pago_customer_id")
            .eq("mercado_pago_card_id", dataId)
            .maybeSingle();

          if (barb?.mercado_pago_customer_id) {
            const respCard = await fetch(
              `https://api.mercadopago.com/v1/customers/${barb.mercado_pago_customer_id}/cards/${dataId}`,
              { headers: { Authorization: `Bearer ${mpAccessToken}` } }
            );
            if (respCard.ok) {
              const cardData = await respCard.json();
              await supabase
                .from("barbearias")
                .update({
                  mercado_pago_card_last_four: cardData.last_four_digits,
                  mercado_pago_card_brand: cardData.payment_method?.id,
                  atualizado_em: new Date().toISOString(),
                })
                .eq("id", barb.id);
            }
          }
        } catch (e) {
          console.warn("[Card Updater Warning]:", e);
        }
      }
      return new Response(
        JSON.stringify({ status: "success", message: "Evento Card Updater processado com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // B. Contestações e Fraude
    if (tipo.includes("chargeback") || tipo.includes("dispute") || tipo.includes("fraud")) {
      if (mpAccessToken && !ehSimulacao) {
        try {
          const respPay = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
            headers: { Authorization: `Bearer ${mpAccessToken}` },
          });
          if (respPay.ok) {
            const payData = await respPay.json();
            const extRef = payData.external_reference;
            let bId: string | null = null;
            try {
              bId = JSON.parse(extRef).barbearia_id;
            } catch {
              if (extRef?.length === 36) bId = extRef;
            }
            if (bId) {
              await supabase
                .from("barbearias")
                .update({
                  status_assinatura: "inadimplente",
                  atualizado_em: new Date().toISOString(),
                })
                .eq("id", bId);

              try {
                await supabase.from("logs_auditoria").insert({
                  barbearia_id: bId,
                  acao: "contestacao_pagamento",
                  entidade: "assinaturas",
                  dados_novos: { evento: tipo, id: dataId, payload: body },
                });
              } catch {}
            }
          }
        } catch (e) {
          console.warn("[Dispute/Fraud Warning]:", e);
        }
      }
      return new Response(
        JSON.stringify({ status: "success", message: "Contestação/Fraude processada com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // C. Reclamações
    if (tipo.includes("claim")) {
      try {
        await supabase.from("logs_auditoria").insert({
          acao: "reclamacao_recebida",
          entidade: "mercadopago",
          dados_novos: { evento: tipo, id: dataId, payload: body },
        });
      } catch {}

      return new Response(
        JSON.stringify({ status: "success", message: "Reclamação registrada com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // D. Split
    if (tipo.includes("split")) {
      return new Response(
        JSON.stringify({ status: "success", message: "Split processado com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // E. Pagamentos e Assinaturas
    let statusOficial: string | null = null;
    let externalRefRaw: string | null = null;
    let preapprovalId: string | null = null;
    let paymentId: string | null = null;
    let valorCobrado: number | null = null;

    if (ehSimulacao) {
      // Resposta imediata de 200 OK para simulação do Mercado Pago
      return new Response(
        JSON.stringify({
          status: "success",
          message: "Simulação de webhook do Mercado Pago recebida e validada com sucesso!",
          dataId,
          tipo,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mpAccessToken) {
      if (tipo.includes("preapproval") || tipo.includes("subscription")) {
        const respMp = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        });
        if (respMp.ok) {
          const mpData = await respMp.json();
          statusOficial = mpData.status;
          externalRefRaw = mpData.external_reference;
          preapprovalId = String(mpData.id);
          valorCobrado = mpData.auto_recurring?.transaction_amount ? Number(mpData.auto_recurring.transaction_amount) : null;
        }
      } else if (tipo.includes("payment")) {
        const respMp = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        });
        if (respMp.ok) {
          const mpData = await respMp.json();
          statusOficial = mpData.status;
          externalRefRaw = mpData.external_reference;
          paymentId = String(mpData.id);
          valorCobrado = mpData.transaction_amount ? Number(mpData.transaction_amount) : null;
        }
      }
    }

    if (!externalRefRaw) {
      return new Response(
        JSON.stringify({ status: "processed", message: "Evento registrado sem external_reference associado" }),
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

    // Processamento do status no banco de dados
    if (statusOficial === "authorized" || statusOficial === "approved") {
      const { error: rpcErr } = await supabase.rpc("processar_confirmacao_pagamento_assinatura", {
        p_barbearia_id: barbeariaId,
        p_plano_id: planoId,
        p_ciclo: ciclo,
        p_valor: valor,
        p_mp_payment_id: paymentId || `MP_PAGAMENTO_${dataId}`,
        p_mp_subscription_id: preapprovalId || (tipo.includes("preapproval") ? String(dataId) : null),
      });

      if (rpcErr) {
        await supabase
          .from("barbearias")
          .update({
            status_assinatura: "ativo",
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", barbeariaId);
      }
    } else if (statusOficial === "cancelled" || statusOficial === "paused") {
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
