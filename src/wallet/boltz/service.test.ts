
import { BoltzSwapService } from './service';
import type { BoltzConfig } from './config';
import * as repository from './repository';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

jest.mock('@/core/keys', () => ({
  loadMnemonic: jest.fn().mockResolvedValue(TEST_MNEMONIC),
}));

jest.mock('./repository', () => ({
  upsertSwap: jest.fn(),
  getSwap: jest.fn().mockReturnValue({
    id: 'reverse-swap-id',
    direction: 'reverse',
    asset: 'BTC',
    status: 'swap.created',
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600_000,
    keyIndex: 0,
    ourPublicKey: '02' + '00'.repeat(32),
    theirPublicKey: '02' + '00'.repeat(32),
    preimageHash: '00'.repeat(32),
    swapTree: {
      claimLeaf: { version: 192, output: '51' },
      refundLeaf: { version: 192, output: '00' },
    },
    lockupAddress: 'bcrt1...lockup',
    timeoutBlockHeight: 1000,
    invoice: 'lnbc...hold',
    onchainAmount: 95000,
    destinationAddress: 'bcrt1p...dest',
    refunded: false,
  }),
  listSwaps: jest.fn().mockReturnValue([]),
  listPendingSwaps: jest.fn().mockReturnValue([]),
  updateSwapStatus: jest.fn(),
  updateSwapLockupTx: jest.fn(),
  updateSwapClaimTx: jest.fn(),
  markSwapRefunded: jest.fn(),
}));

jest.mock('./client', () => ({
  BoltzClient: jest.fn().mockImplementation(() => ({
    getReversePairs: jest.fn().mockResolvedValue({
      BTC: {
        BTC: {
          hash: 'reverse-hash',
          rate: 1,
          limits: { minimal: 50000, maximal: 25000000 },
          fees: { percentage: 0.5, minerFees: { lockup: 2, claim: 1998 } },
        },
      },
    }),
    getSubmarinePairs: jest.fn().mockResolvedValue({
      BTC: {
        BTC: {
          hash: 'submarine-hash',
          rate: 1,
          limits: { minimal: 50000, maximal: 25000000, maximalZeroConf: 0 },
          fees: { percentage: 0.1, minerFees: 4379 },
        },
      },
    }),
    createReverseSwap: jest.fn().mockResolvedValue({
      id: 'reverse-swap-id',
      invoice: 'lnbc...hold',
      swapTree: {
        claimLeaf: { version: 192, output: '51' },
        refundLeaf: { version: 192, output: '00' },
      },
      lockupAddress: 'bcrt1...lockup',
      refundPublicKey: '02' + '00'.repeat(32),
      timeoutBlockHeight: 1000,
      onchainAmount: 95000,
    }),
    createSubmarineSwap: jest.fn().mockResolvedValue({
      id: 'submarine-swap-id',
      address: 'bcrt1...deposit',
      swapTree: {
        claimLeaf: { version: 192, output: '51' },
        refundLeaf: { version: 192, output: '00' },
      },
      claimPublicKey: '02' + '00'.repeat(32),
      timeoutBlockHeight: 1000,
      expectedAmount: 100000,
      acceptZeroConf: false,
    }),
    getSwapStatus: jest.fn()
      .mockResolvedValueOnce({ status: 'swap.created' })
      .mockResolvedValueOnce({ status: 'swap.expired' }),
    broadcastTransaction: jest.fn().mockResolvedValue({ id: 'claim-tx-id' }),
  })),
}));

function makeLnbitsMock() {
  return {
    createInvoice: jest.fn().mockResolvedValue({ bolt11: 'lnbc...invoice', paymentHash: 'ph' }),
    payInvoice: jest.fn().mockResolvedValue({ preimage: 'preimage', feeSat: 0 }),
  };
}

describe('BoltzSwapService', () => {
  const cfg: BoltzConfig = {
    apiUrl: 'https://api.boltz.exchange',
    network: 'mainnet',
    pair: { from: 'BTC', to: 'BTC' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a submarine swap and returns a deposit address', async () => {
    const lnbits = makeLnbitsMock() as any;
    const service = new BoltzSwapService(cfg, lnbits);
    await service.initialize();

    const res = await service.getDepositAddress(100000);
    expect(res.address).toBe('bcrt1...deposit');
    expect(res.swapId).toBe('submarine-swap-id');
    expect(lnbits.createInvoice).toHaveBeenCalledWith(100000, 'Boltz on-chain deposit');
    expect(repository.upsertSwap).toHaveBeenCalled();
  });

  it('validates submarine swap amount against pair limits', async () => {
    const lnbits = makeLnbitsMock() as any;
    const service = new BoltzSwapService(cfg, lnbits);
    await service.initialize();

    await expect(service.getDepositAddress(100)).rejects.toThrow('outside Boltz limits');
  });

  it('creates a reverse swap and pays the hold invoice', async () => {
    const lnbits = makeLnbitsMock() as any;
    const service = new BoltzSwapService(cfg, lnbits);
    await service.initialize();

    // Skip the claim flow by overriding getSwapStatus to stay in created status.
    await expect(service.swapOut('bcrt1p...dest', 100000)).rejects.toThrow('reverse swap failed');
    expect(lnbits.payInvoice).toHaveBeenCalledWith('lnbc...hold');
    expect(repository.upsertSwap).toHaveBeenCalled();
  });
});
