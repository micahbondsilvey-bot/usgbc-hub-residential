/** File storage seam (BR-WS5). LocalDiskStorageProvider implements it now; S3 later. */
export interface FilePutInput {
  key: string;
  bytes: Buffer;
  contentType: string;
  contentLength: number;
}

export interface FileStorageProvider {
  put(input: FilePutInput): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** DI token for the provider. */
export const FILE_STORAGE_PROVIDER = Symbol('FILE_STORAGE_PROVIDER');
