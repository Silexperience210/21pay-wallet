import { ellipsizeMiddle } from './textFormat';

describe('ellipsizeMiddle', () => {
  it('leaves short strings untouched', () => {
    expect(ellipsizeMiddle('short')).toBe('short');
    expect(ellipsizeMiddle('a'.repeat(21))).toBe('a'.repeat(21)); // head+tail+1
  });

  it('middle-ellipsizes long strings keeping head + tail', () => {
    const s = 'lnbc1234567890abcdefghijABCDEFGHIJ';
    const out = ellipsizeMiddle(s, 10, 10);
    expect(out).toBe('lnbc123456…ABCDEFGHIJ');
    expect(out).toContain('…');
  });
});
