// Req WALLET-08 — handle validation.
import { validateLnAddressHandle, LN_ADDRESS_DOMAIN } from './lnAddressHandle';

describe('validateLnAddressHandle', () => {
  it('accepts a valid handle', () => {
    expect(validateLnAddressHandle('alice').valid).toBe(true);
    expect(validateLnAddressHandle('bob_21-x').valid).toBe(true);
  });

  it('rejects bad charset (uppercase, spaces, @, dots, unicode)', () => {
    expect(validateLnAddressHandle('Alice').valid).toBe(false);
    expect(validateLnAddressHandle('a b').valid).toBe(false);
    expect(validateLnAddressHandle('a@b').valid).toBe(false);
    expect(validateLnAddressHandle('a.b').valid).toBe(false);
    expect(validateLnAddressHandle('café').valid).toBe(false);
  });

  it('rejects empty and >32 chars', () => {
    expect(validateLnAddressHandle('').valid).toBe(false);
    expect(validateLnAddressHandle('a'.repeat(33)).valid).toBe(false);
  });

  it('rejects reserved names (case-insensitive) with a reason', () => {
    const r = validateLnAddressHandle('Admin');
    expect(r.valid).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it('exposes a non-empty LN_ADDRESS_DOMAIN even when env is unset', () => {
    expect(typeof LN_ADDRESS_DOMAIN).toBe('string');
    expect(LN_ADDRESS_DOMAIN.length).toBeGreaterThan(0);
  });
});
