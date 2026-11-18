// pickthepenguin-claim: the code behind making a Pudgy Penguin's or a Lil Pudgy's page yours on pickthepenguin.com. No
// build step: the files you read here are the files that run. README.md says what is in each.

export * from './eth.js';
export { collectionOf, COLLECTIONS, tokenOfLabel } from './collections.js';
export * from './chain.js';
export * from './claim.js';
export { howWeCheckMd, REPO } from './howwecheck.js';
export { checkProof, proofUrl } from './check.js';

/** This release. pickthesite names it at the foot of every claim page; it is also the tag on GitHub (v1.1.0). */
export const VERSION = '1.1.0';
