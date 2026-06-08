// Load-bearing import order (CLAUDE.md constraint 4). Do NOT reorder.
// react-native-get-random-values MUST be first so @noble/* and nostr-tools
// never fall back to Math.random() in later phases. NO keys are generated
// here — this file installs polyfills only.
import 'react-native-get-random-values'; // line 1 — ABSOLUTE FIRST
import { Buffer } from '@craftzdog/react-native-buffer';
import 'text-encoding';
import 'react-native-url-polyfill/auto';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer as unknown as typeof global.Buffer;
}
