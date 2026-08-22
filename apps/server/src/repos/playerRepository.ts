import db from '../config/db';
import { Player, PlayerType } from '@prisma/client';

export class PlayerRepository {
  async create(data: { player_name: string; player_type: PlayerType; wallet_id: string; wallet_balance?: number; }): Promise<Player> {
    return db.player.create({ data });
  }

  async findById(id: number) {
    return db.player.findUnique({ where: { id } });
  }

  async findAll() {
    return db.player.findMany();
  }

  async update(id: number, data: Partial<Player>) {
    return db.player.update({ where: { id }, data });
  }

  async delete(id: number) {
    return db.player.delete({ where: { id } });
  }
}

export default new PlayerRepository();
