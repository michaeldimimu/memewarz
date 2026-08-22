import hostRepo from '../repos/hostRepository';

export class HostService {
  async createHost(data: { host_name: string; wallet_balance?: number }) {
    return hostRepo.create(data);
  }

  async getHost(id: number) {
    return hostRepo.findById(id);
  }
}

export default new HostService();
