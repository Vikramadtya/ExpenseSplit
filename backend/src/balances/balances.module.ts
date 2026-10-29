import { IBalancesRepositoryToken } from '../common/interfaces/repository.interfaces';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { FxModule } from '../fx/fx.module';
import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';
import { BalancesRepository } from './balances.repository';

@Module({
  imports: [DatabaseModule, UsersModule, FxModule],
  controllers: [BalancesController],
  providers: [BalancesService, { provide: IBalancesRepositoryToken, useClass: BalancesRepository }],
  exports: [BalancesService],
})
export class BalancesModule {}
