import { Prisma } from '@prisma/client';
import db from '../config/db';

export class MemeRepository {
  create(data: Prisma.MemeCreateInput) {
    return db.meme.create({ data });
  }

  findById(id: string) {
    return db.meme.findUnique({ where: { id }, include: { player: true, votes: true } });
  }

  findAll() {
    return db.meme.findMany({
      include: { player: true, votes: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  delete(id: string) {
    return db.meme.delete({ where: { id } });
  }
}

export default new MemeRepository();
