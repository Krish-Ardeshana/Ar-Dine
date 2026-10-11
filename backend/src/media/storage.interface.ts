export class UploadedFileDto {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}


export interface StorageUploadResult {
  url: string;
  storageKey: string;
  format: string;
  fileSizeBytes: number;
}

export interface IStorageProvider {
  readonly name: string;
  isAvailable(): boolean;
  uploadFile(
    file: UploadedFileDto,
    storagePath: string,
  ): Promise<StorageUploadResult>;
  deleteFile(storageKey: string): Promise<void>;
}
