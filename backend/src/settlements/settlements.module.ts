import { ISettlementsRepositoryToken } from '../common/interfaces/repository.interfaces';
import { Module } from '@nestjs/common';
import { BalancesModule } from '../balances/balances.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DatabaseModule } from '../database/database.module';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SettlementsRepository } from './settlements.repository';

@Module({
  imports: [DatabaseModule, BalancesModule, WorkspacesModule],
  controllers: [SettlementsController],
  providers: [
    SettlementsService,
    { provide: ISettlementsRepositoryToken, useClass: SettlementsRepository },
  ],
  exports: [SettlementsService],
})
export class SettlementsModule {}
