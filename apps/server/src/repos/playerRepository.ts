import { Prisma } from '@prisma/client';
import db from '../config/db';

export class PlayerRepository {
  create(data: Prisma.PlayerCreateInput) {
    return db.player.create({ data });
  }

  upsertByWallet(data: { name: string; walletAddress: string }) {
    return db.player.upsert({
      where: { walletAddress: data.walletAddress },
      update: { name: data.name },
      create: data,
    });
  }

  findById(id: string) {
    return db.player.findUnique({ where: { id } });
  }

  findByWallet(walletAddress: string) {
    return db.player.findUnique({ where: { walletAddress } });
  }

  findAll() {
    return db.player.findMany({ orderBy: { createdAt: 'desc' } });
  }

  update(id: string, data: Prisma.PlayerUpdateInput) {
    return db.player.update({ where: { id }, data });
  }

  delete(id: string) {
    return db.player.delete({ where: { id } });
  }
}

export default new PlayerRepository();
