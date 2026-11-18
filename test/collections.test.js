// Two collections, one claim: a Lil Pudgy's page is at lil- and its number, its message names it, its holder is read
// from its own contract, and the check tool takes it, while every Pudgy Penguin call stays as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import {
  bytesToHex, checkProof, checksum, collectionOf, COLLECTIONS, delegateOf, DELEGATE_V1, DELEGATE_V2, holds, keccak, LIL_PUDGY, messageProblems, ownerOf,
  personalHash, proofUrl, PUDGY, selector, signMessage, statement, tokenOfLabel,
} from '../src/index.js';

const word = (hex) => hex.replace(/^0x/, '').padStart(64, '0');
const wallet = (seed) => {
  const key = new Uint8Array(32).fill(seed);
  return { key, address: bytesToHex(keccak(secp256k1.getPublicKey(key, false).slice(1)).slice(12)) };
};
const sign = (key, message) => {
  const rec = secp256k1.sign(personalHash(message), key, { prehash: false, format: 'recovered' });
  const out = new Uint8Array(65); out.set(rec.slice(1), 0); out[64] = 27 + rec[0];
  return bytesToHex(out);
};
const ALICE = wallet(7), BOB = wallet(9);

test('the two collections, and the token a page’s address is for', () => {
  assert.equal(COLLECTIONS.pudgy.contract, PUDGY);
  assert.equal(COLLECTIONS.lil.contract, LIL_PUDGY);
  assert.equal(collectionOf().key, 'pudgy');
  assert.equal(collectionOf('lil').name, 'Lil Pudgy');
  assert.throws(() => collectionOf('punk'));
  assert.deepEqual(tokenOfLabel('8496'), { collection: COLLECTIONS.pudgy, id: 8496 });
  assert.deepEqual(tokenOfLabel('lil-8496'), { collection: COLLECTIONS.lil, id: 8496 });
  assert.deepEqual(tokenOfLabel('lil-22221'), { collection: COLLECTIONS.lil, id: 22221 });
  for (const no of ['8888', 'lil-22222', 'lil-007', '007', 'lil-', 'lil8496', 'merlin', '']) assert.equal(tokenOfLabel(no), null, no);
});

test('a Lil Pudgy’s message names it; a Pudgy Penguin’s stays word for word as before', () => {
  assert.equal(statement('8.pickthepenguin.com', 8), 'Claim 8.pickthepenguin.com for Pudgy Penguin #8. A signature only: no transaction, no gas, no approval.');
  assert.equal(statement('lil-8496.pickthepenguin.com', 8496, 'lil'), 'Claim lil-8496.pickthepenguin.com for Lil Pudgy #8496. A signature only: no transaction, no gas, no approval.');
  const issued = Date.UTC(2026, 10, 18, 15, 0, 0);
  const lil = signMessage({ authority: 'lil-8496.pickthepenguin.com', uri: 'https://lil-8496.pickthepenguin.com/claim', wallet: ALICE.address, id: 8496, collection: 'lil', nonce: 'k3x9q2m8a7c1d4e5', issued, expires: issued + 600_000 });
  assert.match(lil, /\n\nClaim lil-8496\.pickthepenguin\.com for Lil Pudgy #8496\. A signature only/);
  assert.deepEqual(messageProblems(lil, { id: 8496, wallet: ALICE.address, collection: 'lil' }), []);
  // the same number in the other collection is another penguin: not this claim
  assert.deepEqual(messageProblems(lil, { id: 8496, wallet: ALICE.address }), ['Its sentence is not the claim of this penguin, word for word.']);
});

/** Ethereum where Alice holds Lil Pudgy #8496 and Bob holds Pudgy Penguin #8496, and Carol acts for Alice on v2 for
 *  the Lil Pudgys contract only. */
const CAROL = '0x' + 'c3'.repeat(20);
const chain = (asked = []) => async (method, params) => {
  if (method === 'eth_call') {
    const { to, data } = params[0];
    asked.push(to);
    const args = (data.slice(10).match(/.{64}/g) ?? []).map((a) => `0x${a.slice(24)}`);
    if (data.startsWith(selector('ownerOf(uint256)'))) return `0x${word(to === LIL_PUDGY ? ALICE.address : BOB.address)}`;
    if (to === DELEGATE_V2) return `0x${word(args[0] === CAROL && args[1] === ALICE.address && args[2] === LIL_PUDGY ? '1' : '0')}`;
    if (to === DELEGATE_V1) return `0x${word('0')}`;
    return `0x${word('0')}`;
  }
  if (method === 'eth_getCode') return '0x';
  throw new Error(method);
};

test('who holds a Lil Pudgy is read from its own contract, and a delegate for that contract counts', async () => {
  const asked = [];
  assert.equal(await ownerOf(chain(asked), 8496, LIL_PUDGY), ALICE.address);
  assert.deepEqual(asked, [LIL_PUDGY]);
  assert.equal(await ownerOf(chain(), 8496), BOB.address); // (left out: the Pudgy Penguins contract, as before)
  assert.equal(await delegateOf(chain(), CAROL, ALICE.address, 8496, LIL_PUDGY), 'delegate-v2');
  assert.equal(await delegateOf(chain(), CAROL, ALICE.address, 8496), null);
  assert.deepEqual(await holds(chain(), CAROL, 8496, LIL_PUDGY), { holder: ALICE.address, via: 'delegate-v2' });
  assert.deepEqual(await holds(chain(), CAROL, 8496), { holder: BOB.address, via: null });
});

test('the check tool takes a Lil Pudgy’s page, and checks its proof against the Lil Pudgys contract', async () => {
  assert.equal(proofUrl('lil-8496'), 'https://lil-8496.pickthepenguin.com/proof.json');
  assert.equal(proofUrl('LIL-08496'), 'https://lil-8496.pickthepenguin.com/proof.json');
  const issued = Date.UTC(2026, 10, 18, 15, 0, 0);
  const message = signMessage({ authority: 'lil-8496.pickthepenguin.com', uri: 'https://lil-8496.pickthepenguin.com/claim', wallet: ALICE.address, id: 8496, collection: 'lil', nonce: 'k3x9q2m8a7c1d4e5', issued, expires: issued + 600_000 });
  const proof = { lilPudgy: 8496, page: 'https://lil-8496.pickthepenguin.com/', holder: checksum(ALICE.address), wallet: checksum(ALICE.address), via: 'owner', way: 'sign', provedAt: new Date(issued + 30_000).toISOString(), expiresAt: new Date(issued + 600_000).toISOString(), message, signature: sign(ALICE.key, message) };
  const real = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json(proof);
    const r = await checkProof('lil-8496', { rpc: chain() });
    assert.equal(r.ok, true, r.lines.join('\n'));
    assert.equal(r.lines[0], 'Lil Pudgy #8496 · https://lil-8496.pickthepenguin.com/');
    assert.match(r.lines.join('\n'), /still holds #8496/);
    // the same proof calling itself a Pudgy Penguin's does not hold: its message names a Lil Pudgy
    globalThis.fetch = async () => Response.json({ ...proof, lilPudgy: undefined, penguin: 8496 });
    const wrong = await checkProof('lil-8496', { rpc: chain() });
    assert.equal(wrong.ok, false);
    assert.match(wrong.lines.join('\n'), /not the claim of this penguin/);
    // a number past the last Lil Pudgy is no proof
    globalThis.fetch = async () => Response.json({ ...proof, lilPudgy: 22222 });
    assert.equal((await checkProof('lil-8496', { rpc: chain() })).lines[0], 'https://lil-8496.pickthepenguin.com/proof.json is not a proof.');
  } finally {
    globalThis.fetch = real;
  }
});
