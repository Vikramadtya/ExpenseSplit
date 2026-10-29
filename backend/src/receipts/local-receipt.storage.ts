import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { ReceiptStorage } from './receipt-storage';

@Injectable()
export class LocalReceiptStorage extends ReceiptStorage {
  constructor(private readonly root: string) {
    super();
  }

  async save(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  /** Keys are server-generated, but never let one escape the storage folder anyway. */
  private pathFor(key: string): string {
    const root = resolve(this.root);
    const path = resolve(join(root, key));
    if (!path.startsWith(root + sep)) throw new Error('Invalid storage key');
    return path;
  }
}
