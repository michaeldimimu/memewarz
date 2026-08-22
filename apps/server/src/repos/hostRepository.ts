import db from '../config/db';

export class HostRepository {
  async create(data: { host_name: string; wallet_balance?: number }) {
    return db.host.create({ data });
  }

  async findById(id: number) {
    return db.host.findUnique({ where: { id } });
  }

  async findAll() {
    return db.host.findMany();
  }

  async update(id: number, data: any) {
    return db.host.update({ where: { id }, data });
  }

  async delete(id: number) {
    return db.host.delete({ where: { id } });
  }
}

export default new HostRepository();
