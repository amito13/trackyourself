import assert from 'node:assert/strict';
import test from 'node:test';
import { sendBatch, ticketOutcome, retry } from '../supabase/functions/send-reminders/expo.ts';

const delivery = {
  id: 'delivery-1', user_id: 'user-1', expo_push_token: 'ExpoPushToken[test]',
  title: 'Your daily check-in', body: 'Amit, log your progress.',
  attempts: 1, ticket_id: null, updated_at: new Date().toISOString(),
};

test('sends personalized payloads and associates each Expo ticket with its recipient', async () => {
  const outcomes = await sendBatch([delivery, { ...delivery, id: 'delivery-2' }], 'test-access-token', async (url, init) => {
    assert.equal(url, 'https://exp.host/--/api/v2/push/send');
    assert.equal(init.headers.Authorization, 'Bearer test-access-token');
    const payload = JSON.parse(init.body);
    assert.equal(payload[0].body, delivery.body);
    assert.equal(payload[0].channelId, 'default');
    assert.equal(payload[1].data.deliveryId, 'delivery-2');
    return Response.json({ data: [
      { status: 'ok', id: 'ticket-1' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    ] });
  });
  assert.equal(outcomes[0].status, 'accepted');
  assert.equal(outcomes[0].ticket_id, 'ticket-1');
  assert.deepEqual(outcomes[1], { status: 'failed', error_code: 'DeviceNotRegistered' });
});

test('known temporary failures retry with increasing delay and stop after three attempts', async () => {
  const now = Date.parse('2026-09-27T15:30:00Z');
  assert.equal(retry(delivery, 'rate', now).next_attempt_at, '2026-09-27T15:31:00.000Z');
  assert.equal(retry({ ...delivery, attempts: 2 }, 'rate', now).next_attempt_at, '2026-09-27T15:32:00.000Z');
  assert.equal(retry({ ...delivery, attempts: 3 }, 'rate', now).status, 'failed');
  for (const status of [429, 500, 503]) {
    const [outcome] = await sendBatch([delivery], undefined, async () => new Response('', { status }));
    assert.equal(outcome.status, 'pending');
  }
  assert.equal(ticketOutcome(delivery, { status: 'error', details: { error: 'MessageRateExceeded' } }).status, 'pending');
});

test('permanent HTTP failures are not retried', async () => {
  const [outcome] = await sendBatch([delivery], undefined, async () => new Response('', { status: 400 }));
  assert.equal(outcome.status, 'failed');
});

test('ambiguous network and malformed responses are not automatically resent', async () => {
  const mocks = [
    async () => { throw new Error('Timed out after upload'); },
    async () => Response.json({ data: [] }),
    async () => Response.json({ data: [{ status: 'ok' }] }),
    async () => new Response('not JSON'),
  ];
  for (const mock of mocks) {
    const [outcome] = await sendBatch([delivery], undefined, mock);
    assert.equal(outcome.status, 'unknown');
  }
});

test('an empty queue makes no request', async () => {
  assert.deepEqual(await sendBatch([], undefined, async () => { throw new Error('Must not call Expo'); }), []);
});
