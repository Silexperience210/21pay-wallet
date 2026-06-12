import { parseBoltzError } from './errorMessage';
import { BoltzLimitError } from './service';

describe('parseBoltzError', () => {
  it('maps a BoltzLimitError to limits key with min/max', () => {
    const r = parseBoltzError(new BoltzLimitError(1_000, 10_000_000));
    expect(r.key).toBe('send.onchainErr.limits');
    expect(r.params).toEqual({ min: 1000, max: 10000000 });
  });

  it('falls back to parsing min/max from a plain limits message', () => {
    const r = parseBoltzError(new Error('amount outside Boltz limits (5000-2500000 sats)'));
    expect(r.key).toBe('send.onchainErr.limits');
    expect(r.params).toEqual({ min: '5000', max: '2500000' });
  });

  it('maps expired statuses', () => {
    expect(parseBoltzError(new Error('reverse swap failed: swap.expired')).key).toBe(
      'send.onchainErr.expired',
    );
    expect(parseBoltzError(new Error('invoice.expired')).key).toBe('send.onchainErr.expired');
  });

  it('maps lockup failure', () => {
    expect(parseBoltzError(new Error('transaction.lockupFailed')).key).toBe(
      'send.onchainErr.lockupFailed',
    );
  });

  it('maps anything else to generic', () => {
    expect(parseBoltzError(new Error('network timeout')).key).toBe('send.onchainErr.generic');
    expect(parseBoltzError('oops').key).toBe('send.onchainErr.generic');
  });
});
