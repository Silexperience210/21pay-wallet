// Ordered, replay-safe offline mutation queue. A retried payment must be sent at
// most once (T-02-04): enqueue of an already-pending/acked dedupeKey is a no-op.
// In-memory here, with serialize()/hydrate() so a later SQLite layer can persist it.
import { httpRequest } from './http';
import type { HttpRequestOptions } from './types';

export interface QueueItem {
  dedupeKey: string;
  request: HttpRequestOptions;
}

let pending: QueueItem[] = [];
let acked = new Set<string>();

/** Returns false (no-op) if the dedupeKey is already pending or already acked. */
export function enqueue(item: QueueItem): boolean {
  if (acked.has(item.dedupeKey) || pending.some((p) => p.dedupeKey === item.dedupeKey)) {
    return false;
  }
  pending.push(item);
  return true;
}

/** FIFO drain. Stops at the first failure to preserve order; failed item stays pending. */
export async function drain(): Promise<{ processed: number; remaining: number }> {
  let processed = 0;
  while (pending.length > 0) {
    const item = pending[0];
    try {
      await httpRequest(item.request);
    } catch {
      break;
    }
    acked.add(item.dedupeKey);
    pending.shift();
    processed++;
  }
  return { processed, remaining: pending.length };
}

export function serialize(): string {
  return JSON.stringify({ pending, acked: [...acked] });
}

export function hydrate(json: string): void {
  const o = JSON.parse(json) as { pending?: QueueItem[]; acked?: string[] };
  pending = o.pending ?? [];
  acked = new Set(o.acked ?? []);
}

export function __resetQueueForTests(): void {
  pending = [];
  acked = new Set();
}
