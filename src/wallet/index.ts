// Public wallet barrel. Exposes the interface + types only — never a concrete
// backend (CLAUDE.md constraint 5). Provider/useWallet are appended in a later plan.
export type { WalletBackend } from './WalletBackend';
export type {
  PaymentStatus,
  BackendKind,
  PerBackendBalance,
  WalletTx,
  WalletCapabilities,
} from './types';
export { isTerminalStatus, PAYMENT_TERMINAL } from './types';
// Concrete backends are intentionally NOT exported here (CLAUDE.md constraint 5).
export type { CustodialLnbitsConfig } from './lnbitsConfig';
export { transition, mapLnbitsToStatus } from './backends/paymentStateMachine';
