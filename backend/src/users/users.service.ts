import { Injectable, Inject } from '@nestjs/common';
import { IUsersRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IUsersRepository } from '../common/interfaces/repository.interfaces';

@Injectable()
export class UsersService {
  constructor(
    @Inject(IUsersRepositoryToken)
    private readonly usersRepository: IUsersRepository,
  ) {}

  async findById(id: string): Promise<any> {
    return this.usersRepository.findById(id);
  }

  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async findOrCreate(data: { email: string; name: string; avatarUrl?: string }) {
    let user = await this.usersRepository.findByEmail(data.email);
    if (!user) {
      user = await this.usersRepository.create(data);
    }
    return user;
  }

  async findAll() {
    return this.usersRepository.findAll();
  }
}
