import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users/me')
  async getMe(@Req() req: any) {
    // req.user is injected by JwtAuthGuard
    // Let's see if the database has them, otherwise return the JWT payload info directly
    try {
      const user = await this.usersService.findById(req.user.id);
      return user || req.user;
    } catch (e) {
      return req.user;
    }
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
