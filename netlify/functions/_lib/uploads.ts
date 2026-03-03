import { getStore } from '@netlify/blobs';
import { fail } from './http';

const STORE_NAME = 'book-files';

const uploadsStore = () => getStore(STORE_NAME);

const chunkKey = (uploadId: string, chunkIndex: number): string => `${uploadId}/chunks/${chunkIndex}`;
const metadataKey = (uploadId: string): string => `${uploadId}/metadata`;

export interface UploadMetadata {
  sizeBytes: number;
  createdAt: number;
}

export const saveUploadMetadata = async (uploadId: string, metadata: UploadMetadata): Promise<void> => {
  await uploadsStore().setJSON(metadataKey(uploadId), metadata);
};

export const getUploadMetadata = async (uploadId: string): Promise<UploadMetadata | null> => {
  return uploadsStore().get(metadataKey(uploadId), { type: 'json' }) as Promise<UploadMetadata | null>;
};

export const saveUploadChunk = async (uploadId: string, chunkIndex: number, bytes: Uint8Array): Promise<void> => {
  await uploadsStore().set(chunkKey(uploadId, chunkIndex), bytes);
};

export const getUploadChunk = async (uploadId: string, chunkIndex: number): Promise<Uint8Array | null> => {
  const data = await uploadsStore().get(chunkKey(uploadId, chunkIndex), { type: 'arrayBuffer' });
  if (!data) return null;
  return new Uint8Array(data);
};

export const deleteUploadTempData = async (uploadId: string, chunkCount: number): Promise<void> => {
  const store = uploadsStore();
  const deletions: Promise<void>[] = [store.delete(metadataKey(uploadId))];
  for (let i = 0; i < chunkCount; i += 1) {
    deletions.push(store.delete(chunkKey(uploadId, i)));
  }
  await Promise.all(deletions);
};

export const saveBookChunk = async (bookId: string, chunkIndex: number, bytes: Uint8Array): Promise<void> => {
  await uploadsStore().set(`books/${bookId}/chunks/${chunkIndex}`, bytes);
};

export const getBookChunk = async (bookId: string, chunkIndex: number): Promise<Uint8Array | null> => {
  const data = await uploadsStore().get(`books/${bookId}/chunks/${chunkIndex}`, { type: 'arrayBuffer' });
  if (!data) return null;
  return new Uint8Array(data);
};

export const copyUploadToBook = async (uploadId: string, bookId: string, chunkCount: number): Promise<void> => {
  for (let i = 0; i < chunkCount; i += 1) {
    const chunk = await getUploadChunk(uploadId, i);
    if (!chunk) fail(400, `Missing uploaded chunk ${i}.`);
    await saveBookChunk(bookId, i, chunk);
  }
};

export const deleteBookChunks = async (bookId: string, chunkCount: number): Promise<void> => {
  const store = uploadsStore();
  const deletions: Promise<void>[] = [];
  for (let i = 0; i < chunkCount; i += 1) {
    deletions.push(store.delete(`books/${bookId}/chunks/${i}`));
  }
  await Promise.all(deletions);
};
