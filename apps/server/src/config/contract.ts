import { createPublicClient, createWalletClient, defineChain, http, Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import memeWarzAbiJson from './memeWarzAbi.json';

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'],
    },
    public: {
      http: [process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: process.env.MONAD_EXPLORER_URL || 'https://testnet.monadexplorer.com',
    },
  },
  testnet: true,
});

export const MEME_WARZ_ABI = memeWarzAbiJson as unknown as Abi;

export const MEME_WARZ_ADDRESS = (process.env.MEME_WARZ_ADDRESS ||
  '0x4b3299302f7722600c5039c1da1bd8822e992364') as `0x${string}`;

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'),
});

const keeperPrivateKey = process.env.KEEPER_PRIVATE_KEY || process.env.PRIVATE_KEY;

export const keeperAccount = keeperPrivateKey
  ? privateKeyToAccount(
      (keeperPrivateKey.startsWith('0x') ? keeperPrivateKey : `0x${keeperPrivateKey}`) as `0x${string}`
    )
  : null;

export const keeperWalletClient = keeperAccount
  ? createWalletClient({
      account: keeperAccount,
      chain: monadTestnet,
      transport: http(process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'),
    })
  : null;
