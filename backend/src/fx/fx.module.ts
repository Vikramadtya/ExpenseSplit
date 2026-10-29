import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FrankfurterProvider } from './frankfurter.provider';
import { FxController } from './fx.controller';
import { FxRateProvider } from './fx.provider';
import { FxRepository } from './fx.repository';
import { FxService } from './fx.service';

@Module({
  imports: [DatabaseModule],
  controllers: [FxController],
  providers: [FxService, FxRepository, { provide: FxRateProvider, useClass: FrankfurterProvider }],
  exports: [FxService],
})
export class FxModule {}
