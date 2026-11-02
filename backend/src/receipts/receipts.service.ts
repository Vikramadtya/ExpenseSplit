import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { suggestCategory } from '../common/categories';
import { Currency } from '../common/money/currency';
import { EventBus } from '../common/events/event-bus';
import { sniffImageType } from './image-type';
import { OcrProvider } from './ocr.provider';
import { ReceiptData } from './receipt-data';
import { ReceiptStorage } from './receipt-storage';
import { ReceiptRow, ReceiptsRepository } from './receipts.repository';

/** Cleans up what the scanner returned and adds what the app can work out itself. */
export function normalizeReceipt(data: ReceiptData) {
  // Only trust a currency code that really is one; otherwise keep three decimals so no
  // currency's precision is lost before the user picks the right one.
  const currency = Currency.isValid(data.currency) ? Currency.of(data.currency) : null;
  const round = (v: number) => (currency ? currency.round(v) : Math.round(v * 1000) / 1000);

  const items = data.items
    .map((i) => ({ name: i.name.trim().slice(0, 200), amount: round(i.amount) }))
    .filter((i) => i.name && Number.isFinite(i.amount) && i.amount > 0);
  const tax = Math.max(round(data.tax ?? 0), 0);
  const tip = Math.max(round(data.tip ?? 0), 0);
  const computed = round(items.reduce((s, i) => s + i.amount, 0) + tax + tip);
  const total = data.total === null ? computed : round(data.total);

  return {
    merchant: data.merchant?.trim() || null,
    date: data.date,
    currency: currency?.code ?? null,
    items,
    tax,
    tip,
    total,
    // The scan doesn't add up: the user should check the lines before saving.
    // Off by at least one minor unit of the currency (a cent, a yen, a fils).
    mismatch: Math.abs(computed - total) >= 1 / (currency?.factor ?? 100),
    suggestedCategory: suggestCategory(data.merchant, ...items.map((i) => i.name)),
  };
}

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly repository: ReceiptsRepository,
    private readonly storage: ReceiptStorage,
    private readonly ocr: OcrProvider,
    private readonly events: EventBus,
  ) {}

  /** Stores the photo and starts scanning in the background; the caller polls (or listens). */
  async upload(workspaceId: string, userId: string, body: unknown) {
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new UnsupportedMediaTypeException('Send the receipt as a JPEG, PNG or WebP image');
    }
    const mime = sniffImageType(body);
    if (!mime) throw new BadRequestException('That file is not a JPEG, PNG or WebP image');

    const id = randomUUID();
    const storageKey = `${workspaceId}/${id}`;
    await this.storage.save(storageKey, body);
    const receipt = await this.repository.create({
      id,
      workspaceId,
      uploadedById: userId,
      storageKey,
      mimeType: mime,
      sizeBytes: body.length,
    });

    setImmediate(() => void this.scan(receipt, body, mime));
    return this.present(receipt);
  }

  async get(workspaceId: string, id: string) {
    return this.present(await this.find(workspaceId, id));
  }

  async image(workspaceId: string, id: string) {
    const receipt = await this.find(workspaceId, id);
    return { mime: receipt.mimeType, bytes: await this.storage.read(receipt.storageKey) };
  }

  private async find(workspaceId: string, id: string): Promise<ReceiptRow> {
    const receipt = await this.repository.findById(id);
    if (!receipt || receipt.workspaceId !== workspaceId)
      throw new NotFoundException('Receipt not found');
    return receipt;
  }

  private async scan(
    receipt: ReceiptRow,
    bytes: Buffer,
    mime: ReturnType<typeof sniffImageType> & string,
  ) {
    try {
      const result = normalizeReceipt(await this.ocr.extract(bytes, mime));
      await this.repository.finish(receipt.id, { status: 'DONE', result });
    } catch (err) {
      this.logger.warn(`Scan of receipt ${receipt.id} failed: ${err}`);
      await this.repository.finish(receipt.id, {
        status: 'FAILED',
        error: err instanceof Error ? err.message : 'Scan failed',
      });
    }
    this.events.publish({
      workspaceId: receipt.workspaceId,
      type: 'receipt.processed',
      entityId: receipt.id,
    });
  }

  private present(r: ReceiptRow) {
    return { id: r.id, status: r.status, result: r.result, error: r.error, createdAt: r.createdAt };
  }
}
