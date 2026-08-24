import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('ocr-queue')
export class OcrWorker extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`Processing job ${job.id} of type ${job.name} with data`, job.data);

    // TODO: Implement actual OCR extraction logic here
    // e.g., call external OCR service (Google Vision, AWS Textract, etc.)

    // Simulating work
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      success: true,
      extractedData: {
        total: 120.5,
        merchant: 'Supermarket Inc',
        date: new Date().toISOString(),
      },
    };
  }
}
