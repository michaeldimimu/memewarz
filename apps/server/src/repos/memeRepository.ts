import db from '../config/db';

export class MemeRepository {
  async create(data: { meme_url: string; caption?: string }) {
    return db.meme.create({ data });
  }

  async findById(id: number) {
    return db.meme.findUnique({ where: { id } });
  }

  async findAll() {
    return db.meme.findMany();
  }

  async delete(id: number) {
    return db.meme.delete({ where: { id } });
  }
}

export default new MemeRepository();
