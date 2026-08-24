import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesRepository } from './workspaces.repository';
import { DatabaseModule } from '../database/database.module';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';

@Module({
  imports: [DatabaseModule],
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    { provide: IWorkspacesRepositoryToken, useClass: WorkspacesRepository },
  ],
  exports: [WorkspacesService, IWorkspacesRepositoryToken],
})
export class WorkspacesModule {}
