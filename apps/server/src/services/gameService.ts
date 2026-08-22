import { GameStatus, MemeStatus, ParticipantRole, RoundStatus } from '@prisma/client';
import gameRepo from '../repos/gameRepository';
import { publicClient, MEME_WARZ_ABI, MEME_WARZ_ADDRESS } from '../config/contract';

type PlayerPayload = {
  name?: string;
  walletAddress: string;
};

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function makeRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function toMs(seconds: number) {
  return Math.max(10, Math.floor(seconds)) * 1000;
}

export class GameService {
  async createGame(data: {
    host: PlayerPayload;
    roomName: string;
    timeLimitSeconds: number;
    prizePool?: number;
    entryFee?: number;
    prompt?: string;
    maxPlayers?: number;
    roomCode?: string;
  }) {
    const host = await gameRepo.upsertPlayer({
      name: data.host.name || data.host.walletAddress.slice(0, 6),
      walletAddress: data.host.walletAddress,
    });
    const roomCode = data.roomCode || (await this.createUniqueRoomCode());

    return gameRepo.create({
      roomName: data.roomName,
      roomCode,
      prompt: data.prompt,
      roundDurationMs: toMs(data.timeLimitSeconds),
      prizePool: data.prizePool ?? 0,
      entryFee: data.entryFee ?? 0,
      maxPlayers: data.maxPlayers ?? 10,
      host: { connect: { id: host.id } },
      participants: {
        create: {
          player: { connect: { id: host.id } },
          role: ParticipantRole.host,
          isReady: true,
        },
      },
    });
  }

  listGames() {
    return gameRepo.findAll();
  }

  async getGame(id: string) {
    const game = await gameRepo.findById(id);
    if (!game) {
      const numericId = Number(id);
      if (!isNaN(numericId) && numericId > 0) {
        try {
          const onChainGame = await publicClient.readContract({
            address: MEME_WARZ_ADDRESS,
            abi: MEME_WARZ_ABI,
            functionName: 'getGame',
            args: [BigInt(numericId)],
          });
          return { onChain: onChainGame };
        } catch {
          // ignore error
        }
      }
      throw httpError(404, 'Game not found');
    }
    return game;
  }

  async getGameByCode(roomCode: string) {
    const game = await gameRepo.findByCode(roomCode);
    if (!game) {
      const numericCode = Number(roomCode);
      if (!isNaN(numericCode) && numericCode >= 100000 && numericCode <= 999999) {
        try {
          const onChainGame = await publicClient.readContract({
            address: MEME_WARZ_ADDRESS,
            abi: MEME_WARZ_ABI,
            functionName: 'getGameByCode',
            args: [numericCode],
          });
          return { onChain: onChainGame };
        } catch {
          // ignore error
        }
      }
      throw httpError(404, 'Room code not found');
    }
    return game;
  }

  async joinGame(roomCode: string, payload: PlayerPayload & { role?: 'contestant' | 'voter' }) {
    const game = await gameRepo.findByCode(roomCode);
    if (!game) {
      throw httpError(404, 'Room code not found');
    }
    if (game.status !== GameStatus.waiting) {
      throw httpError(409, 'This room is no longer accepting players');
    }
    if (game.participants.length >= game.maxPlayers) {
      throw httpError(409, 'This room is full');
    }

    const player = await gameRepo.upsertPlayer({
      name: payload.name || payload.walletAddress.slice(0, 6),
      walletAddress: payload.walletAddress,
    });
    await gameRepo.joinGame({
      gameId: game.id,
      playerId: player.id,
      role: payload.role ?? 'voter',
    });

    return this.getGame(game.id);
  }

  async setReady(gameId: string, playerId: string, isReady: boolean) {
    await this.getGame(gameId);
    await gameRepo.joinGame({ gameId, playerId, role: 'voter' });
    return gameRepo.update(gameId, {
      participants: {
        updateMany: {
          where: { playerId },
          data: { isReady },
        },
      },
    });
  }

  async startRound(gameId: string, data: { contestantIds: string[]; prompt?: string }) {
    const game = await gameRepo.findById(gameId);
    if (!game) throw httpError(404, 'Game not found');

    const uniqueContestants = Array.from(new Set(data.contestantIds));
    if (uniqueContestants.length !== 2) {
      throw httpError(400, 'Exactly two contestants are required for a MemeWarz round');
    }

    const participants = game.participants.filter((participant: any) =>
      uniqueContestants.includes(participant.playerId),
    );
    if (participants.length !== 2) {
      throw httpError(400, 'Both contestants must already be in the room');
    }

    await Promise.all(
      participants.map((participant: any) =>
        gameRepo.joinGame({
          gameId: game.id,
          playerId: participant.playerId,
          role: ParticipantRole.contestant,
        }),
      ),
    );

    const roundNumber = game.rounds.length + 1;
    const round = await gameRepo.createRound({
      game: { connect: { id: game.id } },
      roundNumber,
      prompt: data.prompt ?? game.prompt,
      status: RoundStatus.generating,
      memes: {
        create: participants.map((participant: any) => ({
          participant: { connect: { id: participant.id } },
          player: { connect: { id: participant.playerId } },
          status: MemeStatus.creating,
        })),
      },
    });

    await gameRepo.update(game.id, {
      status: GameStatus.generating,
      prompt: data.prompt ?? game.prompt,
    });

    return round;
  }

  async submitMeme(roundId: string, data: { playerId: string; imageUrl: string; caption?: string }) {
    const round = await gameRepo.findRound(roundId);
    if (!round) throw httpError(404, 'Round not found');

    const meme = round.memes.find((item: any) => item.playerId === data.playerId);
    if (!meme) throw httpError(404, 'Contestant meme slot not found');

    await gameRepo.update(round.gameId, { status: GameStatus.generating });

    return gameRepo.update(round.gameId, {
      rounds: {
        update: {
          where: { id: round.id },
          data: {
            memes: {
              update: {
                where: { id: meme.id },
                data: {
                  imageUrl: data.imageUrl,
                  caption: data.caption,
                  status: MemeStatus.ready,
                },
              },
            },
          },
        },
      },
    });
  }

  async castVote(roundId: string, data: { voterId: string; memeId: string }) {
    const round = await gameRepo.findRound(roundId);
    if (!round) throw httpError(404, 'Round not found');
    if (round.status !== RoundStatus.voting) {
      throw httpError(409, 'Voting is not currently active for this round');
    }

    const meme = round.memes.find((item: any) => item.id === data.memeId);
    if (!meme) throw httpError(404, 'Meme not found in this round');

    const participant = round.game.participants.find(
      (entry: any) => entry.playerId === data.voterId && entry.role === ParticipantRole.voter,
    );
    if (!participant) {
      throw httpError(403, 'Only assigned voters in this room can cast a vote');
    }

    return gameRepo.update(round.gameId, {
      rounds: {
        update: {
          where: { id: round.id },
          data: {
            votes: {
              create: {
                voter: { connect: { id: data.voterId } },
                meme: { connect: { id: data.memeId } },
              },
            },
          },
        },
      },
    });
  }

  async finishRound(roundId: string) {
    const round = await gameRepo.findRound(roundId);
    if (!round) throw httpError(404, 'Round not found');

    const memeVoteCounts = round.memes.map((meme: any) => ({
      memeId: meme.id,
      votes: meme.votes.length,
    }));

    const sorted = [...memeVoteCounts].sort((a, b) => b.votes - a.votes);
    const winnerMemeId = sorted[0]?.votes === sorted[1]?.votes ? null : sorted[0]?.memeId;

    await gameRepo.update(round.gameId, {
      status: GameStatus.finished,
      rounds: {
        update: {
          where: { id: round.id },
          data: {
            status: RoundStatus.finished,
            winnerMeme: winnerMemeId ? { connect: { id: winnerMemeId } } : undefined,
          },
        },
      },
    });

    return this.getGame(round.gameId);
  }

  private async createUniqueRoomCode(): Promise<string> {
    for (let attempts = 0; attempts < 10; attempts += 1) {
      const code = makeRoomCode();
      const existing = await gameRepo.findByCode(code);
      if (!existing) return code;
    }
    throw httpError(500, 'Failed to allocate unique room code');
  }
}

export default new GameService();
