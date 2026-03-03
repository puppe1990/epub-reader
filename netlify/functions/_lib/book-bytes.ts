import { fail } from './http';
import { getBookChunk } from './uploads';

export const collectBookBytes = async (bookId: string, chunkCount: number): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (let i = 0; i < chunkCount; i += 1) {
    const chunk = await getBookChunk(bookId, i);
    if (!chunk) {
      fail(500, `Stored chunk ${i} is missing for this book.`);
    }
    chunks.push(chunk);
    totalBytes += chunk.byteLength;
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
};
