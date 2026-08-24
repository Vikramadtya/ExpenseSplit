import { IExpensesRepositoryToken } from '../common/interfaces/repository.interfaces';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpensesRepository } from './expenses.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, { provide: IExpensesRepositoryToken, useClass: ExpensesRepository }],
  exports: [ExpensesService],
})
export class ExpensesModule {}
