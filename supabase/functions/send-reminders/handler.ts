import { createClient } from '@supabase/supabase-js';
import { expoHeaders, sendBatch, type Delivery } from './expo.ts';

export async function handleRequest(request: Request): Promise<Response> {
  const secret = Deno.env.get('NOTIFICATION_CRON_SECRET');
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!secret) return new Response('Scheduler is not configured', { status: 503 });
  if (request.headers.get('Authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

  async function update(id: string, values: Record<string, unknown>) {
    const { error } = await db.from('notification_deliveries')
      .update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error('Delivery update failed');
  }

  async function clearInvalidToken(delivery: Delivery) {
    // Do not erase a newer token registered since this notification was queued.
    const { error } = await db.from('users').update({ expo_push_token: null })
      .eq('id', delivery.user_id).eq('expo_push_token', delivery.expo_push_token);
    if (error) throw new Error('Token cleanup failed');
  }

  async function checkReceipts() {
    const { data, error } = await db.from('notification_deliveries')
      .select('*').eq('status', 'accepted')
      .lte('next_receipt_at', new Date().toISOString())
      .order('next_receipt_at').limit(100);
    if (error) throw new Error('Receipt query failed');
    const deliveries = (data ?? []) as Delivery[];
    if (!deliveries.length) return 0;
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST', headers: expoHeaders(accessToken), signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ ids: deliveries.map((d) => d.ticket_id) }),
    });
    if (!response.ok) throw new Error('Receipt request failed');
    const result = await response.json();
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
      throw new Error('Invalid receipt response');
    }
    for (const delivery of deliveries) {
      const receipt = result.data[delivery.ticket_id!];
      if (receipt?.status === 'ok') {
        // "delivered" means handed to FCM/APNs, not proof of device display.
        await update(delivery.id, { status: 'delivered', error_code: null });
      } else if (receipt?.status === 'error') {
        const code = receipt.details?.error ?? 'ExpoReceiptError';
        if (code === 'DeviceNotRegistered') await clearInvalidToken(delivery);
        await update(delivery.id, { status: 'failed', error_code: code });
      } else if (Date.now() - Date.parse(delivery.created_at) > 23 * 60 * 60_000) {
        await update(delivery.id, { status: 'unknown', error_code: 'ReceiptUnavailable' });
      } else {
        await update(delivery.id, { next_receipt_at: new Date(Date.now() + 15 * 60_000).toISOString() });
      }
    }
    return deliveries.length;
  }

  try {
    const { data, error } = await db.rpc('claim_notification_deliveries');
    if (error) throw new Error('Claim failed; check notification migration and schedule');
    const deliveries = (data ?? []) as Delivery[];
    const outcomes = await sendBatch(deliveries, accessToken);
    for (let i = 0; i < deliveries.length; i++) {
      if (outcomes[i].error_code === 'DeviceNotRegistered') await clearInvalidToken(deliveries[i]);
      await update(deliveries[i].id, {
        ...outcomes[i],
        ...(outcomes[i].status === 'accepted'
          ? { next_receipt_at: new Date(Date.now() + 15 * 60_000).toISOString() } : {}),
      });
    }
    const checked = await checkReceipts();
    return Response.json({ processed: deliveries.length, receiptsChecked: checked });
  } catch (error) {
    // Do not log tokens, names, secrets or Expo's raw response bodies.
    console.error(error instanceof Error ? error.message : 'Notification worker failed');
    return Response.json({ error: 'Notification worker failed; inspect function logs' }, { status: 500 });
  }
}
