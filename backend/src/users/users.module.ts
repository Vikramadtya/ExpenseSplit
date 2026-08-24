import { IUsersRepositoryToken } from '../common/interfaces/repository.interfaces';
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService, { provide: IUsersRepositoryToken, useClass: UsersRepository }],
  exports: [UsersService, IUsersRepositoryToken],
})
export class UsersModule {}
