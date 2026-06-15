<div align="center">

# ⚡ 21pay

### Le super-app Bitcoin souverain

**Wallet Lightning + on-chain** au cœur, **trois sections natives** — Casino · Mineurs · Markets —
plus du **contenu payant**, unifiés par **une seule clé Nostr maître**. No-KYC. Distribution directe. Android.

<br/>

![Build](https://github.com/Silexperience210/21pay-wallet/actions/workflows/android-build.yml/badge.svg)
![Release](https://img.shields.io/badge/release-v0.9.7-F7931A?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Android-3DDC84?style=flat-square&logo=android&logoColor=white)
![Expo SDK](https://img.shields.io/badge/Expo_SDK-54-000020?style=flat-square&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-305_passing-3ECF8E?style=flat-square&logo=jest&logoColor=white)
![Custody](https://img.shields.io/badge/custody-souveraine-F7931A?style=flat-square&logo=bitcoin&logoColor=white)

</div>

---

## 🎯 C'est quoi 21pay ?

21pay n'est pas « encore un wallet ». C'est une **super-app Bitcoin** : un portefeuille
Lightning + on-chain souverain qui sert de **socle** à plusieurs univers natifs, le tout sous
**une identité Nostr unique**.

| 🟠 Wallet | 🎰 Casino | ⛏️ Mineurs | 📈 Markets | 📄 Contenu |
|:---|:---|:---|:---|:---|
| LN + on-chain, NFC tap-to-pay, adresse `nom@21pay` | satoshicasino21 | Location de mineurs (BitRent) | Prediction market (Hunch — DLC + Cashu) | Paywall ContentWall |

Quatre **modes de custody** sur une échelle de souveraineté : custodial 21pay (LNbits) · NWC (NIP-47) · self-hosted Spark · Ark.

---

## ✨ Fonctionnalités

### Portefeuille
- ⚡ **Lightning** — envoyer / recevoir (BOLT11, LN Address `nom@21pay`, LNURL-pay avec bornes min/max)
- ⛓️ **On-chain via Boltz** — recevoir / envoyer en on-chain par **submarine swaps** (le custodial LNbits n'a pas d'on-chain natif → Boltz fait le pont LN↔chaîne), choix du fee-rate, avertissement d'irréversibilité
- 💸 **Soldes séparés par backend** (LN / on-chain) + **total discret** — jamais un faux « solde unique »
- 🔍 **Scanner unifié** — un seul scan classe BOLT11 / LNURL / LN-address / BIP21 / on-chain et pré-remplit l'envoi
- 🧾 État de paiement temps réel (`pending → settled / failed / expired`) avec réconciliation backend
- 💾 Persistance crash-safe : solde et historique survivent au redémarrage de l'app

### NFC — tap-to-pay
- 📲 **HCE (Host Card Emulation)** — le téléphone **devient un tag** : recevoir par tap sans support physique
- 💳 **Mode Carte (LNURL-withdraw)** — présenter une carte que le terminal débite (style BoltCard)
- 🔋 Animation « transfert d'énergie » Skia synchronisée sur le cycle NFC réel

### Échelle de custody (4 modes)
- 🏦 **Custodial 21pay** (LNbits) — création de compte en un tap, idéal onboarding
- 🔌 **NWC / Nostr Wallet Connect** (NIP-47) — connecte ton propre node, connexions multiples nommées, budget cap
- ⚡ **Spark** (self-hosted) — *expérimental, derrière checkpoint device*
- 🌊 **Ark / Arkade** — *expérimental, SDK pur-JS intégré, backend en cours*
- 🔀 Migration anti-stranding (sheet « send all to new wallet ») au changement de backend

### Identité
- 🪪 **Adresse Lightning `nom@21pay`** — disponibilité live + validation, lien LNURLp permanent rattaché au wallet, carte copiable
- 🔑 **Clé Nostr maître** — une identité unifiée pour toutes les sections

### Sections natives (intégrées)
- 🎰 **Casino — satoshicasino21** *(intégré)* — WebView durcie, login **LNURL-auth** (LUD-04) interne sans QR, dépôt/retrait avec solde casino distinct, panneau provably-fair
- ⛏️ **Mineurs — BitRent** *(intégré)* — auth **NIP-98**, catalogue de mineurs, location payée en LN, activation auto, stats live (hashrate / temp / shares)
- 📈 **Markets — Hunch** *(intégré)* — prediction market complet, *voir ci-dessous*
- 📄 **Contenu payant — ContentWall** *(intégré)* — publie du contenu payant (articles markdown, images, vidéos, audio, bundles), déverrouillage par Lightning, achats ré-accessibles, **studio créateur** + statistiques de ventes ; l'acheteur paie via le wallet, le créateur encaisse sur son wallet 21pay

### 📈 Markets — Hunch (prediction market cypherpunk)
- 🎲 **Pari 1-clic AMM** — pricing **LMSR** (mint-as-market-maker) : cote en direct, **50/50 par défaut** sur carnet vide, prix d'ordre auto + slippage affiché → aucun marché n'est jamais impariable
- 📖 **Carnet d'ordres** (kind 38888) + cotes implicites, vérif Schnorr de chaque event (relays non fiables)
- 🔮 **Transparence oracle** au moment de parier : clé, **réputation** (note moyenne), nonce engagé, **signature Schnorr du règlement visible**
- ⭐ **Noter un oracle** (HIP-5, kind 30891) — la réputation est contributable
- ⚖️ **Litiges** (kind 30890) — contester une attestation une fois le marché réglé
- 🏦 **Transparence mint** (kind 30892) — preuve de réserves + « oracle accepté/non listé »
- 🛠️ **Création de marché** permissionless + **sélecteur de méthode d'oracle** : manuel, ou auto-résolution (prix crypto / on-chain / météo / API JSON / IA-LLM) compilée en `resolution_spec`
- 🔭 **Mode oracle in-app** — engage le nonce et atteste YES/NO/INVALID (garde anti-équivocation), sans CLI
- 👛 **Hunch Wallet** — solde Cashu, **dépôt** (financé par le wallet in-app) / **retrait**, crédit **crash-safe** (la quote est persistée, un dépôt payé est toujours crédité même après redémarrage)
- 🙏 **Tips opérateur** opt-in (LNURL-pay) pour soutenir le mint / l'oracle / l'hébergement
- 🔎 Recherche + filtres (ouverts / expirés), partage, suppression NIP-09 par le créateur

### Confort
- 🌍 **i18n** (FR par défaut, EN en repli)
- 🔐 Biométrie / StrongBox, session d'unlock courte, capture d'écran bloquée sur les écrans sensibles
- 💾 Rappel de sauvegarde de la phrase de récupération + quiz de vérification

---

## 🏗️ Architecture

Monolithe modulaire en couches. Le **Core** est inviolable : la clé brute n'en sort jamais.

```
┌──────────────────────────────────────────────────────────────┐
│  Sections   │  Casino  │  Mineurs  │  Markets  │  ContentWall  │
│             └──────────┴─────┬─────┴───────────┴───────────────┘
│                  dépendent UNIQUEMENT de ↓
│        core.wallet  +  core.signer   (capabilities scoped)
├──────────────────────────────────────────────────────────────┤
│  WalletBackend (interface)                                     │
│   ├─ CustodialLnbits   (21pay)            + Boltz (on-chain)   │
│   ├─ NwcRemote         (NIP-47)                                │
│   ├─ SelfHosted/Spark  (expérimental)                          │
│   └─ Ark / Arkade      (expérimental)                          │
├──────────────────────────────────────────────────────────────┤
│  Core : Key Vault · Signer · Networking · Persistence          │
│         (la clé charge → signe → se zéroïse, jamais exposée)    │
└──────────────────────────────────────────────────────────────┘
```

**Contraintes porteuses** (voir `CLAUDE.md`) :
1. Pin **Expo SDK 54 + Reanimated 3 + Moti 0.30 + Skia** (Moti casse sur RN4 / SDK 55+).
2. **Clé Nostr maître = blast radius** — identité ≠ clé de dépense, paths dérivés séparés (oracle/Cashu/LNURL-auth/seeds Spark·Ark tous distincts).
3. **Distribution APK directe**, pas Google Play (wallet no-KYC + casino real-money).
4. **Polyfills crypto** importés en premier ; round-trip keygen/sign prouvé sur build release.
5. **Frontière Core inviolable** — les sections ne voient que `core.wallet` + `core.signer`, jamais la clé brute (grep-asserté en CI).

---

## 🛠️ Stack

`Expo SDK 54` · `React Native 0.81` · `expo-router` · `Reanimated 3` · `Moti` · `Skia`
· `@noble`/`@scure` (crypto pur-JS) · `nostr-tools` · `@cashu/cashu-ts` (NUT-11 P2PK)
· `@getalby/sdk` (NWC) · `@arkade-os/sdk` (Ark) · Boltz (swaps on-chain)
· `expo-secure-store` + `react-native-keychain` · `expo-sqlite` · `react-native-webview`
· `react-native-nfc-manager` + `react-native-hce` · `zustand`

---

## 🚀 Démarrage

> Workflow **prebuild + dev-client** (le managed workflow est impossible ici : NFC/HCE + natif).

```bash
npm install
npx expo prebuild -p android        # génère android/ (HCE, permissions…)
npx expo run:android                # build + lance sur device/émulateur

npm test                            # 305 tests (50 suites)
npm run typecheck                   # tsc --noEmit
```

NFC / HCE / caméra / biométrie nécessitent un **appareil physique**.

---

## 📦 Build & distribution

CI = **Gradle direct** sur le runner GitHub (le quota EAS gratuit étant épuisé), signé avec le
**keystore release** restauré depuis les secrets — distribution **directe** (APK), jamais le Play Store.

```bash
# Pousser un tag apk-* déclenche .github/workflows/android-build.yml :
git tag apk-v0.9.7 && git push origin apk-v0.9.7
# → assembleRelease + re-signature apksigner + publication de la Release GitHub avec l'APK
```

Le `versionName` vient de `app.config.ts`, le `versionCode` du numéro de run (monotone → maj in-place).
Variables `EXPO_PUBLIC_*` injectées depuis `eas.json` (source unique) au moment du bundle Metro.

> ⚠️ Le keystore (`credentials/`) est **gitignored** — à sauvegarder hors-repo. Secrets CI requis :
> `ANDROID_KEYSTORE_B64`, `CREDENTIALS_JSON`.

---

## 🗺️ Roadmap

| Phase | Contenu | État |
|:--|:--|:--|
| 0 | Distribution + Scaffold | ✅ intégré |
| 1 | Key / Security Core | ✅ intégré |
| 2 | WalletBackend + LNbits custodial | ✅ intégré |
| 3 | Wallet (LN / on-chain **Boltz**, NFC/HCE, identité) | ✅ intégré |
| 4 | Custody : custodial + **NWC** intégrés · Spark / Ark *(expérimental, gated)* | ✅ NWC · 🧪 Spark/Ark |
| 5 | **Casino** (satoshicasino21) | ✅ intégré |
| 6 | **Mineurs** (BitRent) | ✅ intégré |
| 7 | **Markets** (Hunch) + **Hunch Wallet** | ✅ intégré |
| + | **ContentWall** (contenu payant) | ✅ intégré |
| + | **Boltz** (swaps on-chain LN↔chaîne) | ✅ intégré |

> **Toutes les sections sont intégrées et fonctionnelles dans l'app.** Spark / Ark restent
> *expérimentaux* (derrière un flag, en attente du branchement SDK + preuve device). Il subsiste
> uniquement des validations matérielles ponctuelles (StrongBox, HCE entre 2 téléphones) qui ne
> changent rien à l'intégration des fonctionnalités.

---

## ⚠️ Avertissement

21pay est un wallet Bitcoin **souverain, no-KYC**, à **distribution directe** (hors Play Store).
Tu es responsable de tes clés et de tes fonds. Les opérations on-chain sont **irréversibles**.
Mainnet = argent réel (Hunch utilise un mint pré-audit **capé à 100k sats**). **Sauvegarde ta phrase de récupération.**

<div align="center">
<br/>

*Construit avec ⚡ pour la souveraineté Bitcoin.*

</div>
