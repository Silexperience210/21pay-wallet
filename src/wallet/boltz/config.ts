// Boltz runtime configuration. All secrets (mnemonic, swap keys) live in the Core
// Vault; only non-secret endpoint/network settings are read from build-time env vars.
import type { SwapAsset } from './types';

export const BOLTZ_MAINNET_URL = 'https://api.boltz.exchange';
export const BOLTZ_REGTEST_URL = 'http://127.0.0.1:9001';

export type BoltzNetwork = 'mainnet' | 'regtest';

export interface BoltzConfig {
  apiUrl: string;
  network: BoltzNetwork;
  pair: { from: SwapAsset; to: SwapAsset };
  referralId?: string;
}

export function loadBoltzConfig(): BoltzConfig {
  const url = process.env.EXPO_PUBLIC_BOLTZ_URL ?? BOLTZ_MAINNET_URL;
  const network = (process.env.EXPO_PUBLIC_BOLTZ_NETWORK ?? 'mainnet') as BoltzNetwork;
  const pairRaw = process.env.EXPO_PUBLIC_BOLTZ_PAIR ?? 'BTC/BTC';
  const [from, to] = pairRaw.split('/').map((s: string) => s.trim() as SwapAsset);
  if (!from || !to) throw new Error('EXPO_PUBLIC_BOLTZ_PAIR must be "FROM/TO" (e.g. BTC/BTC)');
  return {
    apiUrl: url.replace(/\/+$/, ''),
    network,
    pair: { from, to },
    referralId: process.env.EXPO_PUBLIC_BOLTZ_REFERRAL || undefined,
  };
}

export function boltzNetworkName(network: BoltzNetwork): 'bitcoin' | 'regtest' {
  return network === 'mainnet' ? 'bitcoin' : 'regtest';
}
