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

  findByOnChainId(onChainId: number | bigint) {
    return db.game.findFirst({
      where: {
        OR: [
          { roomCode: String(onChainId) },
          { id: String(onChainId) }
        ]
      },
      include: gameInclude,
    });
  }

  findAll() {
    return db.game.findMany({
      include: {
        host: true,
        participants: {
          include: {
            player: true,
          }
        },
        rounds: {
          include: {
            memes: true,
            votes: true,
          }
        },
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
      where: { walletAddress: data.walletAddress.toLowerCase() },
      update: { name: data.name },
      create: { name: data.name, walletAddress: data.walletAddress.toLowerCase() },
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
        game: {
          include: {
            participants: true,
          },
        },
        memes: { include: { player: true, votes: true } },
        votes: true,
      },
    });
  }

  findActiveVotingRounds() {
    return db.round.findMany({
      where: {
        status: 'voting',
      },
      include: {
        game: true,
        memes: true,
      }
    });
  }
}

export default new GameRepository();
