import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { SettlementsModule } from '../settlements/settlements.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DataTransferController } from './data-transfer.controller';
import { DataTransferRepository } from './data-transfer.repository';
import { DataTransferService } from './data-transfer.service';

@Module({
  imports: [DatabaseModule, ExpensesModule, SettlementsModule, UsersModule, WorkspacesModule],
  controllers: [DataTransferController],
  providers: [DataTransferService, DataTransferRepository],
})
export class DataTransferModule {}
