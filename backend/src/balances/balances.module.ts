import { IBalancesRepositoryToken } from '../common/interfaces/repository.interfaces';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';
import { BalancesRepository } from './balances.repository';

@Module({
  imports: [DatabaseModule, WorkspacesModule],
  controllers: [BalancesController],
  providers: [BalancesService, { provide: IBalancesRepositoryToken, useClass: BalancesRepository }],
  exports: [BalancesService],
})
export class BalancesModule {}
