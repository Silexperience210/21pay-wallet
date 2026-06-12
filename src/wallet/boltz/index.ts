// Boltz submarine-swap barrel. Backend integration only — sections still speak
// the WalletBackend interface and never import concrete swap internals.
export { BoltzSwapService, BoltzLimitError } from './service';
export { parseBoltzError, parseBoltzReceiveError } from './errorMessage';
export { loadBoltzConfig, boltzNetworkName } from './config';
export { validateOnchainAddress } from './crypto';
export type { BoltzConfig, BoltzNetwork } from './config';
export type {
  BoltzStatus,
  CreateReverseSwapRequest,
  CreateReverseSwapResponse,
  CreateSubmarineSwapRequest,
  CreateSubmarineSwapResponse,
  PersistedSwap,
  ReversePair,
  SubmarinePair,
  SwapAsset,
  SwapDirection,
  SwapLimits,
  SwapQuote,
  SwapTree,
} from './types';
