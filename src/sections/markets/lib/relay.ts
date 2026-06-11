// Minimal dependency-free Nostr relay client — ported from hunch-web (mirrors
// `hunch-nostr::relay`). React Native provides the global WebSocket. One-shot
// REQ → EVENT* → EOSE reads + a publish (EVENT → OK) path.
import type { NostrEvent } from './hunch';

export interface RelayFilter {
  kinds?: number[];
  authors?: string[];
  ids?: string[];
  limit?: number;
  since?: number;
  until?: number;
  [tag: `#${string}`]: string[] | number[] | undefined;
}

/** Opens a one-shot subscription on one relay; resolves with events at EOSE/timeout. */
export function queryRelay(url: string, filter: RelayFilter, timeoutMs = 8000): Promise<NostrEvent[]> {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    let settled = false;
    let ws: WebSocket;
    const subId = 'hunch-' + Math.random().toString(36).slice(2, 10);

    const done = () => {
      if (settled) return;
      settled = true;
      try {
        ws.send(JSON.stringify(['CLOSE', subId]));
        ws.close();
      } catch {
        /* already closed */
      }
      resolve(events);
    };

    const timer = setTimeout(done, timeoutMs);

    try {
      ws = new WebSocket(url);
    } catch {
      clearTimeout(timer);
      resolve([]);
      return;
    }

    ws.onopen = () => ws.send(JSON.stringify(['REQ', subId, filter]));
    ws.onerror = () => {
      clearTimeout(timer);
      done();
    };
    ws.onmessage = (msg) => {
      let m: unknown[];
      try {
        m = JSON.parse(typeof msg.data === 'string' ? msg.data : '');
      } catch {
        return;
      }
      if (m[0] === 'EVENT' && m[1] === subId) events.push(m[2] as NostrEvent);
      else if (m[0] === 'EOSE' && m[1] === subId) {
        clearTimeout(timer);
        done();
      }
    };
  });
}

/** Queries several relays in parallel and de-duplicates events by id. */
export async function queryRelays(urls: string[], filter: RelayFilter, timeoutMs = 8000): Promise<NostrEvent[]> {
  const results = await Promise.all(urls.map((u) => queryRelay(u, filter, timeoutMs)));
  const byId = new Map<string, NostrEvent>();
  for (const evs of results) for (const ev of evs) if (ev?.id) byId.set(ev.id, ev);
  return [...byId.values()];
}

/** Publishes a SIGNED event to one relay; resolves true on ["OK", id, true]. */
export function publishToRelay(url: string, event: NostrEvent, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocket;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    try {
      ws = new WebSocket(url);
    } catch {
      clearTimeout(timer);
      resolve(false);
      return;
    }
    ws.onopen = () => ws.send(JSON.stringify(['EVENT', event]));
    ws.onerror = () => {
      clearTimeout(timer);
      done(false);
    };
    ws.onmessage = (msg) => {
      let m: unknown[];
      try {
        m = JSON.parse(typeof msg.data === 'string' ? msg.data : '');
      } catch {
        return;
      }
      if (m[0] === 'OK' && m[1] === event.id) {
        clearTimeout(timer);
        done(m[2] === true);
      }
    };
  });
}

/** Publishes to several relays; true when at least one accepted (multi-relay by design). */
export async function publishToRelays(urls: string[], event: NostrEvent, timeoutMs = 8000): Promise<boolean> {
  const oks = await Promise.all(urls.map((u) => publishToRelay(u, event, timeoutMs)));
  return oks.some(Boolean);
}
