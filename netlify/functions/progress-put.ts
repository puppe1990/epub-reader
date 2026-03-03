import { z } from 'zod';
import { getDb } from './_lib/turso';
import { fail, json, readJson } from './_lib/http';

const schema = z.object({
  locationCfi: z.string().trim().min(1),
  href: z.string().trim().optional(),
  updatedAtClient: z.number().int().positive().optional(),
});

export const handleProgressPut = async (req: Request, bookId: string): Promise<Response> => {
  const payload = schema.safeParse(await readJson(req));
  if (!payload.success) {
    fail(400, 'Invalid progress payload.');
  }

  const updatedAt = payload.data.updatedAtClient ?? Date.now();
  const db = getDb();

  await db.execute({
    sql: `
      INSERT INTO reading_progress (book_id, location_cfi, href, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(book_id)
      DO UPDATE SET
        location_cfi = excluded.location_cfi,
        href = excluded.href,
        updated_at = excluded.updated_at
    `,
    args: [bookId, payload.data.locationCfi, payload.data.href ?? null, updatedAt],
  });

  return json({
    bookId,
    locationCfi: payload.data.locationCfi,
    href: payload.data.href,
    updatedAt,
  });
};
