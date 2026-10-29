import { Module } from '@nestjs/common';
import { IExpensesRepositoryToken } from '../common/interfaces/repository.interfaces';
import { DatabaseModule } from '../database/database.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpensesRepository } from './expenses.repository';
import { SPLIT_STRATEGIES } from './strategies/split.strategy';
import { SplitStrategyRegistry } from './strategies/split-strategy.registry';
import { EqualSplitStrategy } from './strategies/equal-split.strategy';
import { ExactSplitStrategy } from './strategies/exact-split.strategy';
import { PercentageSplitStrategy } from './strategies/percentage-split.strategy';
import { SharesSplitStrategy } from './strategies/shares-split.strategy';
import { ItemizedSplitStrategy } from './strategies/itemized-split.strategy';

@Module({
  imports: [DatabaseModule, WorkspacesModule, BudgetsModule],
  controllers: [ExpensesController],
  providers: [
    ExpensesService,
    SplitStrategyRegistry,
    EqualSplitStrategy,
    ExactSplitStrategy,
    PercentageSplitStrategy,
    SharesSplitStrategy,
    ItemizedSplitStrategy,
    {
      provide: SPLIT_STRATEGIES,
      inject: [
        EqualSplitStrategy,
        ExactSplitStrategy,
        PercentageSplitStrategy,
        SharesSplitStrategy,
        ItemizedSplitStrategy,
      ],
      useFactory: (...strategies: unknown[]) => strategies,
    },
    { provide: IExpensesRepositoryToken, useClass: ExpensesRepository },
  ],
  exports: [ExpensesService],
})
export class ExpensesModule {}
