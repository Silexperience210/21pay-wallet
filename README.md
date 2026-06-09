<div align="center">

# ⚡ 21pay

### Le super-app Bitcoin souverain

**Wallet Lightning + on-chain** au cœur, **trois sections natives** — Casino · Mineurs · Markets —
unifiées par **une seule clé Nostr maître**. No-KYC. Distribution directe. Android.

<br/>

![Build](https://github.com/Silexperience210/21pay-wallet/actions/workflows/android-build.yml/badge.svg)
![Release](https://img.shields.io/badge/release-v0.3.0-F7931A?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Android-3DDC84?style=flat-square&logo=android&logoColor=white)
![Expo SDK](https://img.shields.io/badge/Expo_SDK-54-000020?style=flat-square&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-111_passing-3ECF8E?style=flat-square&logo=jest&logoColor=white)
![Custody](https://img.shields.io/badge/custody-souveraine-F7931A?style=flat-square&logo=bitcoin&logoColor=white)

</div>

---

## 🎯 C'est quoi 21pay ?

21pay n'est pas « encore un wallet ». C'est une **super-app Bitcoin** : un portefeuille
Lightning + on-chain souverain qui sert de **socle** à trois univers natifs, le tout sous
**une identité Nostr unique**.

| 🟠 Wallet | 🎰 Casino | ⛏️ Mineurs | 📈 Markets |
|:---|:---|:---|:---|
| LN + on-chain, NFC tap-to-pay, adresse `nom@21pay` | satoshicasino21 | Location de mineurs (BitRent) | Prediction market (Hunch — DLC + Cashu) |

Trois **modes de custody** : custodial 21pay (LNbits) · NWC (NIP-47) · self-hosted (Spark).

---

## ✨ Fonctionnalités

### Portefeuille
- ⚡ **Lightning** — envoyer / recevoir (BOLT11, LN Address `nom@21pay`, LNURL-pay avec bornes min/max)
- ⛓️ **On-chain** — recevoir, envoyer avec choix du fee-rate, avertissement d'irréversibilité
- 💸 **Soldes séparés par backend** (LN / on-chain) + **total discret** — jamais un faux « solde unique »
- 🔍 **Scanner unifié** — un seul scan classe BOLT11 / LNURL / LN-address / BIP21 / on-chain et pré-remplit l'envoi
- 🧾 État de paiement temps réel (`pending → settled / failed / expired`) avec réconciliation backend

### NFC — tap-to-pay
- 📲 **HCE (Host Card Emulation)** — le téléphone **devient un tag** : recevoir par tap sans support physique
- 💳 **Mode Carte (LNURL-withdraw)** — présenter une carte que le terminal débite (style BoltCard)
- 🔋 Animation « transfert d'énergie » Skia synchronisée sur le cycle NFC réel

### Identité
- 🪪 **Adresse Lightning `nom@21pay`** — disponibilité live + validation, carte copiable
- 🔑 **Clé Nostr maître** — une identité unifiée pour toutes les sections

### Confort
- 🌍 **i18n** (FR par défaut, EN en repli)
- 🔐 Biométrie / StrongBox, capture d'écran bloquée sur les écrans sensibles
- 💾 Rappel de sauvegarde de la phrase de récupération

---

## 🏗️ Architecture

Monolithe modulaire en couches. Le **Core** est inviolable : la clé brute n'en sort jamais.

```
┌──────────────────────────────────────────────────────────┐
│  Sections   │  Casino   │   Mineurs   │      Markets       │
│             └───────────┴──────┬──────┴────────────────────┘
│                  dépendent UNIQUEMENT de ↓
│        core.wallet  +  core.signer   (capabilities scoped)
├──────────────────────────────────────────────────────────┤
│  WalletBackend (interface)                                 │
│   ├─ CustodialLnbits   (21pay)                             │
│   ├─ NwcRemote         (NIP-47)        ← Phase 4           │
│   └─ SelfHosted/Spark                  ← Phase 4           │
├──────────────────────────────────────────────────────────┤
│  Core : Key Vault · Signer · Networking · Persistence      │
│         (la clé charge → signe → se zéroïse, jamais exposée)│
└──────────────────────────────────────────────────────────┘
```

**Contraintes porteuses** (voir `CLAUDE.md`) :
1. Pin **Expo SDK 54 + Reanimated 3 + Moti 0.30 + Skia** (Moti casse sur RN4 / SDK 55+).
2. **Clé Nostr maître = blast radius** — identité ≠ clé de dépense, paths dérivés séparés.
3. **Distribution APK directe**, pas Google Play (wallet no-KYC + casino real-money).
4. **Polyfills crypto** importés en premier ; round-trip keygen/sign prouvé sur build release.
5. **Frontière Core inviolable** — les sections ne voient que `core.wallet` + `core.signer`.

---

## 🛠️ Stack

`Expo SDK 54` · `React Native 0.81` · `expo-router` · `Reanimated 3` · `Moti` · `Skia`
· `@noble`/`@scure` (crypto pur-JS) · `nostr-tools` · `expo-secure-store` + `react-native-keychain`
· `expo-sqlite` · `react-native-nfc-manager` + `react-native-hce` · `zustand` · `@tanstack/react-query`

---

## 🚀 Démarrage

> Workflow **prebuild + dev-client** (le managed workflow est impossible ici : NFC/HCE + natif).

```bash
npm install
npx expo prebuild -p android        # génère android/ (HCE, permissions…)
npx expo run:android                # build + lance sur device/émulateur

npm test                            # 111 tests
npm run typecheck                   # tsc --noEmit
```

NFC / HCE / caméra / biométrie nécessitent un **appareil physique**.

---

## 📦 Build & distribution

Builds signés via **EAS** (cloud), distribution **directe** (APK/AAB) — jamais le Play Store.

```bash
# Build local (utilise le keystore local) :
npx eas-cli build -p android --profile preview --non-interactive

# …ou via CI : pousser un tag apk-* déclenche .github/workflows/android-build.yml
git tag apk-v0.3.0 && git push origin apk-v0.3.0
```

| Profil | Sortie | Usage |
|:--|:--|:--|
| `development` | APK dev-client | Itération |
| `preview` | APK signé | Test interne / distribution directe |
| `production` | AAB | Release |

> ⚠️ Le keystore (`credentials/`) est **gitignored**. Pour un build **CI** autonome, charger les
> credentials sur EAS (`eas credentials`) et passer le profil en `credentialsSource: remote`.

---

## 🗺️ Roadmap

| Phase | Contenu | État |
|:--|:--|:--|
| 0 | Distribution + Scaffold | ✅ |
| 1 | Key / Security Core | ✅ code · ⏳ checkpoints device |
| 2 | WalletBackend + LNbits custodial | ✅ |
| 3 | Wallet vertical slice (1er E2E : LN/on-chain, NFC/HCE, identité) | ✅ code · ⏳ checkpoints device |
| 4 | NWC + Spark (non-custodial) · 🌱 *seed Boltz* | ⏳ |
| 5 | Casino (satoshicasino21) | ⏳ |
| 6 | Mineurs (BitRent) | ⏳ |
| 7 | Markets (Hunch) | ⏳ |

---

## ⚠️ Avertissement

21pay est un wallet Bitcoin **souverain, no-KYC**, à **distribution directe** (hors Play Store).
Tu es responsable de tes clés et de tes fonds. Les opérations on-chain sont **irréversibles**.
Mainnet = argent réel. **Sauvegarde ta phrase de récupération.**

<div align="center">
<br/>

*Construit avec ⚡ pour la souveraineté Bitcoin.*

</div>
