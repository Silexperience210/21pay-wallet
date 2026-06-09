// Req WALLET-04 — unified payment-input classification.
import { parsePaymentInput } from './parsePaymentInput';

describe('parsePaymentInput', () => {
  it('classifies a BOLT11 invoice (any case, lightning: scheme stripped)', () => {
    expect(parsePaymentInput('lnbc1abc').kind).toBe('bolt11');
    expect(parsePaymentInput('LIGHTNING:lnbc1ABC')).toEqual({ kind: 'bolt11', invoice: 'lnbc1ABC' });
    expect(parsePaymentInput('  lntb1xyz  ').kind).toBe('bolt11');
  });

  it('classifies an LNURL', () => {
    expect(parsePaymentInput('lnurl1dp68gurn8ghj7').kind).toBe('lnurl');
  });

  it('classifies a Lightning Address', () => {
    expect(parsePaymentInput('alice@21pay.org')).toEqual({
      kind: 'lnaddr',
      name: 'alice',
      domain: '21pay.org',
    });
  });

  it('classifies BIP21 with integer-exact sats and an embedded lightning invoice', () => {
    const r = parsePaymentInput('bitcoin:bc1qexampleaddr0000000000000000000?amount=0.0001&lightning=lnbc1embedded');
    expect(r.kind).toBe('bip21');
    if (r.kind === 'bip21') {
      expect(r.amountSat).toBe(10000); // 0.0001 BTC exactly, no float drift
      expect(r.lightning).toBe('lnbc1embedded');
      expect(r.address).toBe('bc1qexampleaddr0000000000000000000');
    }
  });

  it('classifies a bare on-chain address (bech32 + legacy)', () => {
    expect(parsePaymentInput('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4').kind).toBe('onchain');
    expect(parsePaymentInput('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2').kind).toBe('onchain');
    expect(parsePaymentInput('tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3').kind).toBe('onchain');
  });

  it('returns unknown for empty/garbage and never throws', () => {
    expect(parsePaymentInput('').kind).toBe('unknown');
    expect(parsePaymentInput('hello world').kind).toBe('unknown');
    // @ts-expect-error runtime robustness
    expect(parsePaymentInput(undefined).kind).toBe('unknown');
  });
});
