import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { InvitesController } from './invites.controller';
import { InvitesRepository } from './invites.repository';
import { InvitesService } from './invites.service';

@Module({
  imports: [DatabaseModule, UsersModule, WorkspacesModule],
  controllers: [InvitesController],
  providers: [InvitesService, InvitesRepository],
})
export class InvitesModule {}
