import { deleteBookChunks } from './_lib/uploads';
import { getDb } from './_lib/turso';
import { noContent } from './_lib/http';

type FileRow = {
  file_storage: string | null;
  chunk_count: number | null;
};

export const handleBooksDelete = async (bookId: string): Promise<Response> => {
  const db = getDb();

  const fileResult = await db.execute({
    sql: 'SELECT file_storage, chunk_count FROM books WHERE id = ? LIMIT 1',
    args: [bookId],
  });

  const fileRow = fileResult.rows[0] as unknown as FileRow | undefined;

  await db.batch([
    {
      sql: 'DELETE FROM reading_progress WHERE book_id = ?',
      args: [bookId],
    },
    {
      sql: 'DELETE FROM books WHERE id = ?',
      args: [bookId],
    },
  ]);

  if (fileRow?.file_storage === 'netlify-blobs' && fileRow.chunk_count && fileRow.chunk_count > 0) {
    await deleteBookChunks(bookId, Number(fileRow.chunk_count));
  }

  return noContent();
};
