import { getDb } from './_lib/turso';
import { json } from './_lib/http';

type BookRow = {
  id: string;
  title: string;
  author: string;
  format: 'epub' | 'pdf';
  cover_url: string | null;
  added_at: number;
  size_bytes: number;
};

export const handleBooksList = async (): Promise<Response> => {
  const db = getDb();
  const result = await db.execute(`
    SELECT id, title, author, format, cover_url, added_at, size_bytes
    FROM books
    ORDER BY added_at DESC
  `);

  const books = result.rows.map((row) => {
    const book = row as unknown as BookRow;
    return {
      id: String(book.id),
      title: String(book.title),
      author: String(book.author),
      format: book.format,
      coverUrl: book.cover_url ?? undefined,
      addedAt: Number(book.added_at),
      sizeBytes: Number(book.size_bytes),
    };
  });

  return json(books);
};
