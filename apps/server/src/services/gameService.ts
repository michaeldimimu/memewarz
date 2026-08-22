import gameRepo from '../repos/gameRepository';

export class GameService {
  async createGame(data: any) {
    return gameRepo.create(data);
  }

  async getGame(id: number) {
    return gameRepo.findById(id);
  }

  async addPlayerToGame(gameId: number, playerId: number) {
    return gameRepo.addPlayer(gameId, playerId);
  }
}

export default new GameService();
