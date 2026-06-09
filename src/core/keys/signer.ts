// Core Signer. Raw key lives only inside a short-lived Uint8Array for the
// duration of the sign call, then `.fill(0)`. JS strings cannot be wiped — so
// the key is NEVER materialized as a string here, never logged, never returned
// (CLAUDE.md constraint 5 / SEC-04; honest limit per Pitfall 3).
import { finalizeEvent } from 'nostr-tools/pure';
import type { EventTemplate, VerifiedEvent } from 'nostr-tools/pure';

type PrivkeySource = Uint8Array | (() => Promise<Uint8Array> | Uint8Array);

async function resolveKey(src: PrivkeySource): Promise<Uint8Array> {
  return typeof src === 'function' ? await src() : src;
}

/**
 * Sign a Nostr event. The private key is provided by an injected source
 * (the biometric-gated vault loader in production) so this stays unit-testable.
 * The key buffer is zeroized in a finally block even if signing throws.
 */
export async function signEvent(
  unsigned: EventTemplate,
  loadPrivkey: PrivkeySource,
): Promise<VerifiedEvent> {
  const sk = await resolveKey(loadPrivkey);
  try {
    return finalizeEvent(unsigned, sk);
  } finally {
    sk.fill(0);
  }
}
