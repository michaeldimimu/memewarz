# Meme Warz — Full Project Reference

**Status:** Smart contract implemented and deployed to Monad testnet.
**Pending:** Contract address + ABI to be plugged into backend config (see Section 5).

---

## 1. What the Game Does

1. A **Host** creates a room — sets room name, voting time limit, and funds the prize pool (in native MON) in the same transaction.
2. A unique **6-digit code** is generated for others to join.
3. **Players** join using the code.
4. Once started, the contract randomly selects **2 players as Meme Creators (competitors)**; everyone else becomes a **Voter**.
5. Each competitor is randomly assigned a **meme template** and submits a **caption** to complete their entry.
6. Once both submit, **voting opens** with a countdown timer.
7. Each voter casts one vote for one competitor before the timer expires.
8. When the timer ends, votes are tallied, a winner is determined, and the **prize pool is released to the winner** via claim.
9. Room moves to `Finished` — read-only/historical from then on.

---

## 2. What the Smart Contract Owns (fully on-chain, trust-critical)

**Room lifecycle & state**

- Room creation with escrowed prize pool
- Unique 6-digit join code generation + tracking
- Status machine: `Open → Assigning → Submitting → Voting → Finished/Cancelled`
- Host-initiated cancellation with refund

**Player management**

- Join tracking, capacity limits, no double-joining
- Role assignment: exactly 2 Competitors, rest Voters
- Random competitor selection

**Randomness**

- Unbiased on-chain randomness (Pyth Entropy / Chainlink VRF / commit-reveal — whichever was chosen during implementation) used for competitor selection, template assignment, and room code generation

**Meme assignment & submission**

- Random `memeTemplateId`/URI assignment per competitor
- One submission per competitor (`submitMeme`)
- Auto-transition to voting once both submit or deadline passes

**Voting**

- Enforced time window (start + duration)
- One vote per voter, no double-voting
- Vote rejection outside the valid window

**Settlement**

- Vote tally + winner determination (+ defined tie-break rule)
- Prize pool escrow for the game's full duration
- Pull-payment claim (`claimPrize`) — winner withdraws, contract never pushes funds

**Events (the contract's public API for everything else)**
`GameCreated`, `PlayerJoined`, `CompetitorsAssigned`, `MemeSubmitted`, `VoteCast`, `VotingEnded`, `PrizeClaimed`, `GameCancelled`

**Security guarantees**

- Reentrancy guards on all fund-moving functions
- State-machine guards preventing out-of-order calls
- Access control: host-only / competitor-only / voter-only / winner-only functions

**Explicitly NOT the contract's job:** storing/rendering images, listing/searching rooms, triggering its own settlement, real-time notifications, usernames/profiles.

---

## 3. Contract Function Reference

### Writes (gas cost, wallet signature, called directly by the frontend)

| Function                                       | Caller     |
| ---------------------------------------------- | ---------- |
| `createGame(roomName, votingDuration)` payable | Host       |
| `joinGame(gameCode)`                           | Any player |
| `startGame(gameId)`                            | Host       |
| `submitMeme(gameId, caption)`                  | Competitor |
| `vote(gameId, competitor)`                     | Voter      |
| `claimPrize(gameId)`                           | Winner     |
| `cancelGame(gameId)`                           | Host       |

### Write called by the backend (not the frontend)

| Function                     | Caller                                    |
| ---------------------------- | ----------------------------------------- |
| `endVotingAndSettle(gameId)` | **Backend keeper bot**, once timer lapses |

### Reads (free, no signature)

| Function                  | Returns                                 |
| ------------------------- | --------------------------------------- |
| `getGame(gameId)`         | Full game struct                        |
| `getGameByCode(gameCode)` | Same, by 6-digit code                   |
| `getPlayers(gameId)`      | Player list + roles                     |
| `getMemeEntries(gameId)`  | Both competitors' entries + vote counts |

---

## 4. What the Backend Owns

### Media

- Host meme templates (IPFS/S3)
- Composite caption + template into the final meme image
- Upload/pin the result, return an `imageUri` the frontend passes into `submitMeme`

### Room discovery & history

- Index all 8 contract events into a DB (Postgres/SQLite) mirroring on-chain state
- Serve fast list/search/history queries the chain can't do cheaply

### Settlement automation (keeper)

- Watch each room's `votingStartTime + votingDuration`
- Call `endVotingAndSettle` the moment it expires — this is the only contract-write the backend itself performs

### Real-time UX

- WebSocket/SSE layer streaming indexed events to connected clients (no client-side chain polling)

### Optional niceties

- Shareable join links/QR codes from the room code
- Off-chain profile data (display name, avatar, stats) keyed by wallet address
- Rate limiting on `createGame`/`joinGame` spam at the frontend's RPC proxy level

**The backend never touches player funds or votes.** Its only write access is the one function with no natural human caller.

---

## 5. Backend Processes (3 total)

1. **API server** — serves reads (backed by indexed DB, falling back to live contract reads on cache miss), media endpoints, WebSocket connections
2. **Indexer worker** — long-running process watching all 8 contract events, writing to DB, pushing live updates
3. **Keeper worker** — the only process with contract write access; exclusively calls `endVotingAndSettle`

---

## 6. Integration Steps (build order)

0. **Prereqs:** deployed contract address + ABI, Monad testnet RPC URL, funded keeper wallet (separate key from any admin/owner key)
1. **Contract client setup** — shared config (ABI + address), a read-only public client, and a keeper wallet client (viem or ethers)
2. **DB schema** — `rooms`, `players`, `meme_entries`, `templates`, `sync_state` tables mirroring on-chain state
3. **Event indexer** — build incrementally: start with `GameCreated`/`PlayerJoined` (room + join flow), then `CompetitorsAssigned`/`MemeSubmitted` (meme UI), then `VoteCast`/`VotingEnded`/`PrizeClaimed`/`GameCancelled` (completes the loop). Track last-indexed block, wait for confirmations before treating events as final.
4. **Keeper job** — poll DB for rooms past their voting deadline not yet settled, call `endVotingAndSettle`, retry on failure without blocking other games, monitor wallet balance
5. **Media endpoints** — `GET /templates`, `POST /memes/render`
6. **Read API** — `GET /rooms`, `GET /rooms/:gameId`, `/players`, `/memes`, with live-chain fallback on cache miss
7. **Live layer** — WebSocket/SSE per-room subscriptions fed by the indexer
8. **Frontend direct-write confirmation** — `createGame`, `joinGame`, `startGame`, `submitMeme`, `vote`, `claimPrize`, `cancelGame` all called directly from the frontend wallet, never proxied through the backend
9. **Testing** — local Anvil fork first (script a full game via `cast send`), short `votingDuration` to test keeper timing, reorg handling, then move to Monad testnet
10. **Deployment & monitoring** — indexer and keeper as separate long-lived processes from the API; log keeper tx hashes; alert on low keeper balance or indexer lag

---

## 7. How the ABI Fits In

- Generated at compile time (Foundry: `out/MemeWarz.sol/MemeWarz.json` → the `abi` field; Hardhat: `artifacts/.../MemeWarz.json`)
- Copy the `abi` array into a shared backend config file — both the indexer and keeper import from the same source
- Used to encode function calls (`readContract`/`writeContract`) and decode event logs (`watchContractEvent`) into typed objects, instead of raw hex
- Re-copy any time the contract is redeployed or changed — a stale ABI causes silent decode failures

```ts
// config/contract.ts
export const memeWarzAbi = [...] as const;
export const memeWarzAddress = "0xYourDeployedAddress";
```
