// Minimal i18n for 21pay. Default locale is French (the product's primary audience);
// English is the fallback. No external dep — `t(key, params)` does {placeholder}
// interpolation. Call setLocale('en') to switch. Keep keys namespaced by screen.

export type Lang = 'fr' | 'en';

let current: Lang = 'fr';
export function setLocale(l: Lang): void {
  current = l;
}
export function getLocale(): Lang {
  return current;
}

type Dict = Record<string, string>;

const en: Dict = {
  // Home
  'home.title.onboard': '21pay',
  'home.title.wallet': 'Wallet',
  'home.lead': 'Your sovereign Bitcoin wallet. Create a custodial 21pay wallet to get started.',
  'home.create': 'Create my 21pay wallet',
  'home.createErr': 'Could not create the wallet — check the 21pay connection.',
  'home.tapToPay': '⚡  Tap to pay (NFC)',
  'home.receive': 'Receive',
  'home.send': 'Send',
  'home.scan': 'Scan',
  'home.recent': 'Recent',
  'home.sections': 'Casino · Mineurs · Markets — soon',
  // Balance
  'balance.onchain': 'On-chain · {amount}',
  'balance.total': 'Total · {amount}',
  // Backup banner
  'backup.warn': 'Back up your recovery phrase',
  'backup.body': 'Write down your seed — it’s the only way to recover your sats.',
  'backup.cta': 'I’ve written it down',
  // NFC
  'nfc.title': 'NFC Pay',
  'nfc.send': 'Send',
  'nfc.receive': 'Receive',
  'nfc.idle': 'Hold a Lightning tag to the back of your phone.',
  'nfc.noNfc': 'This device has no NFC.',
  'nfc.createWalletFirst': 'Create a wallet first.',
  'nfc.holdTag': 'Hold the Lightning tag to your phone…',
  'nfc.transferring': 'Transferring energy…',
  'nfc.paid': 'Paid. Your sats moved.',
  'nfc.noInvoice': 'That tag has no payable Lightning invoice.',
  'nfc.payFailed': 'NFC payment failed.',
  'nfc.amountLabel': 'Amount to receive',
  'nfc.creatingInvoice': 'Creating an invoice…',
  'nfc.holdOther': 'Hold the other phone to yours to send the sats…',
  'nfc.delivered': 'Invoice delivered — sats incoming.',
  'nfc.emuFailed': 'Could not start NFC emulation.',
  'nfc.expired': 'Tap session timed out — start again.',
  'nfc.tapToPay': 'Tap to pay',
  'nfc.tapToReceive': 'Tap to receive',
  'nfc.done': 'Done',
  'nfc.tryAgain': 'Try again',
  'nfc.cancel': 'Cancel',
  'nfc.close': 'Close',
  // Receive
  'receive.title': 'Receive',
  'receive.lightning': 'Lightning',
  'receive.onchain': 'On-chain',
  'receive.memoPlaceholder': "What's it for? (optional)",
  'receive.createInvoice': 'Create invoice',
  'receive.onchainLead': 'Show a fresh on-chain address to receive Bitcoin.',
  'receive.showAddress': 'Show address',
  'receive.backendErr': "Can't reach the wallet backend. Try again in a moment.",
  // Send
  'send.title': 'Send',
  'send.destPlaceholder': 'Invoice, LN address, LNURL or on-chain address',
  'send.amountFromInvoice': 'Amount is set by the invoice.',
  'send.payInvoice': 'Pay invoice',
  'send.payLnurl': 'Pay LNURL',
  'send.pay': 'Pay',
  'send.sendOnchain': 'Send on-chain',
  'send.onchainWarn': "On-chain payments can't be reversed.",
  'send.unknownDest': "Couldn't read that destination.",
  'send.disabledHint': 'Enter a valid destination and amount to continue.',
  'send.resolving': 'Checking amount limits…',
  // Scan
  'scan.unknown': "Couldn't read that code — try again.",
  'scan.torchOn': 'Torch on',
  'scan.torchOff': 'Torch off',
  'scan.camOff': 'Camera access is off',
  'scan.camBody': 'Enable camera in Settings to scan a QR code.',
  'scan.allow': 'Allow camera',
  'scan.openSettings': 'Open Settings',
  // Identity
  'identity.title': 'Identity',
  'identity.pick': 'Pick your Lightning address',
  'identity.pickBody': 'Claim a name@21pay address so anyone can pay you with a tap.',
  'identity.claim': 'Claim address',
  'identity.createWalletFirst': 'Create a 21pay wallet first.',
  'identity.claimErr': "Couldn't claim that address — try another or check the connection.",
  'identity.checking': 'Checking availability…',
  'identity.taken': 'That name is already taken.',
  'identity.available': 'Available',
  'identity.share': 'Share this — anyone can pay you with a tap.',
  'identity.yourAddress': 'Your Lightning address',
  // Payment status
  'pay.pending.title': 'Sending…',
  'pay.pending.body': 'Routing your sats.',
  'pay.settled.title': 'Sent',
  'pay.settled.body': 'Your payment went through.',
  'pay.failed.title': 'Payment failed',
  'pay.failed.body': "The payment didn't go through. Your sats are untouched — check the invoice and try again.",
  'pay.expired.title': 'Invoice expired',
  'pay.expired.body': 'This invoice is no longer valid. Ask for a fresh one.',
  'pay.done': 'Done',
};

const fr: Dict = {
  // Home
  'home.title.onboard': '21pay',
  'home.title.wallet': 'Portefeuille',
  'home.lead': 'Ton portefeuille Bitcoin souverain. Crée un portefeuille 21pay pour commencer.',
  'home.create': 'Créer mon portefeuille 21pay',
  'home.createErr': 'Création impossible — vérifie la connexion à 21pay.',
  'home.tapToPay': '⚡  Payer en NFC',
  'home.receive': 'Recevoir',
  'home.send': 'Envoyer',
  'home.scan': 'Scanner',
  'home.recent': 'Récent',
  'home.sections': 'Casino · Mineurs · Markets — bientôt',
  // Balance
  'balance.onchain': 'On-chain · {amount}',
  'balance.total': 'Total · {amount}',
  // Backup banner
  'backup.warn': 'Sauvegarde ta phrase de récupération',
  'backup.body': 'Note ta seed — c’est le seul moyen de récupérer tes sats.',
  'backup.cta': 'Je l’ai notée',
  // NFC
  'nfc.title': 'Paiement NFC',
  'nfc.send': 'Envoyer',
  'nfc.receive': 'Recevoir',
  'nfc.idle': 'Approche un tag Lightning au dos de ton téléphone.',
  'nfc.noNfc': 'Cet appareil n’a pas de NFC.',
  'nfc.createWalletFirst': 'Crée d’abord un portefeuille.',
  'nfc.holdTag': 'Approche le tag Lightning de ton téléphone…',
  'nfc.transferring': 'Transfert d’énergie…',
  'nfc.paid': 'Payé. Tes sats sont partis.',
  'nfc.noInvoice': 'Ce tag ne contient pas d’invoice Lightning payable.',
  'nfc.payFailed': 'Le paiement NFC a échoué.',
  'nfc.amountLabel': 'Montant à recevoir',
  'nfc.creatingInvoice': 'Création de l’invoice…',
  'nfc.holdOther': 'Approche l’autre téléphone du tien pour envoyer les sats…',
  'nfc.delivered': 'Invoice transmise — sats en route.',
  'nfc.emuFailed': 'Impossible de démarrer l’émulation NFC.',
  'nfc.expired': 'Session de tap expirée — recommence.',
  'nfc.tapToPay': 'Approcher pour payer',
  'nfc.tapToReceive': 'Approcher pour recevoir',
  'nfc.done': 'Terminé',
  'nfc.tryAgain': 'Réessayer',
  'nfc.cancel': 'Annuler',
  'nfc.close': 'Fermer',
  // Receive
  'receive.title': 'Recevoir',
  'receive.lightning': 'Lightning',
  'receive.onchain': 'On-chain',
  'receive.memoPlaceholder': 'C’est pour quoi ? (optionnel)',
  'receive.createInvoice': 'Créer l’invoice',
  'receive.onchainLead': 'Affiche une nouvelle adresse on-chain pour recevoir des bitcoins.',
  'receive.showAddress': 'Afficher l’adresse',
  'receive.backendErr': 'Connexion au portefeuille impossible. Réessaie dans un instant.',
  // Send
  'send.title': 'Envoyer',
  'send.destPlaceholder': 'Invoice, adresse LN, LNURL ou adresse on-chain',
  'send.amountFromInvoice': 'Le montant est fixé par l’invoice.',
  'send.payInvoice': 'Payer l’invoice',
  'send.payLnurl': 'Payer le LNURL',
  'send.pay': 'Payer',
  'send.sendOnchain': 'Envoyer on-chain',
  'send.onchainWarn': 'Les paiements on-chain sont irréversibles.',
  'send.unknownDest': 'Destination illisible.',
  'send.disabledHint': 'Saisis une destination et un montant valides pour continuer.',
  'send.resolving': 'Vérification des limites de montant…',
  // Scan
  'scan.unknown': 'Code illisible — réessaie.',
  'scan.torchOn': 'Lampe',
  'scan.torchOff': 'Éteindre',
  'scan.camOff': 'Accès caméra désactivé',
  'scan.camBody': 'Active la caméra dans les Réglages pour scanner un QR code.',
  'scan.allow': 'Autoriser la caméra',
  'scan.openSettings': 'Ouvrir les Réglages',
  // Identity
  'identity.title': 'Identité',
  'identity.pick': 'Choisis ton adresse Lightning',
  'identity.pickBody': 'Réserve une adresse nom@21pay pour qu’on te paie d’un tap.',
  'identity.claim': 'Réserver l’adresse',
  'identity.createWalletFirst': 'Crée d’abord un portefeuille 21pay.',
  'identity.claimErr': 'Réservation impossible — essaie un autre nom ou vérifie la connexion.',
  'identity.checking': 'Vérification de la disponibilité…',
  'identity.taken': 'Ce nom est déjà pris.',
  'identity.available': 'Disponible',
  'identity.share': 'Partage-la — on peut te payer d’un simple tap.',
  'identity.yourAddress': 'Ton adresse Lightning',
  // Payment status
  'pay.pending.title': 'Envoi…',
  'pay.pending.body': 'Acheminement de tes sats.',
  'pay.settled.title': 'Envoyé',
  'pay.settled.body': 'Ton paiement est passé.',
  'pay.failed.title': 'Paiement échoué',
  'pay.failed.body': 'Le paiement n’est pas passé. Tes sats sont intacts — vérifie l’invoice et réessaie.',
  'pay.expired.title': 'Invoice expirée',
  'pay.expired.body': 'Cette invoice n’est plus valide. Demandes-en une nouvelle.',
  'pay.done': 'Terminé',
};

const DICTS: Record<Lang, Dict> = { fr, en };

export function t(key: string, params?: Record<string, string | number>): string {
  const s = DICTS[current][key] ?? en[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
}
