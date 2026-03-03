import { collectBookBytes } from './_lib/book-bytes';
import { getDb } from './_lib/turso';
import { fail, json } from './_lib/http';

type BookDataRow = {
  mime_type: string;
  file_blob: Uint8Array | ArrayBuffer | null;
  file_storage: string | null;
  chunk_count: number | null;
  id: string;
};

const toUint8Array = (value: Uint8Array | ArrayBuffer): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(value);
};

const hasBlobPayload = (value: Uint8Array | ArrayBuffer | null): boolean => {
  if (!value) return false;
  return toUint8Array(value).byteLength > 0;
};

export const handleBooksData = async (bookId: string): Promise<Response> => {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT id, mime_type, file_blob, file_storage, chunk_count FROM books WHERE id = ? LIMIT 1',
    args: [bookId],
  });

  const row = result.rows[0] as unknown as BookDataRow | undefined;
  if (!row) {
    fail(404, 'Book not found.');
  }

  let fileBytes: Uint8Array;
  if (row.file_storage === 'netlify-blobs' && row.chunk_count && row.chunk_count > 0) {
    try {
      fileBytes = await collectBookBytes(bookId, Number(row.chunk_count));
    } catch (chunkError) {
      if (hasBlobPayload(row.file_blob)) {
        fileBytes = toUint8Array(row.file_blob as Uint8Array | ArrayBuffer);
      } else {
        console.error(chunkError);
        fail(409, 'This book file is unavailable in the current environment. Please re-upload it.');
      }
    }
  } else if (row.file_blob) {
    fileBytes = toUint8Array(row.file_blob);
  } else {
    fail(500, 'Book file data is missing.');
  }

  return json({
    mimeType: row.mime_type,
    fileBase64: Buffer.from(fileBytes).toString('base64'),
  });
};
