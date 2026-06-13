// zustand store: each backend's balance kept SEPARATE + always-on custody badge.
// No merged-total selector — ONBD-05 forbids one spendable number across backends.
import { create } from 'zustand';
import type { BackendKind, PerBackendBalance, WalletTx } from '../../wallet/types';
import { listTxByBackend } from './db';

export interface WalletState {
  activeBackendKind: BackendKind | null;
  balances: Partial<Record<BackendKind, PerBackendBalance>>;
  txByBackend: Partial<Record<BackendKind, WalletTx[]>>;
  setActiveBackend: (kind: BackendKind) => void;
  setBalance: (kind: BackendKind, balance: PerBackendBalance) => void;
  hydrateHistory: (kind: BackendKind) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  activeBackendKind: null,
  balances: {},
  txByBackend: {},
  setActiveBackend: (kind) => set({ activeBackendKind: kind }),
  setBalance: (kind, balance) => set((s) => ({ balances: { ...s.balances, [kind]: balance } })),
  hydrateHistory: (kind) =>
    set((s) => ({ txByBackend: { ...s.txByBackend, [kind]: listTxByBackend(kind) } })),
}));

const BADGE_LABELS: Record<BackendKind, string> = {
  'custodial-lnbits': '21pay Custodial',
  nwc: 'Connected Node (NWC)',
  'self-hosted': 'Self-Hosted',
  ark: 'Ark · Self-Hosted',
};

// Always available whenever a backend is active — the user can never be misled
// about who holds the funds (ONBD-05).
export function custodyBadge(
  state: Pick<WalletState, 'activeBackendKind'>,
): { kind: BackendKind; label: string } | null {
  return state.activeBackendKind
    ? { kind: state.activeBackendKind, label: BADGE_LABELS[state.activeBackendKind] }
    : null;
}
