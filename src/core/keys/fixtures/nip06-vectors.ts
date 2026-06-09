// Canonical NIP-06 reference vectors (verbatim from nips.nostr.com/6).
// These LOCK the derivation: a wrong implementation cannot pass silently.

export interface Nip06Vector {
  mnemonic: string;
  privKeyHex: string;
  nsec: string;
  pubKeyHex: string;
  npub: string;
}

export const NIP06_VECTOR_1: Nip06Vector = {
  mnemonic: 'leader monkey parrot ring guide accident before fence cannon height naive bean',
  privKeyHex: '7f7ff03d123792d6ac594bfa67bf6d0c0ab55b6b1fdb6249303fe861f1ccba9a',
  nsec: 'nsec10allq0gjx7fddtzef0ax00mdps9t2kmtrldkyjfs8l5xruwvh2dq0lhhkp',
  pubKeyHex: '17162c921dc4d2518f9a101db33695df1afb56ab82f5ff3e5da6eec3ca5cd917',
  npub: 'npub1zutzeysacnf9rru6zqwmxd54mud0k44tst6l70ja5mhv8jjumytsd2x7nu',
};

export const NIP06_VECTOR_2: Nip06Vector = {
  mnemonic:
    'what bleak badge arrange retreat wolf trade produce cricket blur garlic valid proud rude strong choose busy staff weather area salt hollow arm fade',
  privKeyHex: 'c15d739894c81a2fcfd3a2df85a0d2c0dbc47a280d092799f144d73d7ae78add',
  nsec: 'nsec1c9wh8xy5eqdzln7n5t0ctgxjcrdug73gp5yj0x03gntn67h83twssdfhel',
  pubKeyHex: 'd41b22899549e1f3d335a31002cfd382174006e166d3e658e3a5eecdb6463573',
  npub: 'npub16sdj9zv4f8sl85e45vgq9n7nsgt5qphpvmf7vk8r5hhvmdjxx4es8rq74h',
};
