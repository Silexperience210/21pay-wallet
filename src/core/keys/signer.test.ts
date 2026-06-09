// Req SEC-04 — VALIDATION.md "signer" row.
// Proves: verifiable signature, zeroize-after-sign, no raw-key in the return.
import { signEvent } from './signer';
import { verifyEvent } from 'nostr-tools/pure';
import { NIP06_VECTOR_1 } from './fixtures/nip06-vectors';

const skBytes = () => Uint8Array.from(Buffer.from(NIP06_VECTOR_1.privKeyHex, 'hex'));
const template = () => ({ kind: 1, created_at: 1700000000, tags: [] as string[][], content: 'gm' });

describe('signer (load -> sign -> zeroize)', () => {
  it('produces an event that verifyEvent accepts', async () => {
    const ev = await signEvent(template(), skBytes());
    expect(verifyEvent(ev)).toBe(true);
  });

  it('zeroizes the key buffer after signing (finally)', async () => {
    const buf = skBytes();
    await signEvent(template(), buf);
    expect(Array.from(buf).every((b) => b === 0)).toBe(true);
  });

  it('returns only the signed event — no raw-key field', async () => {
    const ev = (await signEvent(template(), skBytes())) as unknown as Record<string, unknown>;
    expect(ev.sig).toBeDefined();
    expect(ev.privkey).toBeUndefined();
    expect(ev.sk).toBeUndefined();
    expect(ev.privateKey).toBeUndefined();
  });

  it('accepts an async loader and still zeroizes', async () => {
    const buf = skBytes();
    await signEvent(template(), async () => buf);
    expect(Array.from(buf).every((b) => b === 0)).toBe(true);
  });
});
