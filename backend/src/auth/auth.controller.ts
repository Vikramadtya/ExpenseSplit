import { Body, Controller, Get, HttpCode, Post, UseGuards, Req, Res } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './decorators';

// Sign-in is the brute-force target: far stricter than the global limit.
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class RefreshTokenDto extends createZodDto(
  z.object({ refreshToken: z.string().min(1).max(200) }),
) {}

@Public()
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: any) {
    // Guard redirects
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    // Extract profile from req.user (placed by GoogleStrategy)
    const { accessToken, refreshToken } = await this.authService.validateOAuthLogin(req.user);

    // Redirect to frontend with the token in the URL fragment, which browsers never send
    // to servers, proxies or Referer headers (unlike a query string).
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    res.redirect(
      `${frontendUrl}/auth/callback#token=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken)}`,
    );
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() body: RefreshTokenDto) {
    await this.authService.logout(body.refreshToken);
  }
}
