import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { FilePutInput, FileStorageProvider } from './file-storage.provider';
import { isValidKey } from './key.utils';

/**
 * Local disk implementation (BR-WS5). Writes under `data/submittals/...`
 * relative to the backend working directory, with path-traversal prevention.
 */
@Injectable()
export class LocalDiskStorageProvider implements FileStorageProvider {
  private readonly root = resolve(process.cwd(), 'data');

  async put(input: FilePutInput): Promise<void> {
    const full = this.resolveKey(input.key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, input.bytes);
  }

  async get(key: string): Promise<Buffer> {
    const full = this.resolveKey(key);
    return readFile(full);
  }

  async delete(key: string): Promise<void> {
    const full = this.resolveKey(key);
    await rm(full, { force: true });
  }

  /** Validate the key shape and confine the resolved path under the data root. */
  private resolveKey(key: string): string {
    if (!isValidKey(key)) {
      throw new InternalServerErrorException('Invalid storage key');
    }
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new InternalServerErrorException('Path traversal detected');
    }
    return join(this.root, key);
  }
}
