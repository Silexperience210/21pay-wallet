// LMSR + AMM quote layer — ported from hunch-web (lmsr.test.ts + amm.test.ts), in
// jest style. Pure math; locks the mint-as-market-maker pricing the 1-click bet relies
// on (instant liquidity, slippage, maker fee matching the Rust hunch-mm pool).
//
// Run: `npx jest src/sections/markets/lib/amm.test.ts`
import { cost, costToBuy, maxSubsidy, priceYes } from './lmsr';
import { inventoryForProb, quoteBet, sharesForStake } from './amm';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('lmsr core', () => {
  it('empty market is 50/50 and costs b·ln2', () => {
    expect(near(priceYes(0, 0, 1000), 0.5)).toBe(true);
    expect(near(cost(0, 0, 1000), maxSubsidy(1000))).toBe(true);
  });

  it('buying YES raises the YES price (but stays < 1)', () => {
    const before = priceYes(0, 0, 1000);
    const after = priceYes(500, 0, 1000);
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThan(1);
  });

  it('costToBuy is positive and below the share count (price < 1)', () => {
    const c = costToBuy('YES', 100, 0, 0, 1000);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(100);
  });

  it('max subsidy is b·ln2', () => {
    expect(near(maxSubsidy(14400), 14400 * Math.LN2)).toBe(true);
  });
});

describe('amm quote', () => {
  it('inventoryForProb is 0 at 50% and prices back to p', () => {
    expect(near(inventoryForProb(0.5, 1000), 0)).toBe(true);
    const q = quoteBet('YES', 0, 0.7, 1000);
    expect(near(q.priceYes, 0.7, 1e-3)).toBe(true);
  });

  it('a 50/50 market quotes ~0.5 each side and pays out more than you stake', () => {
    const q = quoteBet('YES', 100, 0.5, 10000);
    expect(near(q.priceYes, 0.5) && near(q.priceNo, 0.5)).toBe(true);
    expect(q.shares).toBeGreaterThan(100); // price < 1, so 100 sats buys > 100 sats of payout
    expect(q.avgPrice).toBeGreaterThan(0.5); // slippage pushes avg above spot
    expect(q.avgPrice).toBeLessThan(1);
    expect(q.priceAfter).toBeGreaterThan(q.priceYes); // buying YES raises the YES price
  });

  it('YES and NO are symmetric at 50%', () => {
    const y = quoteBet('YES', 250, 0.5, 10000);
    const n = quoteBet('NO', 250, 0.5, 10000);
    expect(near(y.shares, n.shares, 1e-6)).toBe(true);
    expect(near(y.avgPrice, n.avgPrice)).toBe(true);
  });

  it('a more likely YES is more expensive (fewer shares per stake)', () => {
    const atEven = quoteBet('YES', 100, 0.5, 10000);
    const atFavored = quoteBet('YES', 100, 0.8, 10000);
    expect(atFavored.priceYes).toBeGreaterThan(atEven.priceYes);
    expect(atFavored.shares).toBeLessThan(atEven.shares);
  });

  it('maker fee is taken off the top and reduces shares (matches hunch-mm)', () => {
    const withFee = quoteBet('YES', 1000, 0.5, 10000, 200); // 2%
    const noFee = quoteBet('YES', 1000, 0.5, 10000, 0);
    expect(near(withFee.fee, (1000 * 0.02) / 1.02, 1e-6)).toBe(true);
    expect(near(noFee.fee, 0)).toBe(true);
    expect(withFee.shares).toBeLessThan(noFee.shares);
  });

  it('sharesForStake inverts costToBuy', () => {
    const shares = sharesForStake('YES', 100, 0, 0, 10000);
    expect(near(costToBuy('YES', shares, 0, 0, 10000), 100, 1e-3)).toBe(true);
  });
});
