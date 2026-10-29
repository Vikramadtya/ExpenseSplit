import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Req } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('api/v1')
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

  @Patch('users/me')
  async updateMe(@Body() dto: UpdateProfileDto, @Req() req: any) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Get('users/:id')
  async getUser(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.usersService.findVisibleTo(req.user.id, id);
  }
}
