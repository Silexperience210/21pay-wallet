// Jest manual mock for @getalby/sdk (node/jest env must never open a real Nostr
// relay WebSocket). Mirrors the manual-mock style of react-native-keychain /
// expo-secure-store: each SDK method is a jest.fn() resolving a sensible default
// so a test can override per-case with mockResolvedValueOnce(...).
//
// The real package also exposes `@getalby/sdk/nwc`; the subpath shim
// (__mocks__/@getalby/sdk/nwc.ts) re-exports from here so both import styles work.
//
// NWC is msat-denominated: getBalance.balance / payInvoice.fees_paid are msats.

export interface MockGetInfoResult {
  methods: string[];
  alias?: string;
  pubkey?: string;
  network?: string;
}

// NWCClient — the lower-level NIP-47 client constructed from a
// nostr+walletconnect:// URI. Every method is a spy with a default resolution.
export class NWCClient {
  options: { nostrWalletConnectUrl?: string } | undefined;

  constructor(options?: { nostrWalletConnectUrl?: string }) {
    this.options = options;
  }

  getBalance = jest.fn(async () => ({ balance: 0 /* msats */ }));

  makeInvoice = jest.fn(async (_args?: { amount?: number; description?: string }) => ({
    invoice: 'lnbc1mockinvoice',
    payment_hash: 'mockhash',
  }));

  payInvoice = jest.fn(async (_args?: { invoice: string }) => ({
    preimage: 'mockpreimage',
    fees_paid: 0 /* msats */,
  }));

  getInfo = jest.fn(async (): Promise<MockGetInfoResult> => ({
    methods: [
      'get_balance',
      'make_invoice',
      'pay_invoice',
      'lookup_invoice',
      'list_transactions',
      'get_budget',
    ],
    alias: 'mock-node',
    pubkey: 'mocknodepubkey',
    network: 'mainnet',
  }));

  getBudget = jest.fn(async () => ({
    used_budget: 0,
    total_budget: 0,
    renews_at: 0,
  }));

  listTransactions = jest.fn(async (_args?: unknown) => ({ transactions: [] as unknown[] }));

  lookupInvoice = jest.fn(async (_args?: { payment_hash?: string; invoice?: string }) => ({
    settled_at: null as number | null,
    payment_hash: 'mockhash',
    preimage: null as string | null,
    amount: 0,
  }));

  close = jest.fn(() => {});
}
