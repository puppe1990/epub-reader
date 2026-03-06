import { v4 as uuidv4 } from 'uuid';
import { getDb } from './turso';
import { saveBookChunk } from './uploads';

const BOOK_CHUNK_SIZE = 1024 * 1024;

interface CreateStoredBookInput {
  title: string;
  author: string;
  format: 'epub' | 'pdf';
  mimeType: string;
  sizeBytes: number;
  fileBytes: Uint8Array;
  coverUrl?: string;
}

export const createStoredBook = async ({
  title,
  author,
  format,
  mimeType,
  sizeBytes,
  fileBytes,
  coverUrl,
}: CreateStoredBookInput) => {
  const id = uuidv4();
  const addedAt = Date.now();
  const chunkCount = Math.max(1, Math.ceil(fileBytes.byteLength / BOOK_CHUNK_SIZE));

  for (let index = 0; index < chunkCount; index += 1) {
    const start = index * BOOK_CHUNK_SIZE;
    const end = Math.min(start + BOOK_CHUNK_SIZE, fileBytes.byteLength);
    await saveBookChunk(id, index, fileBytes.slice(start, end));
  }

  const db = getDb();
  await db.execute({
    sql: `
      INSERT INTO books (
        id, title, author, format, cover_url, mime_type, size_bytes, file_blob, added_at, file_storage, file_key, chunk_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      title,
      author,
      format,
      coverUrl ?? null,
      mimeType,
      sizeBytes,
      fileBytes,
      addedAt,
      'netlify-blobs',
      `books/${id}/chunks`,
      chunkCount,
    ],
  });

  return {
    id,
    title,
    author,
    format,
    coverUrl,
    addedAt,
    sizeBytes,
  };
};
