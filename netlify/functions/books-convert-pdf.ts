import { collectBookBytes } from './_lib/book-bytes';
import { createStoredBook } from './_lib/books';
import { fail, json } from './_lib/http';
import { convertPdfBytesToEpub } from './_lib/pdf-to-epub';
import { getDb } from './_lib/turso';

type BookRow = {
  id: string;
  title: string;
  author: string;
  format: 'epub' | 'pdf';
  mime_type: string;
  file_blob: Uint8Array | ArrayBuffer | null;
  file_storage: string | null;
  chunk_count: number | null;
};

const toUint8Array = (value: Uint8Array | ArrayBuffer): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(value);
};

export const handleBooksConvertPdf = async (bookId: string): Promise<Response> => {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT id, title, author, format, mime_type, file_blob, file_storage, chunk_count
      FROM books
      WHERE id = ?
      LIMIT 1
    `,
    args: [bookId],
  });

  const row = result.rows[0] as unknown as BookRow | undefined;
  if (!row) fail(404, 'Book not found.');
  if (row.format !== 'pdf') fail(400, 'Only PDF books can be converted.');

  let sourceBytes: Uint8Array;
  if (row.file_storage === 'netlify-blobs' && row.chunk_count && row.chunk_count > 0) {
    sourceBytes = await collectBookBytes(bookId, Number(row.chunk_count));
  } else if (row.file_blob) {
    sourceBytes = toUint8Array(row.file_blob);
  } else {
    fail(500, 'PDF source bytes are missing.');
  }

  const epubBytes = await convertPdfBytesToEpub(sourceBytes, {
    title: `${row.title} (Convertido)`,
    author: row.author,
  });

  const createdBook = await createStoredBook({
    title: `${row.title} (Convertido)`,
    author: row.author,
    format: 'epub',
    mimeType: 'application/epub+zip',
    sizeBytes: epubBytes.byteLength,
    fileBytes: epubBytes,
  });

  return json(createdBook, 201);
};
