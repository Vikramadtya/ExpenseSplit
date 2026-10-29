/** Where receipt photos live. Local disk by default; an S3/R2 adapter can replace it. */
export abstract class ReceiptStorage {
  abstract save(key: string, data: Buffer): Promise<void>;
  abstract read(key: string): Promise<Buffer>;
}
