export interface Delivery {
  id: string;
  user_id: string;
  expo_push_token: string;
  title: string;
  body: string;
  attempts: number;
  ticket_id: string | null;
  updated_at: string;
  created_at: string;
}

export interface Outcome {
  status: 'pending' | 'accepted' | 'failed' | 'unknown';
  error_code: string | null;
  ticket_id?: string;
  next_attempt_at?: string;
}

export function retry(delivery: Delivery, code: string, now = Date.now()): Outcome {
  if (delivery.attempts >= 3) return { status: 'failed', error_code: code };
  return {
    status: 'pending', error_code: code,
    next_attempt_at: new Date(now + 60_000 * 2 ** (delivery.attempts - 1)).toISOString(),
  };
}

export function ticketOutcome(delivery: Delivery, value: unknown): Outcome {
  if (value && typeof value === 'object') {
    const ticket = value as { status?: string; id?: string; details?: { error?: string } };
    if (ticket.status === 'ok' && typeof ticket.id === 'string' && ticket.id) {
      return { status: 'accepted', ticket_id: ticket.id, error_code: null };
    }
    if (ticket.status === 'error') {
      const code = ticket.details?.error ?? 'ExpoTicketError';
      return code === 'MessageRateExceeded' ? retry(delivery, code) : { status: 'failed', error_code: code };
    }
  }
  return { status: 'unknown', error_code: 'InvalidExpoResponse' };
}

export function expoHeaders(accessToken?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

export async function sendBatch(
  deliveries: Delivery[],
  accessToken?: string,
  request: typeof fetch = fetch,
): Promise<Outcome[]> {
  if (!deliveries.length) return [];
  try {
    const response = await request('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: expoHeaders(accessToken),
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify(deliveries.map((d) => ({
        to: d.expo_push_token, title: d.title, body: d.body,
        sound: 'default', channelId: 'default', ttl: 1800,
        data: { type: 'daily-reminder', deliveryId: d.id },
      }))),
    });
    if (response.status === 429 || response.status >= 500) {
      return deliveries.map((d) => retry(d, `ExpoHTTP${response.status}`));
    }
    if (!response.ok) {
      return deliveries.map(() => ({ status: 'failed', error_code: `ExpoHTTP${response.status}` }));
    }
    const result = await response.json();
    if (!Array.isArray(result.data) || result.data.length !== deliveries.length) {
      return deliveries.map(() => ({ status: 'unknown', error_code: 'InvalidExpoResponse' }));
    }
    return deliveries.map((d, i) => ticketOutcome(d, result.data[i]));
  } catch {
    // A timeout/network disconnect does not prove Expo rejected the request.
    return deliveries.map(() => ({ status: 'unknown', error_code: 'ExpoNetworkOutcomeUnknown' }));
  }
}
