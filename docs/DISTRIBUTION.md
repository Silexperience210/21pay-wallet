# Distribution Decision — 21pay Wallet

**Decision:** 21pay Wallet is distributed as a **direct, signed Android APK/AAB**, **not** through the Google Play Store.

## Why not Google Play

The app combines features that Google Play prohibits or heavily restricts (as of the Oct 2025 policy):

- **No-KYC custodial Bitcoin wallet** — Play now requires custodial crypto-wallet operators to hold MSB/CASP-style licensing.
- **Real-money casino** (satoshicasino21) — Play prohibits real-money gambling in most regions.

Shipping the full feature set on Play is a near-certain rejection/takedown. Direct APK/AAB distribution is the intended channel.

## How it ships

- **EAS Build** produces the signed artifacts in the cloud (the Windows dev host has no local Android SDK):
  - `preview` profile → **APK**, `distribution: internal` (sideloadable on a device, outside Play).
  - `production` profile → signed **AAB**.
- **CI:** `.github/workflows/android-build.yml` runs on `workflow_dispatch` or a `apk-*` git tag, calling `eas build` with the `EXPO_TOKEN` GitHub secret (never echoed, never committed).
- **Signing:** EAS-managed Android keystore (or `eas credentials` to upload your own). The keystore never enters the repo (`.gitignore` covers `*.keystore` / `*.jks`).

## Play-safe escape hatch

Casino and custodial mode are wrapped behind a **server-side feature gate** (`src/core/featureGate/`). If a Play-eligible, stripped build is ever wanted, the gate flips those features **off server-side without a rebuild**. The gate **fails closed** and validates responses strictly, so a spoofed gate response cannot silently re-enable a stripped build.

## Install on a device (manual)

1. Build via CI (push tag `apk-v0.0.1`) or `npx eas-cli build --platform android --profile preview`.
2. Download the signed APK from the EAS build page.
3. On the device: enable "Install unknown apps", transfer the APK, tap to install.
4. No Google Play involvement.
