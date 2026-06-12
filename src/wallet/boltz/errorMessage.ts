// Boltz error → UI i18n key + params. Keeps raw backend text out of the UI layer.
import { BoltzLimitError } from './service';

export type BoltzErrorKey =
  | 'send.onchainErr.limits'
  | 'send.onchainErr.expired'
  | 'send.onchainErr.lockupFailed'
  | 'send.onchainErr.generic'
  | 'receive.onchainErr.limits'
  | 'receive.onchainErr.generic';

export interface BoltzErrorMessage {
  key: BoltzErrorKey;
  params?: Record<string, string | number>;
}

export function parseBoltzError(error: unknown): BoltzErrorMessage {
  const e = error instanceof Error ? error : new Error(String(error));
  const msg = e.message.toLowerCase();

  if (e instanceof BoltzLimitError) {
    return {
      key: 'send.onchainErr.limits',
      params: { min: e.min, max: e.max },
    };
  }
  if (msg.includes('outside boltz limits')) {
    const limits = msg.match(/(\d+)-(\d+)/);
    return {
      key: 'send.onchainErr.limits',
      params: { min: limits?.[1] ?? '?', max: limits?.[2] ?? '?' },
    };
  }
  if (msg.includes('swap.expired') || msg.includes('invoice.expired')) {
    return { key: 'send.onchainErr.expired' };
  }
  if (msg.includes('transaction.lockupfailed') || msg.includes('lockup failed')) {
    return { key: 'send.onchainErr.lockupFailed' };
  }
  return { key: 'send.onchainErr.generic' };
}

export function parseBoltzReceiveError(error: unknown): BoltzErrorMessage {
  const base = parseBoltzError(error);
  if (base.key === 'send.onchainErr.limits') return { ...base, key: 'receive.onchainErr.limits' };
  return { key: 'receive.onchainErr.generic' };
}
