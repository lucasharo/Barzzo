import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Arquivos com "_" no início não viram rota na Vercel: este é só um utilitário das rotas de /api.

// Origens autorizadas a chamar a API: apps web do Barzzo e o WebView do app Android (Capacitor).
const ORIGENS_PADRAO = [
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  'https://barzzo.io',
  'https://cliente.barzzo.io',
  'https://parceiro.barzzo.io',
  'https://admin.barzzo.io',
  'https://barzzo-parceiro.vercel.app',
  'https://barzzo-parceiro-dev.vercel.app',
];

export function obterUrlWebhookMercadoPago() {
  const configurada = process.env.MERCADO_PAGO_WEBHOOK_URL?.trim();
  if (configurada) return configurada;

  const base = process.env.VERCEL_ENV === 'production'
    ? 'https://parceiro.barzzo.io'
    : 'https://barzzo-parceiro-dev.vercel.app';
  return `${base}/api/webhooks/mercadopago`;
}

export function validarAssinaturaWebhookMercadoPago(req) {
  const segredo = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!segredo) return process.env.VERCEL_ENV !== 'production';

  const assinatura = String(req.headers['x-signature'] || '');
  const requestId = String(req.headers['x-request-id'] || '');
  const dataId = String(req.query?.['data.id'] || req.body?.data?.id || '').toLowerCase();
  const partes = Object.fromEntries(
    assinatura.split(',').map((parte) => {
      const separador = parte.indexOf('=');
      return separador < 0
        ? ['', '']
        : [parte.slice(0, separador).trim(), parte.slice(separador + 1).trim()];
    })
  );

  if (!partes.ts || !partes.v1 || !requestId || !dataId) return false;

  const manifesto = `id:${dataId};request-id:${requestId};ts:${partes.ts};`;
  const esperada = createHmac('sha256', segredo).update(manifesto).digest();
  const recebida = Buffer.from(partes.v1, 'hex');
  return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
}

/** Aplica CORS e responde ao preflight. Retorna true quando a requisição já foi respondida. */
export function aplicarCors(req, res) {
  const extras = (process.env.CORS_ORIGENS || '')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);
  const permitidas = [...ORIGENS_PADRAO, ...extras];
  const origem = req.headers.origin;

  if (origem && permitidas.includes(origem)) {
    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

/** Cliente com a chave de serviço; null quando o ambiente não está configurado. */
export function criarClienteServico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_CHAVE_SECRETA || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave);
}

/**
 * Exige um usuário logado (Authorization: Bearer <token da sessão>) que seja dono ou gerente da barbearia.
 * Quando não for, já responde 401/403 e devolve null.
 */
export async function exigirGestorDaBarbearia(req, res, supabase, barbeariaId) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    res.status(401).json({ error: 'Faça login para continuar.' });
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Sessão inválida ou expirada. Entre novamente.' });
    return null;
  }

  const { data: vinculos } = await supabase
    .from('membros_barbearia')
    .select('papel')
    .eq('barbearia_id', barbeariaId)
    .eq('usuario_id', data.user.id)
    .eq('ativo', true)
    .in('papel', ['dono', 'gerente'])
    .limit(1);

  if (!vinculos || vinculos.length === 0) {
    res.status(403).json({ error: 'Você não tem permissão para gerenciar a assinatura desta barbearia.' });
    return null;
  }

  return data.user;
}

/** Rotas de cron/automação: exigem o segredo CRON_SECRET (a Vercel o envia como Bearer nos crons). */
export function exigirSegredoDeCron(req, res) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    res.status(503).json({ error: 'CRON_SECRET não configurado.' });
    return false;
  }
  const recebido = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (recebido !== segredo) {
    res.status(401).json({ error: 'Não autorizado.' });
    return false;
  }
  return true;
}
