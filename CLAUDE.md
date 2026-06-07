# 21pay Wallet — Project Guide

Sovereign Bitcoin **super-app** for Android (Expo React Native): a Lightning + on-chain wallet over the existing 21pay LNbits, with three native sections — **Casino** (satoshicasino21), **Mineurs** (BitRent), **Markets** (Hunch) — unified by a single Nostr master key.

## GSD workflow

This project is managed with GSD. Planning lives in `.planning/` (kept **local**, gitignored):
- `PROJECT.md` — context, requirements, decisions
- `REQUIREMENTS.md` — 44 v1 requirements with REQ-IDs + traceability
- `ROADMAP.md` — 8 phases (0–7)
- `research/` — STACK / FEATURES / ARCHITECTURE / PITFALLS / SUMMARY
- `config.json` — mode=yolo, granularity=standard, parallel, model_profile=quality, research+plan_check+verifier on

**Next step:** `/gsd-plan-phase 0`. Phases 0→1→2→3 are strictly sequential; 4·5·6·7 parallelizable after 3.

## Load-bearing constraints (do NOT drift)

1. **Stack pin: Expo SDK 54 + Reanimated 3 + Moti 0.30 + Skia.** Moti breaks on Reanimated 4 / SDK 55+. Do not upgrade the SDK without explicit Moti-compat verification. Use prebuild/dev-client + EAS (managed workflow is impossible here).
2. **Single Nostr master key = blast radius.** The identity nsec must NOT be the literal spending key and must NOT be reused as an NWC secret. Separate hardened derivation paths (identity `m/44'/1237'/0'/0/0`, spending `m/44'/0'`). NWC = fresh per-connection keys with budget caps. Designed in Phase 1, before any section is wired.
3. **Direct APK/AAB distribution, not Google Play** (no-KYC custodial wallet + real-money casino would be rejected). Casino + custodial mode sit behind a server feature gate so a Play-safe strip build stays possible.
4. **Crypto polyfills first.** Import `react-native-get-random-values` as the absolute first import, then Buffer/TextEncoder/URL. Prove keygen/sign round-trip on a **release Hermes build on a physical device** before generating any live key.
5. **Core boundary is inviolable.** Raw key material never leaves Core; the Signer loads briefly, signs, zeroizes. Sections receive only scoped capabilities and depend only on `core.wallet` + `core.signer` — never on raw keys or concrete backends, never on each other.

## Architecture (one-liner)

Layered modular monolith: **Core** (Key Vault + Signer + Networking + Persistence) → **WalletBackend** interface (implemented by `CustodialLNbits`, `NwcRemote`, `SelfHosted`/Spark) → **Sections** (Casino / Mineurs / Markets). Hunch's TS libs port near-verbatim into `src/sections/markets/lib/`, rewiring only signing → Core Signer and WS → Core relay pool.

## Ecosystem engines (already live, user-owned)

- **21pay** LNbits (Umbrel + Cloudflare Tunnel) — custodial backend + `@21pay` LNaddress provisioning (LNURLp)
- **satoshicasino21** — casino backend (API auth model undocumented → Phase 5 research)
- **BitRent** — miner-rental, Supabase/GraphQL (branch `master`; watch multi-level brace nesting)
- **Hunch** — Nostr (kinds 30888/38888/89) + Cashu NUT-11 + DLC; relay `wss://relay.21pay.org` (WS-only); `mint-signet`/`mint-mainnet.21pay.org`; **mainnet audit-gated** — client cannot flip signet→mainnet.
