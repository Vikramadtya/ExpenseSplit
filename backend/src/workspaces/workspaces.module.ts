import { Module, forwardRef } from '@nestjs/common';
import { BalancesModule } from '../balances/balances.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesRepository } from './workspaces.repository';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';

@Module({
  imports: [DatabaseModule, UsersModule, forwardRef(() => BalancesModule)],
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    { provide: IWorkspacesRepositoryToken, useClass: WorkspacesRepository },
  ],
  exports: [WorkspacesService, IWorkspacesRepositoryToken],
})
export class WorkspacesModule {}
