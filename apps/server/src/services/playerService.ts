import playerRepo from '../repos/playerRepository';

export class PlayerService {
  createPlayer(payload: { name: string; walletAddress: string }) {
    return playerRepo.upsertByWallet(payload);
  }

  getPlayer(id: string) {
    return playerRepo.findById(id);
  }

  listPlayers() {
    return playerRepo.findAll();
  }
}

export default new PlayerService();
