// NIP-98 HTTP-Auth signer over the master Nostr IDENTITY key (m/44'/1237'/0'/0/0).
// This is the unified-identity primitive sections use to log into ecosystem services
// (BitRent Phase 6: challenge → signed kind-27235 event → JWT). Contrast with
// lnurlAuth.ts (LUD-04 ECDSA per-domain key): NIP-98 deliberately IS the identity —
// the service account is bound to the user's one Nostr identity by design (IDENT-*).
//
// Raw key discipline (SEC-04): the privkey is materialized only inside signEvent
// (signer.ts), which zeroizes it in a finally block. Only the SIGNED event (public
// by construction) leaves this module.
import { signEvent } from './signer';
import { loadNostrPrivkeyBytes } from './derivation';

export const NIP98_KIND = 27235;

/** A signed NIP-98 event — public data only (id/pubkey/sig are meant to be sent). */
export interface Nip98Event {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** Sign a NIP-98 HTTP-Auth event: kind 27235, content = the server challenge,
 *  tags = [['u', url], ['method', method]] (the exact shape BitRent's
 *  verifyAuthEvent checks). The mnemonic is consumed here and never returned. */
export async function signNip98Auth(
  mnemonic: string,
  opts: { url: string; method: string; challenge: string },
): Promise<Nip98Event> {
  if (!opts.url || !opts.method || !opts.challenge) {
    throw new Error('nip98: url, method and challenge are all required');
  }
  const event = await signEvent(
    {
      kind: NIP98_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', opts.url],
        ['method', opts.method.toUpperCase()],
      ],
      content: opts.challenge,
    },
    () => loadNostrPrivkeyBytes(mnemonic),
  );
  // VerifiedEvent is structurally a Nip98Event; spread to a plain object so no
  // nostr-tools symbol/verified marker crosses the Core boundary.
  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    sig: event.sig,
  };
}
