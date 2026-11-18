// Ethereum reads against a stand-in node: who holds a penguin, delegate.xyz's two registries in order, plain transfers
// to goldcote.eth, and a node that fails handing over to the next one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChainError, delegateOf, DELEGATE_V1, DELEGATE_V2, GOLDCOTE, holds, nodeRpc, ownerOf, PUDGY, selector, transferByHash, transfersTo } from '../src/index.js';

const word = (hex) => hex.replace(/^0x/, '').padStart(64, '0');
const A = '0x' + 'a1'.repeat(20), B = '0x' + 'b2'.repeat(20), C = '0x' + 'c3'.repeat(20);

/** A node where A holds #5, C acts for A on registry v1, and block 10 has two transfers, one to goldcote.eth. */
const fake = (asked = []) => async (method, params) => {
  asked.push(method === 'eth_call' ? `call ${params[0].to}` : method);
  if (method === 'eth_call') {
    const { to, data } = params[0];
    const args = (data.slice(10).match(/.{64}/g) ?? []).map((a) => `0x${a.slice(24)}`);
    if (to === PUDGY && data.startsWith(selector('ownerOf(uint256)'))) return `0x${word(A)}`;
    if (to === DELEGATE_V2) return `0x${word('0')}`;
    if (to === DELEGATE_V1) return `0x${word(args[0] === C && args[1] === A ? '1' : '0')}`;
  }
  if (method === 'eth_getBlockByNumber') return { timestamp: '0x10', transactions: [{ hash: '0xAA', from: B, to: GOLDCOTE.toUpperCase().replace('0X', '0x'), value: '0x10', blockNumber: '0xa' }, { hash: '0xbb', from: B, to: C, value: '0x1', blockNumber: '0xa' }] };
  if (method === 'eth_getTransactionByHash') return params[0] === '0xaa' ? { hash: '0xaa', from: B, to: GOLDCOTE, value: '0x10', blockNumber: '0xa' } : null;
  if (method === 'eth_getTransactionReceipt') return { status: '0x1' };
  throw new Error(`no ${method}`);
};

test('who holds a penguin, and who acts for its holder (v2 first, then v1)', async () => {
  assert.equal(await ownerOf(fake(), 5), A);
  const asked = [];
  assert.equal(await delegateOf(fake(asked), C, A, 5), 'delegate-v1');
  assert.deepEqual(asked, [`call ${DELEGATE_V2}`, `call ${DELEGATE_V1}`]);
  assert.equal(await delegateOf(fake(), B, A, 5), null);
  assert.deepEqual(await holds(fake(), A.toUpperCase().replace('0X', '0x'), 5), { holder: A, via: 'owner' });
  assert.deepEqual(await holds(fake(), C, 5), { holder: A, via: 'delegate-v1' });
  assert.deepEqual(await holds(fake(), B, 5), { holder: A, via: null });
});

test('the plain transfers to goldcote.eth, and one by its hash', async () => {
  const seen = await transfersTo(fake(), GOLDCOTE, 10, 10);
  assert.deepEqual(seen, [{ hash: '0xaa', from: B, to: GOLDCOTE, value: 16n, block: 10 }]);
  assert.deepEqual(await transferByHash(fake(), '0xaa'), { hash: '0xaa', from: B, to: GOLDCOTE, value: 16n, block: 10, ok: true });
  assert.equal(await transferByHash(fake(), '0xcc'), null);
});

test('a node that fails hands over to the next; none left is a ChainError', async () => {
  const real = globalThis.fetch;
  const hits = [];
  globalThis.fetch = async (url) => {
    hits.push(url);
    if (url === 'https://one.test') return new Response('down', { status: 502 });
    return Response.json({ jsonrpc: '2.0', id: 1, result: '0x2a' });
  };
  try {
    assert.equal(await nodeRpc(['https://one.test', 'https://two.test'])('eth_blockNumber', []), '0x2a');
    assert.deepEqual(hits, ['https://one.test', 'https://two.test']);
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(nodeRpc(['https://one.test'])('eth_blockNumber', []), ChainError);
  } finally {
    globalThis.fetch = real;
  }
});
