import { type Abi } from "viem";
import memeWarzAbiJson from "./memeWarzAbi.json";

export const MEME_WARZ_ABI = memeWarzAbiJson as unknown as Abi;

export const MEME_WARZ_ADDRESS = (process.env.NEXT_PUBLIC_MEME_WARZ_ADDRESS ||
  "0x4b3299302f7722600c5039c1da1bd8822e992364") as `0x${string}`;

/**
 * Reusable contract config object for wagmi hooks
 * (useReadContract, useWriteContract, etc.)
 */
export const memeWarzContract = {
  address: MEME_WARZ_ADDRESS,
  abi: MEME_WARZ_ABI,
} as const;
