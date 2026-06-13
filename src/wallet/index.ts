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
export { pollUntilTerminal } from './backends/pollPaymentStatus';
export type { PollOptions } from './backends/pollPaymentStatus';
export { resolveLnurlPay, lnurlToUrl } from './lnurl';
export type { LnurlPayParams } from './lnurl';
export {
  WalletProvider,
  useWallet,
  activateCustodial,
  activateNwc,
  activateSelfHosted,
  createAndActivateCustodial,
  createAndActivateNwc,
  ensureMasterKey, syncHistory,
  getActiveCustodialConfig,
  getActiveSparkConfig,
  rehydrate,
  switchToCustodial,
  switchToNwc,
  switchToSelfHosted,
  activateArk,
  switchToArk,
} from './walletProvider';
export { createCustodialAccount } from './backends/custodialProvision';
export { clearPersistedBackends } from './backendPersist';
// Config types only — concrete backend classes are NEVER exported (CLAUDE.md #5).
export type { NwcConnectionConfig, NodeBudget } from './backends/nwcRemote';
export type { SparkConfig } from './sparkConfig';
export { SPARK_READY } from './sparkConfig';
export { provisionSpark } from './sparkProvision';
export type { ArkConfig } from './arkConfig';
export { ARK_READY } from './arkConfig';
export { provisionArk } from './arkProvision';
export { parseNwcUri } from './backends/nwcConfig';
// Pure migration orchestration (D-06) — not a concrete backend.
export { sendAll, isSameNode } from './backends/migration';
export {
  listConnections,
  loadConnectionConfig,
  getActiveConnectionConfig,
  setActiveConnection,
  deleteConnection,
} from './connections';
export type { NwcConnectionMeta } from './connections';
