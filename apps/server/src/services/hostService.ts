import hostRepo from '../repos/hostRepository';

export class HostService {
  createHost(data: { name: string; walletAddress: string }) {
    return hostRepo.create(data);
  }

  getHost(id: string) {
    return hostRepo.findById(id);
  }
}

export default new HostService();
