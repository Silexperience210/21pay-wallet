import { pollUntilTerminal } from './pollPaymentStatus';
import type { PaymentStatus } from '../types';

const noSleep = () => Promise.resolve();

describe('pollUntilTerminal', () => {
  it('returns immediately when already terminal (no sleep)', async () => {
    const sleep = jest.fn(noSleep);
    const reconcile = jest.fn().mockResolvedValue('settled' as PaymentStatus);
    expect(await pollUntilTerminal(reconcile, 'h', { sleep })).toBe('settled');
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('polls until terminal', async () => {
    const sleep = jest.fn(noSleep);
    const reconcile = jest
      .fn<Promise<PaymentStatus>, unknown[]>()
      .mockResolvedValueOnce('pending')
      .mockResolvedValueOnce('settled');
    expect(await pollUntilTerminal(reconcile, 'h', { sleep })).toBe('settled');
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('stops and keeps last status when reconcile throws', async () => {
    const reconcile = jest.fn().mockRejectedValue(new Error('backend down'));
    expect(await pollUntilTerminal(reconcile, 'h', { sleep: noSleep })).toBe('pending');
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('gives up after attempts, returning the last (non-terminal) status', async () => {
    const sleep = jest.fn(noSleep);
    const reconcile = jest.fn().mockResolvedValue('pending' as PaymentStatus);
    expect(await pollUntilTerminal(reconcile, 'h', { attempts: 3, sleep })).toBe('pending');
    expect(reconcile).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
