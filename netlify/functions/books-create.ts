import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './_lib/turso';
import { fail, json, readJson } from './_lib/http';

const MAX_BYTES = 25 * 1024 * 1024;

const schema = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  format: z.enum(['epub', 'pdf']),
  coverUrl: z.string().url().optional(),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
  fileBase64: z.string().min(1),
});

export const handleBooksCreate = async (req: Request): Promise<Response> => {
  const payload = schema.safeParse(await readJson(req));
  if (!payload.success) {
    fail(400, 'Invalid request payload.');
  }

  const { title, author, format, coverUrl, mimeType, sizeBytes, fileBase64 } = payload.data;

  if (sizeBytes > MAX_BYTES) {
    fail(413, `File too large. Max size is ${MAX_BYTES} bytes.`);
  }

  const fileBytes = Buffer.from(fileBase64, 'base64');
  if (fileBytes.byteLength !== sizeBytes) {
    fail(400, 'sizeBytes does not match decoded file size.');
  }

  const id = uuidv4();
  const addedAt = Date.now();
  const db = getDb();

  await db.execute({
    sql: `
      INSERT INTO books (id, title, author, format, cover_url, mime_type, size_bytes, file_blob, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [id, title, author, format, coverUrl ?? null, mimeType, sizeBytes, fileBytes, addedAt],
  });

  return json(
    {
      id,
      title,
      author,
      format,
      coverUrl,
      addedAt,
      sizeBytes,
    },
    201,
  );
};
