// The collections a page under pickthepenguin.com can be for: each one's contract on Ethereum, the numbers its tokens
// have, and the name its pages and the claim message give one. A page's address says which: 1234.pickthepenguin.com is
// Pudgy Penguin #1234, lil-1234.pickthepenguin.com is Lil Pudgy #1234.

/** @typedef {'pudgy' | 'lil'} CollectionKey */
/** @typedef {{ key: CollectionKey; name: string; names: string; contract: string; max: number; prefix: string; field: string }} Collection */

/** The Pudgy Penguins contract. */
export const PUDGY = '0xbd3531da5cf5857e7cfaa92426877b022e612cf8';
/** The Lil Pudgys contract. */
export const LIL_PUDGY = '0x524cab2ec69124574082676e6f654a18df49a048';

/** Every collection: its contract, its highest token number (they start at 0), the start of its pages' addresses, and
 *  the field that names its token in a page's proof (/proof.json).
 *  @type {Readonly<Record<CollectionKey, Collection>>} */
export const COLLECTIONS = Object.freeze({
  pudgy: Object.freeze({ key: 'pudgy', name: 'Pudgy Penguin', names: 'Pudgy Penguins', contract: PUDGY, max: 8887, prefix: '', field: 'penguin' }),
  lil: Object.freeze({ key: 'lil', name: 'Lil Pudgy', names: 'Lil Pudgys', contract: LIL_PUDGY, max: 22221, prefix: 'lil-', field: 'lilPudgy' }),
});

/** A collection by its key: Pudgy Penguins when none is given. @param {string} [key] @returns {Collection} */
export function collectionOf(key = 'pudgy') {
  const c = COLLECTIONS[/** @type {CollectionKey} */ (key)];
  if (!c) throw new Error(`No collection "${key}".`);
  return c;
}

/** The token a page's first address label is for: "1234" is Pudgy Penguin #1234, "lil-1234" Lil Pudgy #1234 (no
 *  leading zeros, within the collection's numbers), anything else null. @param {string} label
 *  @returns {{ collection: Collection; id: number } | null} */
export function tokenOfLabel(label) {
  const m = /^(lil-)?(0|[1-9]\d{0,4})$/.exec(String(label ?? ''));
  if (!m) return null;
  const collection = m[1] ? COLLECTIONS.lil : COLLECTIONS.pudgy, id = Number(m[2]);
  return id <= collection.max ? { collection, id } : null;
}
