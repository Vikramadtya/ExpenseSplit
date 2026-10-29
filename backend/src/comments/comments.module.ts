import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CommentsController } from './comments.controller';
import { CommentsRepository } from './comments.repository';
import { CommentsService } from './comments.service';

@Module({
  imports: [DatabaseModule, ExpensesModule, WorkspacesModule],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsRepository],
})
export class CommentsModule {}
