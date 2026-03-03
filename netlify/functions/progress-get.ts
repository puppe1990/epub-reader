import { getDb } from './_lib/turso';
import { json } from './_lib/http';

type ProgressRow = {
  location_cfi: string;
  href: string | null;
  updated_at: number;
};

export const handleProgressGet = async (bookId: string): Promise<Response> => {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT location_cfi, href, updated_at FROM reading_progress WHERE book_id = ? LIMIT 1',
    args: [bookId],
  });

  const row = result.rows[0] as unknown as ProgressRow | undefined;
  if (!row) {
    return json(null);
  }

  return json({
    locationCfi: row.location_cfi,
    href: row.href ?? undefined,
    updatedAt: Number(row.updated_at),
  });
};
