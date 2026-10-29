import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { RecurringController } from './recurring.controller';
import { RecurringRepository } from './recurring.repository';
import { RecurringScheduler } from './recurring.scheduler';
import { RecurringService } from './recurring.service';

@Module({
  imports: [DatabaseModule, ExpensesModule, WorkspacesModule],
  controllers: [RecurringController],
  providers: [RecurringService, RecurringRepository, RecurringScheduler],
  exports: [RecurringService],
})
export class RecurringModule {}
