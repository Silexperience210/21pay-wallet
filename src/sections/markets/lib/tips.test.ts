// Tip helpers — pure cases ported from hunch-web/lib/tips.test.ts (jest style).
//
// Run: `npx jest src/sections/markets/lib/tips.test.ts`
import { lnAddressToLnurlp, TIP_PRESETS } from './tips';

describe('tips', () => {
  it('lnAddressToLnurlp builds the .well-known/lnurlp URL', () => {
    expect(lnAddressToLnurlp('hunch@21pay.org')).toBe('https://21pay.org/.well-known/lnurlp/hunch');
    expect(lnAddressToLnurlp('  tips@example.com  ')).toBe('https://example.com/.well-known/lnurlp/tips');
  });

  it('lnAddressToLnurlp rejects a malformed address', () => {
    expect(() => lnAddressToLnurlp('notanaddress')).toThrow();
    expect(() => lnAddressToLnurlp('@domain.com')).toThrow();
    expect(() => lnAddressToLnurlp('name@')).toThrow();
  });

  it('presets are positive sats', () => {
    expect(TIP_PRESETS.every((p) => Number.isInteger(p) && p > 0)).toBe(true);
  });
});
