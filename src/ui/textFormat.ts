// Small pure text helpers for the UI layer (kept out of components so they're unit-testable).

/** Middle-ellipsize a long string (invoices/addresses): keep head + tail, … in between. */
export function ellipsizeMiddle(s: string, head = 10, tail = 10): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
