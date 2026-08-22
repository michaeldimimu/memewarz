import { Prisma } from '@prisma/client';
import db from '../config/db';

const gameInclude = {
  host: true,
  participants: {
    include: {
      player: true,
      memes: true,
    },
    orderBy: { joinedAt: 'asc' as const },
  },
  rounds: {
    include: {
      memes: {
        include: {
          player: true,
          votes: true,
        },
      },
      votes: true,
      winnerMeme: true,
    },
    orderBy: { roundNumber: 'asc' as const },
  },
} satisfies Prisma.GameInclude;

export class GameRepository {
  create(data: Prisma.GameCreateInput) {
    return db.game.create({ data, include: gameInclude });
  }

  findById(id: string) {
    return db.game.findUnique({ where: { id }, include: gameInclude });
  }

  findByCode(roomCode: string) {
    return db.game.findUnique({ where: { roomCode }, include: gameInclude });
  }

  findAll() {
    return db.game.findMany({
      include: {
        host: true,
        _count: { select: { participants: true, rounds: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, data: Prisma.GameUpdateInput) {
    return db.game.update({ where: { id }, data, include: gameInclude });
  }

  delete(id: string) {
    return db.game.delete({ where: { id } });
  }

  upsertPlayer(data: { name: string; walletAddress: string }) {
    return db.player.upsert({
      where: { walletAddress: data.walletAddress },
      update: { name: data.name },
      create: { name: data.name, walletAddress: data.walletAddress },
    });
  }

  joinGame(data: {
    gameId: string;
    playerId: string;
    role: 'host' | 'contestant' | 'voter';
  }) {
    return db.gameParticipant.upsert({
      where: {
        gameId_playerId: {
          gameId: data.gameId,
          playerId: data.playerId,
        },
      },
      update: { role: data.role },
      create: data,
      include: { player: true },
    });
  }

  createRound(data: Prisma.RoundCreateInput) {
    return db.round.create({
      data,
      include: {
        memes: { include: { player: true, votes: true } },
        votes: true,
      },
    });
  }

  findRound(id: string) {
    return db.round.findUnique({
      where: { id },
      include: {
        game: true,
        memes: { include: { player: true, votes: true } },
        votes: true,
      },
    });
  }

  updateRound(id: string, data: Prisma.RoundUpdateInput) {
    return db.round.update({
      where: { id },
      data,
      include: {
        memes: { include: { player: true, votes: true } },
        votes: true,
        winnerMeme: true,
      },
    });
  }

  createMeme(data: Prisma.MemeCreateInput) {
    return db.meme.create({
      data,
      include: { player: true, votes: true },
    });
  }

  updateMeme(id: string, data: Prisma.MemeUpdateInput) {
    return db.meme.update({
      where: { id },
      data,
      include: { player: true, votes: true },
    });
  }

  castVote(data: { roundId: string; memeId: string; voterId: string }) {
    return db.vote.upsert({
      where: {
        roundId_voterId: {
          roundId: data.roundId,
          voterId: data.voterId,
        },
      },
      update: { memeId: data.memeId },
      create: data,
      include: { meme: true, voter: true },
    });
  }
}

export default new GameRepository();
