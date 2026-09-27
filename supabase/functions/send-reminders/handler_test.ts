import { handleRequest } from './handler.ts';

function assert(value: unknown, message = 'Assertion failed'): asserts value {
  if (!value) throw new Error(message);
}

Deno.test('scheduler rejects missing/wrong secrets and non-POST requests before any network call', async () => {
  const previous = Deno.env.get('NOTIFICATION_CRON_SECRET');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error('Unexpected network call'); };
  try {
    Deno.env.delete('NOTIFICATION_CRON_SECRET');
    assert((await handleRequest(new Request('http://localhost', { method: 'POST' }))).status === 503);
    Deno.env.set('NOTIFICATION_CRON_SECRET', 'test-cron-secret');
    assert((await handleRequest(new Request('http://localhost'))).status === 405);
    for (const authorization of ['', 'Bearer public-anon-key', 'Bearer incorrect-secret']) {
      const response = await handleRequest(new Request('http://localhost', {
        method: 'POST', headers: { Authorization: authorization },
      }));
      assert(response.status === 401);
    }
    assert(calls === 0, 'Unauthorized requests must not reach Supabase or Expo');
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) Deno.env.delete('NOTIFICATION_CRON_SECRET');
    else Deno.env.set('NOTIFICATION_CRON_SECRET', previous);
  }
});

Deno.test('worker saves tickets, checks receipts, and only clears the exact invalid token', async () => {
  const keys = ['NOTIFICATION_CRON_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const previous = keys.map((key) => Deno.env.get(key));
  keys.forEach((key, i) => Deno.env.set(key, ['test-secret', 'https://test.supabase.co', 'test-service-key'][i]));
  const originalFetch = globalThis.fetch;
  const updates: { url: string; body: Record<string, unknown> }[] = [];
  const delivery = {
    id: 'delivery-1', user_id: 'user-1', expo_push_token: 'ExpoPushToken[old-token]',
    title: 'Check in', body: 'Amit, record your progress.', attempts: 1,
    ticket_id: 'older-ticket', updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString();
    if (url.includes('/rpc/claim_notification_deliveries')) return Promise.resolve(Response.json([delivery]));
    if (url.endsWith('/push/send')) return Promise.resolve(Response.json({ data: [{ status: 'ok', id: 'new-ticket' }] }));
    if (url.endsWith('/push/getReceipts')) return Promise.resolve(Response.json({
      data: { 'older-ticket': { status: 'error', details: { error: 'DeviceNotRegistered' } } },
    }));
    if (init?.method === 'PATCH') {
      updates.push({ url, body: JSON.parse(String(init.body)) });
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url.includes('/notification_deliveries?')) return Promise.resolve(Response.json([delivery]));
    throw new Error('Unexpected request: ' + url);
  }) as typeof fetch;
  try {
    const response = await handleRequest(new Request('http://localhost', {
      method: 'POST', headers: { Authorization: 'Bearer test-secret' },
    }));
    assert(response.status === 200);
    const accepted = updates.find((item) => item.body.status === 'accepted');
    assert(accepted?.body.ticket_id === 'new-ticket');
    assert(typeof accepted?.body.next_receipt_at === 'string');
    const cleanup = updates.find((item) => item.url.includes('/users?'));
    assert(cleanup);
    const query = new URL(cleanup.url).searchParams;
    assert(query.get('id') === 'eq.user-1');
    assert(query.get('expo_push_token') === 'eq.ExpoPushToken[old-token]');
    assert(cleanup.body.expo_push_token === null);
    assert(updates.some((item) => item.body.status === 'failed'));
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => {
      if (previous[i] === undefined) Deno.env.delete(key);
      else Deno.env.set(key, previous[i]!);
    });
  }
});
