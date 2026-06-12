// ContentWall client contract via mocked httpRequest — mirrors the extension's
// views_api.py routes (Silexperience210/contentwall@fc9f735).
//
// Run: `npx jest src/wallet/contentwall.test.ts`
jest.mock('../core/net', () => ({ httpRequest: jest.fn() }));

import { httpRequest } from '../core/net';
import {
  parseContentwallInput,
  getPublicItem,
  createUnlockInvoice,
  checkUnlock,
  pollUnlock,
  fetchPurchases,
  purchaseContentUrl,
  listMyItems,
  createArticleItem,
  shareUrl,
} from './contentwall';
import type { CustodialLnbitsConfig } from './lnbitsConfig';

const mockHttp = httpRequest as jest.Mock;
const lastCall = () => mockHttp.mock.calls[mockHttp.mock.calls.length - 1][0];

const ITEM = 'a1b2c3d4e5f6a7b8';
const HASH = 'f'.repeat(64);
const CFG = { adminKey: 'admin-key', invoiceKey: 'invoice-key' } as unknown as CustodialLnbitsConfig;

beforeEach(() => {
  mockHttp.mockReset().mockResolvedValue({ status: 200, data: {} });
});

describe('parseContentwallInput', () => {
  it('extracts the id from share, embed and signed-content URLs', () => {
    expect(parseContentwallInput(`https://21pay.org/contentwall/${ITEM}`)).toBe(ITEM);
    expect(parseContentwallInput(`https://21pay.org/contentwall/embed/${ITEM}`)).toBe(ITEM);
    expect(parseContentwallInput(`https://21pay.org/contentwall/content/${ITEM}?payment_hash=x&t=y`)).toBe(ITEM);
  });
  it('accepts a bare id and rejects junk', () => {
    expect(parseContentwallInput(`  ${ITEM}  `)).toBe(ITEM);
    expect(parseContentwallInput('https://evil.example/whatever')).toBeNull();
    expect(parseContentwallInput('')).toBeNull();
    expect(parseContentwallInput('ab')).toBeNull();
  });
});

describe('buyer flow (public endpoints)', () => {
  it('getPublicItem hits /public and degrades to null on older extensions', async () => {
    mockHttp.mockResolvedValueOnce({ status: 200, data: { id: ITEM, title: 'T', amount: 210 } });
    const item = await getPublicItem(ITEM);
    expect(lastCall()).toMatchObject({ path: `/contentwall/api/v1/items/${ITEM}/public`, idempotent: true });
    expect(item?.amount).toBe(210);
    mockHttp.mockRejectedValueOnce(new Error('404'));
    await expect(getPublicItem(ITEM)).resolves.toBeNull();
  });

  it('createUnlockInvoice posts to /items/invoice/{id}, omitting amount discovers the floor price', async () => {
    mockHttp.mockResolvedValueOnce({
      status: 201,
      data: { payment_hash: HASH, payment_request: 'lnbc1cw', amount: 210 },
    });
    const q = await createUnlockInvoice(ITEM);
    expect(lastCall()).toMatchObject({
      path: `/contentwall/api/v1/items/invoice/${ITEM}`,
      method: 'POST',
      body: {},
      idempotent: false,
    });
    expect(q.amount).toBe(210); // price discovered from the response
  });

  it('checkUnlock posts the payment_hash and surfaces the signed URL', async () => {
    mockHttp.mockResolvedValueOnce({
      status: 200,
      data: { paid: true, url: `https://21pay.org/contentwall/content/${ITEM}?payment_hash=${HASH}&t=tok` },
    });
    const s = await checkUnlock(ITEM, HASH);
    expect(lastCall()).toMatchObject({
      path: `/contentwall/api/v1/items/check/${ITEM}`,
      method: 'POST',
      body: { payment_hash: HASH },
    });
    expect(s.paid).toBe(true);
    expect(s.url).toContain('/contentwall/content/');
  });

  it('pollUnlock polls until paid', async () => {
    mockHttp
      .mockResolvedValueOnce({ status: 200, data: { paid: false } })
      .mockResolvedValueOnce({ status: 200, data: { paid: true, url: 'u' } });
    const s = await pollUnlock(ITEM, HASH, { sleep: async () => {} });
    expect(s.paid).toBe(true);
    expect(mockHttp).toHaveBeenCalledTimes(2);
  });

  it('fetchPurchases posts stored hashes (and skips the call when empty)', async () => {
    await expect(fetchPurchases([])).resolves.toEqual([]);
    expect(mockHttp).not.toHaveBeenCalled();
    mockHttp.mockResolvedValueOnce({
      status: 200,
      data: [{ item_id: ITEM, title: 'T', payment_hash: HASH, token: 'tok' }],
    });
    const list = await fetchPurchases([HASH]);
    expect(lastCall()).toMatchObject({ path: '/contentwall/api/v1/me/purchases', body: { hashes: [HASH] } });
    expect(list).toHaveLength(1);
  });

  it('purchaseContentUrl mirrors the server construction (token in `t`, no-token tolerated)', () => {
    expect(purchaseContentUrl({ item_id: ITEM, payment_hash: HASH, token: 'tok' })).toBe(
      `https://21pay.org/contentwall/content/${ITEM}?payment_hash=${HASH}&t=tok`,
    );
    expect(purchaseContentUrl({ item_id: ITEM, payment_hash: HASH })).toBe(
      `https://21pay.org/contentwall/content/${ITEM}?payment_hash=${HASH}`,
    );
  });
});

describe('creator flow (LNbits-keyed)', () => {
  it('listMyItems uses the INVOICE key', async () => {
    mockHttp.mockResolvedValueOnce({ status: 200, data: [{ id: ITEM, title: 'T' }] });
    await listMyItems(CFG);
    expect(lastCall()).toMatchObject({
      path: '/contentwall/api/v1/items',
      headers: { 'X-Api-Key': 'invoice-key' },
    });
  });

  it('createArticleItem uses the ADMIN key with the exact CreateItem shape', async () => {
    mockHttp.mockResolvedValueOnce({ status: 201, data: { id: ITEM } });
    await createArticleItem(CFG, { title: 'Mon article', amountSat: 210, content: '# Hello' });
    expect(lastCall()).toMatchObject({
      path: '/contentwall/api/v1/items',
      method: 'POST',
      headers: { 'X-Api-Key': 'admin-key' },
      body: { title: 'Mon article', content_type: 'article', article_content: '# Hello', amount: 210, currency: 'sat' },
      idempotent: false,
    });
  });

  it('createArticleItem validates before any request', async () => {
    await expect(createArticleItem(CFG, { title: '', amountSat: 210, content: 'x' })).rejects.toThrow(/title/);
    await expect(createArticleItem(CFG, { title: 't', amountSat: 0, content: 'x' })).rejects.toThrow(/amount/);
    await expect(createArticleItem(CFG, { title: 't', amountSat: 1, content: ' ' })).rejects.toThrow(/content/);
    expect(mockHttp).not.toHaveBeenCalled();
  });

  it('shareUrl builds the public paywall link', () => {
    expect(shareUrl(ITEM)).toBe(`https://21pay.org/contentwall/${ITEM}`);
  });
});
