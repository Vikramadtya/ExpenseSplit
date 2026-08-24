import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IUsersRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IUsersRepository } from '../common/interfaces/repository.interfaces';

@Injectable()
export class AuthService {
  constructor(
    @Inject(IUsersRepositoryToken)
    private readonly usersRepository: IUsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async validateOAuthLogin(profile: any): Promise<string> {
    const { id: googleId, emails, name, photos } = profile;
    const email = emails[0].value;
    const displayName = `${name.givenName} ${name.familyName}`.trim();
    const avatarUrl = photos[0]?.value;

    let user = await this.usersRepository.findByEmail(email);

    if (!user) {
      user = await this.usersRepository.create({
        email,
        name: displayName,
        avatarUrl,
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };

    return this.jwtService.sign(payload);
  }
}
