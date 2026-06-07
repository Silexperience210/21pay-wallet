# 21pay Wallet

## What This Is

21pay Wallet is a sovereign Bitcoin **super-app** for Android: a Lightning + on-chain wallet at its core, acting as the mobile interface to the existing 21pay LNbits backend, with three first-class services grafted on — **Casino** (satoshicasino21), **Mineurs** (miner rental, powered by BitRent), and **Markets** (prediction markets, powered by Hunch). It is built for cypherpunk Bitcoiners who want one app that spends, earns, gambles, mines and bets — without ever "leaving for the web" and without surrendering custody of their keys unless they choose to.

## Core Value

**A user can hold and move Bitcoin (LN + on-chain) safely from their phone, with their keys protected by hardware-backed security, choosing their own sovereignty level — and reach Casino / Mineurs / Markets natively from inside that same wallet.** If everything else fails, the wallet + key security must work.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope (v1). Hypotheses until shipped and validated. -->

**Onboarding & Identity**
- [ ] User can create a fresh wallet whose backend is an account opened on the 21pay LNbits instance (custodial mode)
- [ ] User can import their own node via Nostr Wallet Connect (NWC / NIP-47) to use the 21pay environment with their own funds
- [ ] User can connect a self-hosted node (Ark or Spark), fully self-sovereign, with a unique password
- [ ] A single **Nostr master key** (npub/nsec) is the root identity that unifies wallet + all 3 sections (signs Hunch, drives NWC, owns the @21pay LNaddress and profile)
- [ ] User can claim a custom personalized Lightning Address `name@21pay…`

**Key Security (critical pillar)**
- [ ] Master nsec + wallet secrets are stored hardware-backed (Android Keystore / StrongBox when available), never in plaintext
- [ ] Wallet unlock is gated by biometric / device credential
- [ ] User can back up and restore their master key (seed/nsec) through a secure, explicit flow

**Wallet**
- [ ] User can receive and send Lightning payments
- [ ] User can receive and send on-chain Bitcoin
- [ ] User can view balance and transaction history across the active backend

**Casino (native)**
- [ ] User can play satoshicasino21 from native screens, funded by the wallet, without leaving the app

**Mineurs (native, BitRent engine)**
- [ ] User can browse and rent a miner via the BitRent backend from native screens, paid from the wallet

**Markets (native, Hunch engine)**
- [ ] User can browse and bet on Hunch prediction markets from native screens (Nostr/Cashu), signed by the master key, without leaving the app

**Experience**
- [ ] UI is ultra-simple with last-generation visual effects and animations (Reanimated / Moti / Skia)

### Out of Scope

<!-- Explicit boundaries with reasoning. -->

- **iOS app (v1)** — Android-first to match the existing Expo/RN stack and CI; App Store wallet/casino review constraints deferred
- **Web/desktop build (v1)** — focus is the mobile APK; Expo Web can come later
- **Re-implementing the service backends** — Casino, BitRent and Hunch backends already run; the app consumes their APIs/protocols, it does not rebuild them
- **Hunch mainnet betting at scale** — Hunch remains audit-gated for public mainnet; the app respects that gate
- **Fiat on-ramp / KYC** — against the no-KYC, Bitcoin-only ethos

## Context

- **Ecosystem already in production (user-owned):**
  - **21pay** — public LNbits on Umbrel via Cloudflare Tunnel, custom theme. This is the backend engine for fresh (custodial) wallets and LNaddress provisioning.
  - **satoshicasino21** — live casino web app (Vercel).
  - **BitRent** — miner-rental marketplace, Supabase + GraphQL backend, deployed on Vercel (branch `master`, manual deploy).
  - **Hunch** — cypherpunk prediction market: Nostr (kinds 30888 markets / 38888 orders / 89 oracle), Cashu NUT-11 P2PK + DLC, signet + capped mainnet mints (`mint-signet`/`mint-mainnet.21pay.org`), relay `wss://relay.21pay.org` (WS-only). Frontend logic is TypeScript (`lib/relay.ts`, Cashu, Nostr) — **portable to React Native**.
- **Reuse strategy:** "Native RN" does NOT mean rewriting business logic from scratch. Hunch's TS libs port directly; BitRent and Casino expose backends the app calls. The Nostr master key is the connective tissue across all of them.
- **Prior RN experience:** the user ships React Native / Expo apps (MeshPay, BitMesh) with established BLE patterns, EAS Build, and Android CI muscle memory.
- **Opsec note:** outstanding ecosystem secret-rotation debts exist (LLM API keys, a Cloudflare token, an Umbrel password pasted in clear); key handling in this app must set the higher bar.

## Constraints

- **Tech stack**: Expo React Native + **prebuild / dev client** + EAS Build — Why: hardware-backed key storage (Keystore/StrongBox via expo-secure-store + react-native-keychain), access to native Bitcoin/crypto modules, and reuse of the user's entire RN toolchain.
- **Animations**: Reanimated 3 + Moti + Skia — Why: the "last-generation effects, ultra-simple UI" requirement lives in the most mature RN animation ecosystem.
- **Security**: master nsec and wallet secrets must be hardware-backed and biometric-gated — Why: self-sovereign custody is the product's reason to exist; a leaked master key compromises wallet + all 3 services at once.
- **Platform**: Android APK/AAB only for v1 — Why: matches existing stack/CI; iOS deferred.
- **Backends**: must integrate the live 21pay LNbits, BitRent, satoshicasino21, and Hunch (Nostr/Cashu) services as-is — Why: they already run in production and are the engines.
- **Dependency**: Hunch mainnet remains audit-gated — Why: pre-existing project constraint the app must not violate.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Expo RN + prebuild + EAS (not bare RN / Flutter) | 95% of native control with managed DX; reuses user's stack; hardware-key + native crypto modules available | — Pending |
| Single Nostr master key as root identity | Unifies wallet + Casino + Mineurs + Markets under one cypherpunk-native key; signs Hunch and drives NWC | — Pending |
| Services integrated as **native RN screens** (not WebView) | Maximum integration / UX; reuse TS logic + backends rather than rebuild | — Pending (largest scope driver) |
| v1 = wallet + all 3 sections ("tout d'un coup") | User wants the full super-app, not a thin slice | — Pending (long roadmap) |
| Key-security foundation built first | A leaked master key breaks everything; must be bordered before sections are layered on | — Pending |
| Android APK only for v1 | Matches stack/CI; avoids App Store wallet/casino review | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-07 after initialization*
