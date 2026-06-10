// Jest manual mock for @breeztech/breez-sdk-spark-react-native. The real package
// is a Rust-FFI native module that cannot load under jest-expo / the node test
// env (mirrors how Phase 1 mocked react-native-keychain). No real IO: connect()
// returns an `sdk` whose methods are jest.fn() spies a test can override.
//
// Spark is sat-denominated (getInfo().balanceSats) and async-settlement
// (addEventListener / listPayments). v1 is LN-only (D-09): capabilities.onchain
// is false in the adapter, not here.

export const Network = {
  Mainnet: 'mainnet',
  Signet: 'signet',
} as const;

export type Network = (typeof Network)[keyof typeof Network];

export interface SparkConfig {
  apiKey: string;
  network: Network;
}

// defaultConfig(network) → a mutable config the caller sets `apiKey` on.
export const defaultConfig = jest.fn((network: Network): SparkConfig => ({
  apiKey: '',
  network,
}));

// The connected SDK handle. Every method is a spy resolving a sensible default.
export interface MockSparkSdk {
  getInfo: jest.Mock;
  receivePayment: jest.Mock;
  prepareSendPayment: jest.Mock;
  sendPayment: jest.Mock;
  prepareLnurlPay: jest.Mock;
  lnurlPay: jest.Mock;
  parse: jest.Mock;
  listPayments: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  disconnect: jest.Mock;
}

export function makeMockSparkSdk(): MockSparkSdk {
  return {
    getInfo: jest.fn(async (_args?: { ensureSynced?: boolean }) => ({ balanceSats: 0 })),
    receivePayment: jest.fn(async (_args?: unknown) => ({
      paymentRequest: 'lnbc1mockbreezinvoice',
      feeSats: 0,
    })),
    prepareSendPayment: jest.fn(async (_args?: { paymentRequest: string }) => ({
      amountSats: 0,
      feeSats: 0,
    })),
    sendPayment: jest.fn(async (_args?: unknown) => ({
      payment: { paymentId: 'mockpaymentid', status: 'completed' },
    })),
    prepareLnurlPay: jest.fn(async (_args?: unknown) => ({ amountSats: 0, feeSats: 0 })),
    lnurlPay: jest.fn(async (_args?: unknown) => ({
      payment: { paymentId: 'mocklnurlpaymentid', status: 'completed' },
    })),
    parse: jest.fn(async (_input: string) => ({ type: 'bolt11' })),
    listPayments: jest.fn(async (_args?: unknown) => [] as unknown[]),
    addEventListener: jest.fn(async (_listener: unknown) => 'mock-listener-id'),
    removeEventListener: jest.fn(async (_id: string) => {}),
    disconnect: jest.fn(async () => {}),
  };
}

// connect({ config, mnemonic, storageDir }) → a connected SDK handle.
export const connect = jest.fn(
  async (_args?: { config: SparkConfig; mnemonic: string; storageDir: string }) =>
    makeMockSparkSdk(),
);
