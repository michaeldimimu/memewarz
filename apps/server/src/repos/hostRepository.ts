import db from '../config/db';

export class HostRepository {
  create(data: { name: string; walletAddress: string }) {
    return db.player.upsert({
      where: { walletAddress: data.walletAddress },
      update: { name: data.name },
      create: data,
    });
  }

  findById(id: string) {
    return db.player.findUnique({
      where: { id },
      include: { hostedGames: true },
    });
  }

  findAll() {
    return db.player.findMany({
      where: { hostedGames: { some: {} } },
      include: { hostedGames: true },
    });
  }
}

export default new HostRepository();
