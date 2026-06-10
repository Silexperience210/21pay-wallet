// RED stub — Wave-0 gap enumeration for NwcRemote (the WalletBackend over
// @getalby/sdk NWCClient). Filled in 04-02 (NWC backend plan). These it.todo
// entries are the contract the Wave-1 executor must satisfy; the mocked NWCClient
// lives at __mocks__/@getalby/sdk(.ts | /nwc.ts).
//
// Run: `npx jest src/wallet/backends/nwc.test.ts`

describe('NwcRemote — WalletBackend over @getalby/sdk (ONBD-02, IDENT-03) [RED stub, filled in 04-02]', () => {
  // msat <-> sat mapping at the SDK boundary (NWC is msat-denominated).
  it.todo('ONBD-02: getBalance maps NWCClient.getBalance().balance (msats) -> lightningSat (floor / 1000)');
  it.todo('ONBD-02: createInvoice maps amountSat*1000 -> makeInvoice({ amount }) and returns { bolt11, paymentHash }');
  it.todo('ONBD-02: payInvoice maps payInvoice().fees_paid (msats) -> feeSat (floor / 1000) and returns the preimage');
  it.todo('ONBD-02: payLnAddress resolves LNURLp -> invoice then payInvoice (custodial pattern)');
  it.todo('ONBD-02: listTransactions maps NWCClient.listTransactions().transactions -> WalletTx[]');
  it.todo('ONBD-02: reconcile maps lookupInvoice().settled_at -> PaymentStatus via the state machine');

  // capabilities
  it.todo('ONBD-02: capabilities = { onchain:false, lnSend:true, lnReceive:true } (D-09 mapping)');

  // budget: D-03 request-if-supported-else-display, branched off getInfo().methods
  it.todo('IDENT-03: when getInfo().methods includes get_budget -> read-only display via getBudget()');
  it.todo('IDENT-03: when getInfo().methods lacks get_budget -> no claimed local cap (guidance branch)');

  // capability negotiation (O-3): require pay_invoice + make_invoice + get_balance to activate
  it.todo('ONBD-02: refuses to activate as a spending backend when pay_invoice is not in getInfo().methods');
  it.todo('ONBD-02: degrades listTransactions to empty when list_transactions is absent');

  // IDENT-03 blast-radius: the secret comes from the URI, NOT identity derivation
  it.todo('IDENT-03: the NWC secret comes from the connection URI, NOT from core/keys derivation (m/44\'/1237\')');

  // lifecycle (Pitfall 1): socket is disposable
  it.todo('ONBD-02: close() disposes the NWCClient socket on deactivate/background');
});
