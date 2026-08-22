# Meme Warz Smart Contracts (Monad)

Production-grade, gas-efficient, well-tested Solidity (^0.8.24) smart contracts for **Meme Warz** on Monad.

---

## 🎮 Project Summary

**Meme Warz** is a decentralized, on-chain party game:

1. **Host Creates Room**: Sets a room name, voting duration, optional entry fee, and funds a prize pool in native `MON`.
2. **6-Digit Room Code**: Generated dynamically (`100000..999999`) and mapped for joining.
3. **Players Join**: Players join using the room code (paying zero or an optional entry fee).
4. **Game Starts & Randomness**: When the host starts the game (with $\ge 3$ players), the contract requests verifiable randomness via **Pyth Entropy** to randomly select **2 Meme Creators (competitors)** and assign each a meme template; all other joined players become **Voters**.
5. **Caption Submission**: Both Meme Creators submit captions for their assigned meme templates. Once both have submitted, voting begins.
6. **Voting Window**: Voters cast one vote each before the countdown timer expires.
7. **Settlement**: Voting concludes when the timer finishes (or all voters have voted).
8. **Tie-Breaker Rule**: If votes are tied, the net prize pool is split **50/50 equally** between both competitors (odd wei assigned to competitor 0).
9. **Pull-Payment Prize Distribution**: Winning competitor(s) withdraw their funds securely via `claimPrize`.

---

## 🎲 Randomness Strategy & Trust Model

### Why Block Variables Are Insufficient
On high-throughput EVM chains like **Monad L1**, block variables (`block.prevrandao`, `blockhash`, `block.timestamp`) are pseudo-random and susceptible to validator manipulation or front-running in financial games.

### Chosen Solution: Pyth Entropy
This contract implements the `IEntropyConsumer` interface and interacts with **Pyth Entropy**:
- **Two-phase Commit-Reveal**: `startGame` commits a seed and invokes `entropy.requestWithCallback{value: fee}(provider, userSeed)`.
- **Verifiable Asynchronous Callback**: The Pyth network fulfills the request via `entropyCallback(sequenceNumber, provider, randomNumber)`.
- **Isolated Derivation**: The verifiable 32-byte entropy is hashed with distinct salts to derive independent random indices for both competitor selection and meme template allocation.
- **Local / Test Fallback**: In test environments or when `entropy` is address(0), deterministic local seeds or `MockEntropy` handle fulfillment seamlessly.

---

## 🏗️ Architecture & Data Model

### State Machine (`GameStatus`)
```solidity
enum GameStatus {
    Open,        // Room created, players joining
    Assigning,   // Pyth Entropy requested, awaiting VRF callback
    Submitting,  // 2 competitors selected, submitting meme captions
    Voting,      // Both memes submitted, voting window active
    Finished,    // Votes tallied, prize claimable by winner(s)
    Cancelled    // Host cancelled open room, all funds refunded
}
```

### Core Structs
- `Game`: Room metadata, host, prize pool, entry fee, voting timer, competitors, winner, and claim status.
- `Player`: Role (`Competitor` vs `Voter`), join status, vote status, and submission status.
- `MemeEntry`: Competitor address, meme template ID, caption string (max 280 bytes), vote count, and submission timestamp.
- `MemeTemplate`: On-chain registry pointer with `imageURI` (`ipfs://` or `https://`).

### Security Features
- **Reentrancy Protection**: OpenZeppelin `ReentrancyGuard` on `claimPrize`, `cancelGame`, and fee withdrawals.
- **Pull Payments**: Prizes are escrowed into `claimablePrizes[gameId][recipient]` upon settlement; funds are never pushed during vote tallying.
- **Checks-Effects-Interactions (CEI)**: State variables are updated before any external value transfers.
- **Custom Errors**: Gas-efficient custom errors (`GameNotOpen`, `AlreadyJoined`, `OnlyCompetitor`, `OnlyVoter`, etc.) instead of require strings.
- **Code Recycling**: 6-digit codes are recycled upon `Finished` or `Cancelled` states to prevent storage bloat and ensure availability.
- **Configurable Platform Fee**: Optional protocol fee (in basis points, hard-capped at 10%) managed via `Ownable2Step`.

---

## 🚀 Monad Testnet Deployment

### Deployed Contract Details
- **MemeWarz Contract Address**: [`0xEB217De4E615bb0CB8B315443B0a419845De93a5`](https://testnet.monadexplorer.com/address/0xEB217De4E615bb0CB8B315443B0a419845De93a5)
- **Deployment Transaction**: [`0x31cde9db19686ac3c4b594b2338fb1845ee5083bc268d2ff201a6729a91a180a`](https://testnet.monadexplorer.com/tx/0x31cde9db19686ac3c4b594b2338fb1845ee5083bc268d2ff201a6729a91a180a)
- **Pyth Entropy (Monad Testnet)**: `0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320`
- **Pyth Provider (Monad Testnet)**: `0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344`
- **Initial Platform Fee**: 2.5% (250 bps)
- **Pre-registered Templates**: 4 IPFS Monad meme templates

### Network Details
- **Network Name**: Monad Testnet
- **Chain ID**: `10143`
- **RPC URL**: `https://rpc-testnet.monadinfra.com` (Fallback: `https://testnet-rpc.monad.xyz`)
- **Currency Symbol**: `MON`
- **Block Explorer**: `https://testnet.monadexplorer.com`
- **Faucet**: `https://faucet.monad.xyz`

### 1. Build and Test
```bash
# Build contracts
forge build

# Run comprehensive test suite
forge test -vvv
```

### 2. Configure Environment
Create a `.env` file or export your environment variables:
```bash
export PRIVATE_KEY="0x..."
export MONAD_RPC_URL="https://testnet-rpc.monad.xyz"
export PYTH_ENTROPY_ADDRESS="0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320"
export PYTH_PROVIDER_ADDRESS="0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344"
```

### 3. Deploy to Monad Testnet
```bash
forge script script/DeployMemeWarz.s.sol:DeployMemeWarz \
  --rpc-url $MONAD_RPC_URL \
  --broadcast \
  --verify
```

---

## 🧪 Test Suite Overview

Located in `test/MemeWarz.t.sol`:

| Test Name | Description |
|---|---|
| `test_FullHappyPathGameLifecycle` | Full flow: create room $\rightarrow$ 4 players join $\rightarrow$ Pyth Entropy request + callback $\rightarrow$ competitor role assignment $\rightarrow$ meme submissions $\rightarrow$ voting $\rightarrow$ settlement $\rightarrow$ pull-payment prize claim. |
| `test_RevertIfDoubleJoin` | Asserts joined players (and host) cannot join the same room twice. |
| `test_RevertIfDoubleVote` | Asserts voters cannot vote multiple times in a game. |
| `test_RevertIfCompetitorAttemptsToVote` | Asserts competitors are barred from voting. |
| `test_RevertIfVotingAfterDeadline` | Asserts voting reverts after `votingStartTime + votingDuration`. |
| `test_SettlementAfterDeadline` | Verifies anyone can settle the game once the deadline expires. |
| `test_TieBreakRuleSplitsPotEqually` | Verifies that a tied vote splits the net prize pool 50/50 between both competitors. |
| `test_HostCanCancelOpenGameAndRefund` | Tests host room cancellation and full refund of host prize pool + player entry fees. |
| `test_RevertIfNonHostAttemptsCancellation` | Asserts non-hosts cannot cancel games. |
| `test_RevertIfCancelAfterGameStarts` | Asserts rooms cannot be cancelled once active. |
| `test_ReentrancyAttemptOnClaimPrize` | Attacker contract tests reentrancy attack on `claimPrize` and is prevented by `ReentrancyGuard`. |
| `test_PlatformFeeWithdrawal` | Verifies platform fee accumulation and owner withdrawal. |
