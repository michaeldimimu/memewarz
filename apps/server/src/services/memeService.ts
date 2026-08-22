import memeRepo from '../repos/memeRepository';

export class MemeService {
  async createMeme(data: { meme_url: string; caption?: string }) {
    return memeRepo.create(data);
  }

  async listMemes() {
    return memeRepo.findAll();
  }
}

export default new MemeService();
