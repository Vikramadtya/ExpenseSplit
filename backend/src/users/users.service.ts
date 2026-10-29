import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IUsersRepositoryToken } from '../common/interfaces/repository.interfaces';
import { UpdateProfileDto } from './dto/update-profile.dto';
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
      user = await this.usersRepository.create({ ...data, isRegistered: true });
    } else if (!user.isRegistered) {
      // The user was a shadow user, now they are truly logging in. Claim the account.
      user = await this.usersRepository.update(user.id, {
        name: data.name,
        avatarUrl: data.avatarUrl,
        isRegistered: true,
      });
    }
    return user;
  }

  async createShadowUser(email: string, name?: string) {
    // Determine a name if not provided
    const defaultName = name || email.split('@')[0];
    return this.usersRepository.create({
      email,
      name: defaultName,
      isRegistered: false,
    });
  }

  async updateProfile(id: string, data: UpdateProfileDto) {
    return this.usersRepository.update(id, data);
  }

  async findByIds(ids: string[]) {
    return this.usersRepository.findByIds(ids);
  }

  /** A profile is visible to its owner and to people who share a workspace with them. */
  async findVisibleTo(requesterId: string, id: string) {
    if (!(await this.usersRepository.sharesWorkspace(requesterId, id))) {
      throw new NotFoundException('User not found');
    }
    return this.usersRepository.findById(id);
  }
}
