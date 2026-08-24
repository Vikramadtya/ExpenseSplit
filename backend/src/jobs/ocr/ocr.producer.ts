import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class OcrProducer {
  constructor(@InjectQueue('ocr-queue') private readonly ocrQueue: Queue) {}

  async addReceiptExtractionJob(receiptId: string, imageUrl: string) {
    const job = await this.ocrQueue.add('extract-receipt', {
      receiptId,
      imageUrl,
    });
    return job.id;
  }
}
