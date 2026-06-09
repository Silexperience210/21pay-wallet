// Req WALLET-09 — pure state machine, no IO.
import { transition, mapLnbitsToStatus } from './paymentStateMachine';

describe('paymentStateMachine', () => {
  it('allows the legal transitions out of pending', () => {
    expect(transition('pending', 'settled')).toBe('settled');
    expect(transition('pending', 'failed')).toBe('failed');
    expect(transition('pending', 'expired')).toBe('expired');
    expect(transition('pending', 'pending')).toBe('pending');
  });

  it('throws on any move out of a terminal state (no resurrection)', () => {
    expect(() => transition('settled', 'pending')).toThrow();
    expect(() => transition('failed', 'settled')).toThrow();
    expect(() => transition('expired', 'pending')).toThrow();
    // staying terminal is a no-op, allowed
    expect(transition('settled', 'settled')).toBe('settled');
  });

  it('maps LNbits responses to a status', () => {
    expect(mapLnbitsToStatus({ paid: true }, 100)).toBe('settled');
    expect(mapLnbitsToStatus({ paid: false, failed: true }, 100)).toBe('failed');
    expect(mapLnbitsToStatus({ paid: false }, 200, 100)).toBe('expired'); // now>expiry
    expect(mapLnbitsToStatus({ paid: false }, 100, 200)).toBe('pending'); // unexpired
  });
});
