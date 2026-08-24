import { ISettlementsRepositoryToken } from '../common/interfaces/repository.interfaces';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SettlementsRepository } from './settlements.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [SettlementsController],
  providers: [
    SettlementsService,
    { provide: ISettlementsRepositoryToken, useClass: SettlementsRepository },
  ],
  exports: [SettlementsService],
})
export class SettlementsModule {}
