// NIP-98 auth signer — verified against the EXACT checks BitRent's verifyAuthEvent
// runs server-side (kind 27235, u/method tags, content === challenge, fresh
// created_at, valid Schnorr sig per nostr-tools verifyEvent).
//
// Run: `npx jest src/core/keys/nostrAuth.test.ts`
import { verifyEvent } from 'nostr-tools/pure';
import { signNip98Auth, NIP98_KIND } from './nostrAuth';
import { deriveNostrIdentity } from './derivation';

// Deterministic test mnemonic (NIP-06 vector seed — NOT a live key).
const MNEMONIC =
  'leader monkey parrot ring guide accident before fence cannon height naive bean';

const URL = 'https://bitrent.vercel.app/api/auth/verify';
const CHALLENGE = 'a'.repeat(64);

describe('signNip98Auth (NIP-98 / BitRent login contract)', () => {
  it('produces the exact event shape verifyAuthEvent checks', async () => {
    const ev = await signNip98Auth(MNEMONIC, { url: URL, method: 'post', challenge: CHALLENGE });
    expect(ev.kind).toBe(NIP98_KIND);
    expect(ev.content).toBe(CHALLENGE);
    expect(ev.tags).toContainEqual(['u', URL]);
    expect(ev.tags).toContainEqual(['method', 'POST']); // uppercased
    expect(Math.abs(Math.floor(Date.now() / 1000) - ev.created_at)).toBeLessThanOrEqual(5);
  });

  it('signs with the NIP-06 identity key and verifies cryptographically', async () => {
    const ev = await signNip98Auth(MNEMONIC, { url: URL, method: 'POST', challenge: CHALLENGE });
    expect(ev.pubkey).toBe(deriveNostrIdentity(MNEMONIC).pubkeyHex);
    expect(verifyEvent(ev)).toBe(true); // same check the server runs
  });

  it('never exposes private material in the returned object', async () => {
    const ev = await signNip98Auth(MNEMONIC, { url: URL, method: 'POST', challenge: CHALLENGE });
    const json = JSON.stringify(ev);
    expect(Object.keys(ev).sort()).toEqual(
      ['content', 'created_at', 'id', 'kind', 'pubkey', 'sig', 'tags'].sort(),
    );
    expect(json).not.toContain('leader monkey'); // mnemonic never serialized
  });

  it('rejects missing parameters (fail-closed)', async () => {
    await expect(
      signNip98Auth(MNEMONIC, { url: URL, method: 'POST', challenge: '' }),
    ).rejects.toThrow(/required/);
  });
});
