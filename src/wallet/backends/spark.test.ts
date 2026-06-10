// RED stub — Wave-0 gap enumeration for the SelfHosted (Spark) WalletBackend over
// the Breez Spark SDK. Filled after the BLOCKING 04-04 device checkpoint proves
// connect()/getInfo() on a release Hermes APK. The mocked SDK lives at
// __mocks__/@breeztech/breez-sdk-spark-react-native.ts.
//
// Run: `npx jest src/wallet/backends/spark.test.ts`

describe('SelfHosted (Spark) — WalletBackend over Breez Spark SDK (ONBD-03) [RED stub, filled post-04-04]', () => {
  // D-09: LN-only in v1.
  it.todo('ONBD-03: capabilities.onchain === false (D-09 LN-only)');
  it.todo('ONBD-03: capabilities.lnSend === true && capabilities.lnReceive === true');

  // SDK -> WalletBackend mapping (Spark is sat-denominated).
  it.todo('ONBD-03: getBalance maps getInfo({ ensureSynced:true }).balanceSats -> lightningSat');
  it.todo('ONBD-03: createInvoice maps receivePayment(Bolt11) -> { bolt11: paymentRequest, ... }');
  it.todo('ONBD-03: payInvoice runs prepareSendPayment -> sendPayment with an idempotencyKey (double-spend guard)');
  it.todo('ONBD-03: payLnAddress runs parse -> prepareLnurlPay -> lnurlPay');
  it.todo('ONBD-03: listTransactions maps listPayments() -> WalletTx[]');

  // async-settlement (Pitfall 4): reconcile via events/polling.
  it.todo('ONBD-03: reconcile resolves payment status via addEventListener / listPayments polling');

  // D-12 blast-radius: dedicated Spark seed, never the identity master seed.
  it.todo('ONBD-03: connect() uses a dedicated Spark mnemonic (D-12), NOT the identity master seed');
  it.todo('ONBD-03: storageDir is the on-device documentDirectory path (expo-file-system)');
});
