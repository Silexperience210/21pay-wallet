// Subpath shim for `@getalby/sdk/nwc` — re-exports the NWCClient mock so the
// backend adapter's `import { NWCClient } from '@getalby/sdk/nwc'` resolves to
// the same manual mock regardless of import style.
export { NWCClient } from '../sdk';
export type { MockGetInfoResult } from '../sdk';
