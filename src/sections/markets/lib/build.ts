// Event templates for the write path — ported from hunch-web (mirrors hunch-cli's
// order tags). Pure tag/content assembly; signing happens via the Core Signer
// capability (signer.signHunchEvent), never here.
import { KIND_ORDER } from './hunch';

export interface EventTemplate {
  kind: number;
  tags: string[][];
  content: string;
}

export interface OrderParams {
  market: string;
  side: 'YES' | 'NO';
  amount: number;
  price: number;
  kind: 'bid' | 'ask';
  expires: number;
}

/** Unsigned kind:38888 order template, with `d` == market (addressable + #d-filterable). */
export function buildOrderTemplate(p: OrderParams): EventTemplate {
  return {
    kind: KIND_ORDER,
    tags: [
      ['market', p.market],
      ['side', p.side],
      ['amount', String(p.amount)],
      ['price', String(p.price)],
      ['kind', p.kind],
      ['expires', String(p.expires)],
      ['d', p.market],
    ],
    content: '',
  };
}
