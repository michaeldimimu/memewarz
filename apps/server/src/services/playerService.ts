import playerRepo from '../repos/playerRepository';

export class PlayerService {
  async createPlayer(payload: { player_name: string; player_type: any; wallet_id: string }) {
    return playerRepo.create(payload as any);
  }

  async getPlayer(id: number) {
    return playerRepo.findById(id);
  }

  async listPlayers() {
    return playerRepo.findAll();
  }
}

export default new PlayerService();
