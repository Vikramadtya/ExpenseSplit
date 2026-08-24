import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OcrProducer } from './ocr.producer';
import { OcrWorker } from './ocr.worker';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ocr-queue',
    }),
  ],
  providers: [OcrProducer, OcrWorker],
  exports: [OcrProducer],
})
export class OcrModule {}
