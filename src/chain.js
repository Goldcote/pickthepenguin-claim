// Ethereum, read and never written: who holds a penguin (a Pudgy Penguin, or a Lil Pudgy: ./collections.js), whether a
// wallet is its holder's delegate on delegate.xyz,
// whether a contract wallet (a Safe) accepts a signature, and the plain transfers that reach goldcote.eth. Every function
// here takes `rpc`, the one way it reaches Ethereum: (method, params) => the node's answer. nodeRpc() makes one from a
// list of nodes; pickthesite's server puts its own provider first, the check tool (bin/check.js) asks public nodes.

import { PUDGY } from './collections.js';
import { bytesToHex, callData, decodeAddress, decodeBool, encAddress, encBytes32, encUint } from './eth.js';

export { LIL_PUDGY, PUDGY } from './collections.js';
/** goldcote.eth: Goldcote Ltd's own name on Ethereum, the company in pickthepenguin's Terms. Way 2's transfers go here. */
export const GOLDCOTE = '0x0cd586c0117b7cea016cf2b505b104c49a2a68fa';
/** delegate.xyz's registries: v2, and v1 for the delegations made before it (both at these addresses on every chain). */
export const DELEGATE_V2 = '0x00000000000000447e69651d841bd8d104bed493';
export const DELEGATE_V1 = '0x00000000000076a84fef008cdabe6409d2fe638b';
/** Two public Ethereum nodes anyone can ask, no account needed. */
export const PUBLIC_NODES = ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com'];

/** Ethereum couldn't be read (every node failed or timed out). */
export class ChainError extends Error {}

/** @typedef {(method: string, params: unknown[]) => Promise<any>} Rpc */

/** An Rpc that asks each node in turn: each call gives up after `timeout` ms and the next node is asked.
 *  @param {string[]} [nodes] @param {{ timeout?: number }} [o] @returns {Rpc} */
export function nodeRpc(nodes = PUBLIC_NODES, o = {}) {
  const timeout = o.timeout ?? 8000;
  return async (method, params) => {
    let last = '';
    for (const node of nodes) {
      try {
        const r = await globalThis.fetch(node, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(timeout) });
        if (!r.ok) { last = `http ${r.status}`; continue; }
        const d = await r.json();
        if (d.error) { last = String(d.error.message ?? 'error'); continue; }
        if (d.result === undefined) { last = 'no result'; continue; }
        return d.result;
      } catch (e) {
        last = e?.name === 'TimeoutError' ? 'timeout' : 'network';
      }
    }
    throw new ChainError(`${method}: ${last}`);
  };
}
/** @param {Rpc} rpc @param {string} to @param {string} data @returns {Promise<string>} */
const call = (rpc, to, data) => rpc('eth_call', [{ to, data }, 'latest']);

/** The wallet that holds a penguin now (lowercase). `contract`: its collection's, Pudgy Penguins' when left out.
 *  @param {Rpc} rpc @param {number} id @param {string} [contract] */
export async function ownerOf(rpc, id, contract = PUDGY) {
  const a = decodeAddress(await call(rpc, contract, callData('ownerOf(uint256)', [{ s: encUint(id) }])));
  if (!a) throw new ChainError('ownerOf: no address');
  return a;
}

/** Is `wallet` allowed to act for `holder` on this penguin through delegate.xyz (its whole vault, its collection's
 *  contract, or this token; full delegations only)? Which registry says so, or null.
 *  @param {Rpc} rpc @param {string} wallet @param {string} holder @param {number} id @param {string} [contract]
 *  @returns {Promise<'delegate-v2' | 'delegate-v1' | null>} */
export async function delegateOf(rpc, wallet, holder, id, contract = PUDGY) {
  const v2 = callData('checkDelegateForERC721(address,address,address,uint256,bytes32)', [{ s: encAddress(wallet) }, { s: encAddress(holder) }, { s: encAddress(contract) }, { s: encUint(id) }, { s: encBytes32('0x') }]);
  if (decodeBool(await call(rpc, DELEGATE_V2, v2))) return 'delegate-v2';
  const v1 = callData('checkDelegateForToken(address,address,address,uint256)', [{ s: encAddress(wallet) }, { s: encAddress(holder) }, { s: encAddress(contract) }, { s: encUint(id) }]);
  if (decodeBool(await call(rpc, DELEGATE_V1, v1))) return 'delegate-v1';
  return null;
}

/** @typedef {'owner' | 'delegate-v2' | 'delegate-v1'} Via */
/** Does this wallet hold the penguin, or act for its holder? The holder and how, or null with the holder.
 *  @param {Rpc} rpc @param {string} wallet @param {number} id @param {string} [contract]
 *  @returns {Promise<{ holder: string; via: Via | null }>} */
export async function holds(rpc, wallet, id, contract = PUDGY) {
  const holder = await ownerOf(rpc, id, contract), w = wallet.toLowerCase();
  if (holder === w) return { holder, via: 'owner' };
  return { holder, via: await delegateOf(rpc, w, holder, id, contract) };
}

/** A contract wallet's own word on a signature (EIP-1271: isValidSignature answers 0x1626ba7e when it accepts it).
 *  @param {Rpc} rpc @param {string} wallet @param {Uint8Array} hash @param {string} signature */
export async function contractAccepts(rpc, wallet, hash, signature) {
  const code = await rpc('eth_getCode', [wallet, 'latest']);
  if (!code || code === '0x') return false;
  try {
    const r = await call(rpc, wallet, callData('isValidSignature(bytes32,bytes)', [{ s: encBytes32(bytesToHex(hash)) }, { bytes: signature }]));
    return /^0x1626ba7e/i.test(r);
  } catch {
    return false; // (a contract without the function answers with an error)
  }
}

/** @param {Rpc} rpc */
export const latestBlock = async (rpc) => parseInt(await rpc('eth_blockNumber', []), 16);
/** When a block was mined, in milliseconds; 0 when Ethereum doesn't have it. @param {Rpc} rpc @param {number} block */
export async function blockTime(rpc, block) {
  const b = await rpc('eth_getBlockByNumber', [`0x${block.toString(16)}`, false]);
  return b ? parseInt(b.timestamp, 16) * 1000 : 0;
}

/** @typedef {{ hash: string; from: string; to: string; value: bigint; block: number; ok?: boolean }} Transfer */
/** @param {{ hash: string; from: string; to: string | null; value: string; blockNumber: string }} t @returns {Transfer} */
const asTransfer = (t) => ({ hash: t.hash.toLowerCase(), from: t.from.toLowerCase(), to: (t.to ?? '').toLowerCase(), value: BigInt(t.value), block: parseInt(t.blockNumber, 16) });

/** The plain transfers to `to` in blocks from `first` to `last` (a transfer's own transaction: a wallet sending ETH
 *  itself, as way 2 asks). @param {Rpc} rpc @param {string} to @param {number} first @param {number} last */
export async function transfersTo(rpc, to, first, last) {
  /** @type {Transfer[]} */
  const out = [];
  const t = to.toLowerCase();
  for (let n = first; n <= last; n++) {
    const b = await rpc('eth_getBlockByNumber', [`0x${n.toString(16)}`, true]);
    for (const tx of b?.transactions ?? []) if ((tx.to ?? '').toLowerCase() === t) out.push(asTransfer(tx));
  }
  return out;
}

/** One transaction by its hash, with whether it went through; null when Ethereum doesn't have it (yet).
 *  @param {Rpc} rpc @param {string} hash @returns {Promise<Transfer | null>} */
export async function transferByHash(rpc, hash) {
  const tx = await rpc('eth_getTransactionByHash', [hash]);
  if (!tx || !tx.blockNumber) return null;
  const receipt = await rpc('eth_getTransactionReceipt', [hash]);
  return { ...asTransfer(tx), ok: receipt?.status === '0x1' };
}
