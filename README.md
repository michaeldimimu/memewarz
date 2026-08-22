# ⚔️ MemeWarz

**MemeWarz** is a decentralized, real-time multiplayer meme battle arena built on **Monad Testnet**. Players join rooms, enter meme battle tournaments, generate and submit meme captions, vote on contenders in real-time, and win on-chain prize pools settled with verifiable randomness via Pyth Entropy.

---

##  Smart Contract Deployment Details

| Parameter | Details / Link |
| :--- | :--- |
| **Network** | Monad Testnet |
| **Chain ID** | `10143` |
| **Native Currency** | `MON` |
| **RPC URL** | `https://testnet-rpc.monad.xyz` |
| **Contract Address** | [`0x4b3299302f7722600c5039c1da1bd8822e992364`](https://testnet.monadexplorer.com/address/0x4b3299302f7722600c5039c1da1bd8822e992364) |
| **Deployment Transaction Hash** | `0x78815c5f1dddae2b320da18136689f67d9cec08c9c4c43966b3cb3f6b65918d2` |
| **Deployed Contract Hash URL** | [https://testnet.monadscan.com/tx/0x78815c5f1dddae2b320da18136689f67d9cec08c9c4c43966b3cb3f6b65918d2](https://testnet.monadscan.com/tx/0x78815c5f1dddae2b320da18136689f67d9cec08c9c4c43966b3cb3f6b65918d2) |
| **Monad Explorer URL** | [https://testnet.monadexplorer.com](https://testnet.monadexplorer.com) / [https://testnet.monadscan.com](https://testnet.monadscan.com) |
| **Pyth Entropy Address** | `0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320` |
| **Pyth Provider Address** | `0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344` |

---

## Monorepo Architecture

The repository is organized as a high-performance Turborepo monorepo:

```
memewarz/
├── apps/
│   ├── memewarz_contract/  # Foundry smart contracts (Solidity 0.8.20+)
│   ├── server/             # Express.js, Socket.IO, On-chain Indexer & Keeper Bot
│   └── web/                # Next.js 16 (React 19) Frontend Application
├── packages/
│   ├── eslint-config/      # Shared ESLint configuration
│   ├── typescript-config/  # Shared TypeScript configuration
│   └── ui/                 # Shared React UI components
├── turbo.json              # Turborepo build pipeline configuration
└── pnpm-workspace.yaml     # Monorepo workspace configuration
```

---

##  How MemeWarz Works

1. **Room Creation & Entry**:
   - Host creates a game room specifying entry fees, prize pools, and voting round duration.
   - Players join by paying the on-chain entry fee into the smart contract escrow.

2. **Pyth Entropy Matchmaking**:
   - Once players are ready, the contract queries **Pyth Entropy** to verifiably select two competing contestants for the round at random.

3. **Meme Creation & Submission**:
   - Competitors choose meme templates and submit top/bottom captions.
   - Images are rendered and submitted on-chain or through game servers.

4. **Live Community Voting**:
   - Other players in the room vote on the funniest meme within the active voting window.

5. **Automated Settlement (Keeper)**:
   - The automated keeper bot continuously monitors active games on Monad.
   - Once a voting period expires, the keeper executes `endVotingAndSettle`, distributing the prize pool directly to the winning contestant.

---

## ⚙️ Core Components

### 1. Smart Contracts (`apps/memewarz_contract`)
- Built with **Foundry** and **OpenZeppelin Contracts**.
- **Pyth Entropy Integration** for non-biasable player selection.
- Escrow handling for entry fees, prize distribution, and platform fees.

### 2. Backend Server & Engine (`apps/server`)
- **Express.js API**: Manages rooms, player metadata, and template fetching.
- **Socket.IO**: Real-time room events, player readiness, and game status syncing.
- **Contract Event Indexer**: Continuously polls Monad Testnet for contract events (`GameCreated`, `PlayerJoined`, `CompetitorsAssigned`, `VotingStarted`, `GameFinished`) and syncs database state.
- **Automated Settlement Keeper**: Monitors expired voting periods and calls `endVotingAndSettle` autonomously.

### 3. Frontend Web App (`apps/web`)
- Built with **Next.js 16**, **React 19**, and **Tailwind CSS**.
- Monad wallet connection and interactive meme canvas editor.

---

## 🔌 API Reference (`apps/server`)

### REST Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check |
| `GET` | `/api/rooms` | List active rooms and games |
| `POST` | `/api/rooms` | Create a new game room |
| `GET` | `/api/rooms/:gameId` | Retrieve details for a specific game |
| `GET` | `/api/rooms/code/:roomCode` | Retrieve game by room code |
| `POST` | `/api/rooms/:roomCode/join` | Join a game room |
| `PATCH` | `/api/rooms/:gameId/ready` | Toggle player ready status |
| `POST` | `/api/rooms/:gameId/rounds` | Start a new round |
| `POST` | `/api/rooms/rounds/:roundId/memes` | Submit meme entry for a round |
| `POST` | `/api/rooms/rounds/:roundId/votes` | Cast a vote for a meme entry |
| `POST` | `/api/rooms/rounds/:roundId/finish` | Conclude a round |
| `GET` | `/api/templates` | Fetch available meme templates from contract |
| `POST` | `/api/memes/render` | Render meme with top/bottom caption overlays |

### Socket.IO Real-Time Events

- `join_game` / `leave_game`: Subscribe or unsubscribe to room updates (`game:<gameId>`).
- `contract_event`: Real-time on-chain events relayed from the contract indexer.

---

## 🛠️ Environment Configuration

### Contract (`apps/memewarz_contract/.env`)
```env
PRIVATE_KEY=<YOUR_DEPLOYER_PRIVATE_KEY>
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
PYTH_ENTROPY_ADDRESS=0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320
PYTH_PROVIDER_ADDRESS=0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344
MONAD_EXPLORER_URL=https://testnet.monadexplorer.com
```

### Server (`apps/server/.env`)
```env
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/memewarz
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MEME_WARZ_ADDRESS=0x4b3299302f7722600c5039c1da1bd8822e992364
KEEPER_PRIVATE_KEY=<YOUR_KEEPER_PRIVATE_KEY>
CLOUDINARY_CLOUD_NAME=<CLOUDINARY_CLOUD_NAME>
CLOUDINARY_API_KEY=<CLOUDINARY_API_KEY>
CLOUDINARY_API_SECRET=<CLOUDINARY_API_SECRET>
```

---

## 🚀 Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (>= 18)
- [pnpm](https://pnpm.io/) (>= 9)
- [Foundry](https://getfoundry.sh/) (for smart contract compilation & testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/michaeldimimu/memewarz.git
cd memewarz

# Install dependencies across all monorepo packages
pnpm install
```

### Development

```bash
# Run all applications and services simultaneously (Web + Server)
pnpm dev

# Or run specific packages
pnpm dev --filter=server
pnpm dev --filter=web
```

### Build & Typecheck

```bash
# Build all packages and applications
pnpm build

# Type check TypeScript across all packages
pnpm check-types
```

### Smart Contract Commands (`apps/memewarz_contract`)

```bash
cd apps/memewarz_contract

# Compile contracts
forge build

# Run unit tests
forge test

# Deploy to Monad Testnet
forge script script/DeployMemeWarz.s.sol:DeployMemeWarz --rpc-url https://testnet-rpc.monad.xyz --broadcast
```

---

