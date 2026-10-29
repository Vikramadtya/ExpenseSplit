import { ReceiptData } from './receipt-data';

export type ReceiptMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** Reads a receipt photo. Swap the implementation to change vendor or model. */
export abstract class OcrProvider {
  abstract readonly available: boolean;
  abstract extract(image: Buffer, mime: ReceiptMime): Promise<ReceiptData>;
}
