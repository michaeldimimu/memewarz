import { GameStatus, MemeStatus, ParticipantRole, RoundStatus } from '@prisma/client';
import gameRepo from '../repos/gameRepository';

type PlayerPayload = {
  name: string;
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
  }) {
    const host = await gameRepo.upsertPlayer(data.host);
    const roomCode = await this.createUniqueRoomCode();

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
    if (!game) throw httpError(404, 'Game not found');
    return game;
  }

  async getGameByCode(roomCode: string) {
    const game = await gameRepo.findByCode(roomCode);
    if (!game) throw httpError(404, 'Room code not found');
    return game;
  }

  async joinGame(roomCode: string, payload: PlayerPayload & { role?: 'contestant' | 'voter' }) {
    const game = await this.getGameByCode(roomCode);
    if (game.status !== GameStatus.waiting) {
      throw httpError(409, 'This room is no longer accepting players');
    }
    if (game.participants.length >= game.maxPlayers) {
      throw httpError(409, 'This room is full');
    }

    const player = await gameRepo.upsertPlayer(payload);
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
    const game = await this.getGame(gameId);
    const uniqueContestants = Array.from(new Set(data.contestantIds));
    if (uniqueContestants.length !== 2) {
      throw httpError(400, 'Exactly two contestants are required for a MemeWarz round');
    }

    const participants = game.participants.filter((participant) =>
      uniqueContestants.includes(participant.playerId),
    );
    if (participants.length !== 2) {
      throw httpError(400, 'Both contestants must already be in the room');
    }

    await Promise.all(
      participants.map((participant) =>
        gameRepo.joinGame({
          gameId: game.id,
          playerId: participant.playerId,
          role: 'contestant',
        }),
      ),
    );

    const roundNumber = game.rounds.length + 1;
    const round = await gameRepo.createRound({
      game: { connect: { id: game.id } },
      roundNumber,
      status: RoundStatus.generating,
      prompt: data.prompt ?? game.prompt,
      memes: {
        create: participants.map((participant) => ({
          participant: { connect: { id: participant.id } },
          player: { connect: { id: participant.playerId } },
          status: MemeStatus.creating,
        })),
      },
    });

    await gameRepo.update(game.id, { status: GameStatus.generating });
    return round;
  }

  async submitMeme(
    roundId: string,
    data: { playerId: string; imageUrl: string; caption?: string; lockIn?: boolean },
  ) {
    const round = await gameRepo.findRound(roundId);
    if (!round) throw httpError(404, 'Round not found');

    const meme = round.memes.find((item) => item.playerId === data.playerId);
    if (!meme) throw httpError(403, 'This player is not competing in the round');

    const updated = await gameRepo.updateMeme(meme.id, {
      imageUrl: data.imageUrl,
      caption: data.caption,
      status: data.lockIn ? MemeStatus.locked : MemeStatus.ready,
    });

    const refreshed = await gameRepo.findRound(roundId);
    const allLocked = refreshed?.memes.every((item) => item.status === MemeStatus.locked);
    if (refreshed && allLocked) {
      const votingEndsAt = new Date(Date.now() + refreshed.game.roundDurationMs);
      await gameRepo.updateRound(roundId, { status: RoundStatus.voting, votingEndsAt });
      await gameRepo.update(refreshed.gameId, { status: GameStatus.voting });
    }

    return updated;
  }

  async castVote(roundId: string, data: PlayerPayload & { memeId: string }) {
    const round = await gameRepo.findRound(roundId);
    if (!round) throw httpError(404, 'Round not found');
    if (round.status !== RoundStatus.voting) {
      throw httpError(409, 'Voting is not open for this round');
    }
    if (!round.memes.some((meme) => meme.id === data.memeId)) {
      throw httpError(400, 'Vote target does not belong to this round');
    }

    const voter = await gameRepo.upsertPlayer({
      name: data.name,
      walletAddress: data.walletAddress,
    });
    await gameRepo.joinGame({ gameId: round.gameId, playerId: voter.id, role: 'voter' });

    return gameRepo.castVote({ roundId, memeId: data.memeId, voterId: voter.id });
  }

  async finishRound(roundId: string) {
    const round = await gameRepo.findRound(roundId);
    if (!round) throw httpError(404, 'Round not found');

    const winner = [...round.memes].sort((a, b) => b.votes.length - a.votes.length)[0];
    if (!winner) throw httpError(409, 'Round has no memes to score');

    await gameRepo.updateRound(roundId, {
      status: RoundStatus.finished,
      winnerMeme: { connect: { id: winner.id } },
    });
    return gameRepo.update(round.gameId, { status: GameStatus.finished });
  }

  private async createUniqueRoomCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const roomCode = makeRoomCode();
      const existing = await gameRepo.findByCode(roomCode);
      if (!existing) return roomCode;
    }
    throw httpError(500, 'Could not allocate a room code');
  }
}

export default new GameService();
