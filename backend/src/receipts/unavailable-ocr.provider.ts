import { Injectable } from '@nestjs/common';
import { OcrProvider } from './ocr.provider';
import { ReceiptData } from './receipt-data';

/** Used when no scanner is configured: the user types the items in instead. */
@Injectable()
export class UnavailableOcrProvider extends OcrProvider {
  readonly available = false;

  async extract(): Promise<ReceiptData> {
    throw new Error('Receipt scanning is not set up on this server. Enter the items by hand.');
  }
}
