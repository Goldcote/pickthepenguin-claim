# How pickthepenguin checks a proof

Every Pudgy Penguin has a page at its number, such as 1234.pickthepenguin.com, and a Lil Pudgy's page is at lil- and its number, such as lil-1234.pickthepenguin.com. Its holder makes the page theirs by proving they control the wallet that holds the penguin. There are two ways to prove it, and neither can move the penguin. Everything below is public and can be checked by anyone.

## Who holds a penguin

- Each collection's contract on Ethereum names the wallet that holds a penguin, with `ownerOf(tokenId)`:
  - Pudgy Penguins: `0xBd3531dA5CF5857e7CfAA92426877b022e612cf8`, token ids 0 to 8887
  - Lil Pudgys: `0x524cAB2ec69124574082676e6F654a18df49A048`, token ids 0 to 22221
- A holder can let another wallet act for them on delegate.xyz, so a penguin kept in a vault never has to touch a website. We accept a wallet that the registry names for the holder, for the whole vault, for the penguin's contract or for that token, full delegations only:
  - registry v2 `0x00000000000000447e69651d841bD8D104Bed493`: `checkDelegateForERC721(wallet, holder, contract, tokenId, 0x0)`
  - registry v1 `0x00000000000076A84feF008CDAbe6409d2FE638B`: `checkDelegateForToken(wallet, holder, contract, tokenId)`

## Way 1: a signed message

The wallet signs a Sign-In with Ethereum message (EIP-4361), with `personal_sign` (EIP-191). It names the page's address, the penguin, the wallet, a code used once, and when it stops counting (ten minutes after it was asked for):

```
1234.pickthepenguin.com wants you to sign in with your Ethereum account:
0x…

Claim 1234.pickthepenguin.com for Pudgy Penguin #1234. A signature only: no transaction, no gas, no approval.

URI: https://1234.pickthepenguin.com/claim
Version: 1
Chain ID: 1
Nonce: …
Issued At: …
Expiration Time: …
```

We check that the signature comes from that wallet (the address its key recovers to; a contract wallet such as a Safe answers `isValidSignature`, EIP-1271, with `0x1626ba7e`), that it arrived before the expiration time, and that the wallet holds the penguin or is its delegate. The message is plain text: before signing, the wallet puts `Ethereum Signed Message` in front of it, and orders, permits and transactions are signed in other formats, so this signature can never be used as one of them. It costs nothing and needs no gas. We ask for this one signature and nothing else; a page with our name that asks for more is a fake.

## Way 2: a test payment to goldcote.eth

For a holder who would rather connect nothing, the way exchanges check a wallet (a "Satoshi test"):

1. We show an exact amount between 0.0000101 and 0.0000999 ETH, seven decimals, never ending in 0. The amount is the claim's code: no other open claim has it, and it counts for one hour.
2. They send exactly that amount, as a plain transfer, to goldcote.eth: `0x0cD586c0117b7ceA016cf2B505B104C49a2a68Fa`, the address of Goldcote Ltd, the company named in our Terms. It is one address for every claim.
3. We read the blocks mined after the claim began. A transfer to that address of the code's amount, in a block mined before the hour is up, from the wallet that holds the penguin or its delegate, is the proof. Its transaction hash is kept with the page.

Only whoever controls a wallet can send from it, and the amount was shown to that claim alone. The server only reads Ethereum: it holds no key. A wrong amount or a tip stays in the company wallet, and a mistake can be sent back.

## After a proof

- The page is theirs, and its panel link goes to the email they gave. Each claimed page links to its proof (`/proof`): the wallet, the holder, when, and the signed message with its signature, or the transfer.
- A later proof by the same holder replaces an earlier claim, so a holder can always take their page back.
- Once a day we read who holds each claimed penguin. When it has changed hands, the page goes back to waiting for its new holder, without the old holder's words and photos (a move into the holder's own vault, delegated to the wallet that proved it, keeps the page).

## Check a proof yourself

Each claimed page also gives its proof as data, at `/proof.json`. Our check tool reads it and checks it again from public Ethereum data, without trusting us:

```
npx github:Goldcote/pickthepenguin-claim 1234
```

For a Pudgy Penguin, give its number (1234); for a Lil Pudgy, lil- and its number (lil-1234); or any page's address. It checks that the signed message is the claim message for that penguin, word for word, and that the signature comes from the wallet it names (or that the transfer went from that wallet to goldcote.eth with the code's amount). Then it reads who holds the penguin today. It asks a public Ethereum node; `--rpc` and an address of your own picks another.

## The code

What the claim page asks your wallet for, the message, these checks and the check tool are public: https://github.com/Goldcote/pickthepenguin-claim. pickthesite runs a released version of it, named at the foot of every claim page, and the script your browser runs on a claim page (`/site/claim.js`) is that version's `browser/claim.js`, byte for byte.
