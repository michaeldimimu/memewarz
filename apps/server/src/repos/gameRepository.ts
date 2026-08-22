import db from '../config/db';
import { Game } from '@prisma/client';

export class GameRepository {
  async create(data: Partial<Game>) {
    return db.game.create({ data: data as any });
  }

  async findById(id: number) {
    return db.game.findUnique({ where: { id }, include: { host: true, playerGames: { include: { player: true } } } });
  }

  async findAll() {
    return db.game.findMany();
  }

  async update(id: number, data: Partial<Game>) {
    return db.game.update({ where: { id }, data: data as any });
  }

  async delete(id: number) {
    return db.game.delete({ where: { id } });
  }

  async addPlayer(gameId: number, playerId: number) {
    return db.playerGame.create({ data: { gameId, playerId } });
  }
}

export default new GameRepository();
