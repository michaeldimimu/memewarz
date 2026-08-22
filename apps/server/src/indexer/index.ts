import { decodeEventLog, Log } from 'viem';
import { publicClient, MEME_WARZ_ABI, MEME_WARZ_ADDRESS } from '../config/contract';
import gameRepo from '../repos/gameRepository';
import { io } from '../index';
import { ParticipantRole, GameStatus } from '@prisma/client';

let isIndexing = false;
let lastProcessedBlock: bigint = 0n;

export async function startIndexer() {
  console.log('[Indexer] Starting contract event indexer...');
  try {
    const currentBlock = await publicClient.getBlockNumber();
    lastProcessedBlock = currentBlock > 500n ? currentBlock - 500n : 0n;
    console.log('[Indexer] Initialized at block ' + lastProcessedBlock);
  } catch (err) {
    console.error('[Indexer] Failed to get initial block number:', err);
  }

  setInterval(async () => {
    if (isIndexing) return;
    isIndexing = true;
    try {
      await pollEvents();
    } catch (err) {
      console.error('[Indexer] Error polling events:', err);
    } finally {
      isIndexing = false;
    }
  }, 3000);
}

async function pollEvents() {
  const latestBlock = await publicClient.getBlockNumber();
  if (latestBlock <= lastProcessedBlock) return;

  const fromBlock = lastProcessedBlock + 1n;
  const toBlock = latestBlock;

  const logs = await publicClient.getLogs({
    address: MEME_WARZ_ADDRESS,
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    await processLog(log);
  }

  lastProcessedBlock = toBlock;
}

async function processLog(log: Log) {
  try {
    const decoded = decodeEventLog({
      abi: MEME_WARZ_ABI,
      data: log.data,
      topics: log.topics,
    }) as unknown as { eventName: string; args: any };

    const { eventName, args } = decoded;
    console.log('[Indexer] Decoded event ' + eventName + ' at block ' + log.blockNumber);
    const gameId = args?.gameId ? String(args.gameId) : null;

    if (gameId) {
      io?.to('game:' + gameId).emit('contract_event', {
        eventName,
        args,
        blockNumber: log.blockNumber?.toString(),
        txHash: log.transactionHash,
      });
    }
    io?.emit('contract_event', {
      eventName,
      args,
      blockNumber: log.blockNumber?.toString(),
      txHash: log.transactionHash,
    });

    switch (eventName) {
      case 'GameCreated': {
        const host = await gameRepo.upsertPlayer({
          name: String(args.host).slice(0, 6),
          walletAddress: String(args.host),
        });
        await gameRepo.create({
          roomName: args.roomName || ('Room ' + args.gameCode),
          roomCode: String(args.gameCode),
          roundDurationMs: Number(args.votingDuration) * 1000,
          prizePool: Number(args.prizePool) / 1e18,
          entryFee: Number(args.entryFee) / 1e18,
          host: { connect: { id: host.id } },
          participants: {
            create: {
              player: { connect: { id: host.id } },
              role: ParticipantRole.host,
              isReady: true,
            },
          },
        });
        break;
      }
      case 'PlayerJoined': {
        const player = await gameRepo.upsertPlayer({
          name: String(args.player).slice(0, 6),
          walletAddress: String(args.player),
        });
        const game = await gameRepo.findByOnChainId(args.gameId);
        if (game) {
          await gameRepo.joinGame({
            gameId: game.id,
            playerId: player.id,
            role: 'voter',
          });
        }
        break;
      }
      case 'CompetitorsAssigned': {
        const game = await gameRepo.findByOnChainId(args.gameId);
        if (game) {
          const comp1 = await gameRepo.upsertPlayer({
            name: String(args.competitor1).slice(0, 6),
            walletAddress: String(args.competitor1),
          });
          const comp2 = await gameRepo.upsertPlayer({
            name: String(args.competitor2).slice(0, 6),
            walletAddress: String(args.competitor2),
          });
          await gameRepo.joinGame({ gameId: game.id, playerId: comp1.id, role: 'contestant' });
          await gameRepo.joinGame({ gameId: game.id, playerId: comp2.id, role: 'contestant' });
          await gameRepo.update(game.id, { status: GameStatus.generating });
        }
        break;
      }
      case 'VotingStarted': {
        const game = await gameRepo.findByOnChainId(args.gameId);
        if (game) {
          await gameRepo.update(game.id, { status: GameStatus.voting });
        }
        break;
      }
      case 'VotingEnded':
      case 'GameFinished': {
        const game = await gameRepo.findByOnChainId(args.gameId);
        if (game) {
          await gameRepo.update(game.id, { status: GameStatus.finished });
        }
        break;
      }
    }
  } catch (err) {
    // Ignored unknown logs
  }
}
