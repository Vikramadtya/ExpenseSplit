import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { DatabaseModule } from '../database/database.module';
import { ClaudeOcrProvider } from './claude-ocr.provider';
import { LocalReceiptStorage } from './local-receipt.storage';
import { OcrProvider } from './ocr.provider';
import { ReceiptStorage } from './receipt-storage';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsRepository } from './receipts.repository';
import { ReceiptsService } from './receipts.service';
import { UnavailableOcrProvider } from './unavailable-ocr.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [ReceiptsController],
  providers: [
    ReceiptsService,
    ReceiptsRepository,
    {
      provide: ReceiptStorage,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new LocalReceiptStorage(
          config.get<string>('RECEIPTS_DIR') ?? join(process.cwd(), 'data', 'receipts'),
        ),
    },
    {
      // Scanning is on only when an Anthropic key is configured; OCR_MODEL overrides the model.
      provide: OcrProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService): OcrProvider => {
        const apiKey = config.get<string>('ANTHROPIC_API_KEY');
        return apiKey
          ? new ClaudeOcrProvider(apiKey, config.get<string>('OCR_MODEL') ?? 'claude-opus-5-5')
          : new UnavailableOcrProvider();
      },
    },
  ],
})
export class ReceiptsModule {}
