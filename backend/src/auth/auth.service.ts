import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { IUsersRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IUsersRepository } from '../common/interfaces/repository.interfaces';
import { RefreshTokensRepository } from './refresh-tokens.repository';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A token reused this soon after rotation is a racing tab, not a theft. */
const REUSE_GRACE_MS = 10_000;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @Inject(IUsersRepositoryToken)
    private readonly usersRepository: IUsersRepository,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly jwtService: JwtService,
  ) {}

  async validateOAuthLogin(profile: any): Promise<TokenPair> {
    const { emails, name, photos } = profile;
    const email = emails[0].value;
    const displayName = `${name.givenName} ${name.familyName}`.trim();
    const avatarUrl = photos[0]?.value;

    const user =
      (await this.usersRepository.findByEmail(email)) ??
      (await this.usersRepository.create({ email, name: displayName, avatarUrl }));

    return this.issue(user, randomUUID());
  }

  /** Trades a refresh token for a new pair. Each refresh token works exactly once. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const stored = await this.refreshTokens.findByHash(hash(refreshToken));
    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!(await this.refreshTokens.consume(stored.id))) {
      // Already used. Right after rotation it's a racing tab; later it suggests the token
      // leaked, so the whole sign-in chain is revoked and the user must sign in again.
      const age = Date.now() - (stored.revokedAt?.getTime() ?? 0);
      if (!stored.revokedAt || age > REUSE_GRACE_MS) {
        await this.refreshTokens.revokeFamily(stored.familyId);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersRepository.findById(stored.userId);
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    return this.issue(user, stored.familyId);
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByHash(hash(refreshToken));
    if (stored) await this.refreshTokens.revokeFamily(stored.familyId);
  }

  private async issue(
    user: { id: string; email: string; name: string; avatarUrl?: string | null },
    familyId: string,
  ): Promise<TokenPair> {
    const refreshToken = randomBytes(32).toString('base64url');
    await this.refreshTokens.create({
      userId: user.id,
      familyId,
      tokenHash: hash(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });
    return { accessToken, refreshToken };
  }
}
