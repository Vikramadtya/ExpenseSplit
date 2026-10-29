import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AccountController } from './account.controller';
import { AccountRepository } from './account.repository';
import { AccountService } from './account.service';

@Module({
  imports: [DatabaseModule, WorkspacesModule],
  controllers: [AccountController],
  providers: [AccountService, AccountRepository],
})
export class AccountModule {}
