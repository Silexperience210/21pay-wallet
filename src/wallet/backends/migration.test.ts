// RED stub — Wave-0 gap enumeration for sendAll custody-migration orchestration
// (D-06). Filled in the migration plan. Pure logic with both backends injected
// (a transient two-backend op): invoice on the NEW backend, paid from the OLD.
//
// Run: `npx jest src/wallet/backends/migration.test.ts`

describe('sendAll — guided custody migration (D-06) [RED stub]', () => {
  // edge: nothing to move.
  it.todo('D-06: zero balance returns { moved: 0 } and skips the migration sheet');

  // fee reserve (Pitfall 4c): cannot send the entire balance, LN fee comes out of it.
  it.todo('D-06: reserves a fee buffer (sendable = balance - feeReserve), never sends the full balance');
  it.todo('D-06: throws when the reserved-sendable amount is <= 0 (balance too small to cover fees)');

  // capability gate (Pitfall 4f).
  it.todo('D-06: throws when the destination backend lacks capabilities.lnReceive');

  // same-node guard (Pitfall 4b) is the caller\'s responsibility (getInfo pubkey compare).
  it.todo('D-06: same-node pay-self is guarded by the caller before sendAll (documented contract)');

  // happy path: explicit-confirm single LN payment.
  it.todo('D-06: creates an invoice on the new backend for the sendable amount and pays it from the old');
  it.todo('D-06: reconciles the payment to a terminal state before declaring the move done');
});
