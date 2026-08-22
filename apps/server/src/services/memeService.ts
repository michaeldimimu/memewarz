import memeRepo from '../repos/memeRepository';

export class MemeService {
  createMeme(data: Parameters<typeof memeRepo.create>[0]) {
    return memeRepo.create(data);
  }

  listMemes() {
    return memeRepo.findAll();
  }
}

export default new MemeService();
