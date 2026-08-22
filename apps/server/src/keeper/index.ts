import { keeperWalletClient, keeperAccount, publicClient, MEME_WARZ_ABI, MEME_WARZ_ADDRESS } from '../config/contract';

let isRunningKeeper = false;

export async function startKeeper() {
  if (!keeperWalletClient || !keeperAccount) {
    console.warn('[Keeper] No keeper private key configured. Keeper settlement bot disabled.');
    return;
  }

  console.log('[Keeper] Starting settlement keeper bot with account: ' + keeperAccount.address);

  setInterval(async () => {
    if (isRunningKeeper) return;
    isRunningKeeper = true;
    try {
      await checkAndSettleGames();
    } catch (err) {
      console.error('[Keeper] Error checking games for settlement:', err);
    } finally {
      isRunningKeeper = false;
    }
  }, 5000);
}

async function checkAndSettleGames() {
  if (!keeperWalletClient || !keeperAccount) return;

  try {
    const totalGames = (await publicClient.readContract({
      address: MEME_WARZ_ADDRESS,
      abi: MEME_WARZ_ABI,
      functionName: 'gameCounter',
    })) as bigint;

    const now = BigInt(Math.floor(Date.now() / 1000));

    for (let i = 1n; i <= totalGames; i++) {
      try {
        const game = (await publicClient.readContract({
          address: MEME_WARZ_ADDRESS,
          abi: MEME_WARZ_ABI,
          functionName: 'getGame',
          args: [i],
        })) as any;

        // Status 3 = Voting in smart contract GameStatus enum
        if (game.status === 3) {
          const votingEndTime = BigInt(game.votingStartTime) + BigInt(game.votingDuration);
          if (now >= votingEndTime) {
            console.log('[Keeper] Game ' + i + ' voting has ended. Executing endVotingAndSettle...');
            const hash = await keeperWalletClient.writeContract({
              address: MEME_WARZ_ADDRESS,
              abi: MEME_WARZ_ABI,
              functionName: 'endVotingAndSettle',
              args: [i],
            });
            console.log('[Keeper] Settled game ' + i + ', txHash: ' + hash);
          }
        }
      } catch (err) {
        // Continue checking other games if one fails
      }
    }
  } catch (err) {
    console.error('[Keeper] Failed to query game counter:', err);
  }
}
