import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { fail, json, readJson } from './_lib/http';
import { saveUploadMetadata } from './_lib/uploads';

const MAX_BYTES = 25 * 1024 * 1024;
const CHUNK_SIZE = 1024 * 1024;

const schema = z.object({
  sizeBytes: z.number().int().positive(),
});

export const handleUploadsInit = async (req: Request): Promise<Response> => {
  const payload = schema.safeParse(await readJson(req));
  if (!payload.success) {
    fail(400, 'Invalid upload init payload.');
  }

  if (payload.data.sizeBytes > MAX_BYTES) {
    fail(413, 'File too large. Max size is 25MB.');
  }

  const uploadId = uuidv4();
  await saveUploadMetadata(uploadId, {
    sizeBytes: payload.data.sizeBytes,
    createdAt: Date.now(),
  });

  return json({
    uploadId,
    chunkSize: CHUNK_SIZE,
    maxSizeBytes: MAX_BYTES,
  }, 201);
};
