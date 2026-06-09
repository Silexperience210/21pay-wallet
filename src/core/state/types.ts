// Core state types. Re-exports the wallet domain types it depends on.
export type { BackendKind, PaymentStatus, PerBackendBalance, WalletTx } from '../../wallet/types';

export interface MigrationState {
  version: number;
}
