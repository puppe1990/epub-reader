import { z } from 'zod';
import { fail, json, readJson } from './_lib/http';
import { deleteUploadTempData, getUploadMetadata, getUploadChunk } from './_lib/uploads';
import { createStoredBook } from './_lib/books';

const schema = z.object({
  uploadId: z.string().uuid(),
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  format: z.enum(['epub', 'pdf']),
  coverUrl: z.string().url().optional(),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
  chunkCount: z.number().int().positive(),
});

export const handleUploadsComplete = async (req: Request): Promise<Response> => {
  const payload = schema.safeParse(await readJson(req));
  if (!payload.success) {
    fail(400, 'Invalid upload complete payload.');
  }

  const data = payload.data;
  const uploadMetadata = await getUploadMetadata(data.uploadId);
  if (!uploadMetadata) {
    fail(404, 'Upload session not found.');
  }

  if (uploadMetadata.sizeBytes !== data.sizeBytes) {
    fail(400, 'sizeBytes mismatch for upload session.');
  }

  let uploadedBytes = 0;
  const uploadedChunks: Uint8Array[] = [];
  for (let i = 0; i < data.chunkCount; i += 1) {
    const chunk = await getUploadChunk(data.uploadId, i);
    if (!chunk) {
      fail(400, `Missing chunk ${i}.`);
    }
    uploadedChunks.push(chunk);
    uploadedBytes += chunk.byteLength;
  }

  if (uploadedBytes !== data.sizeBytes) {
    fail(400, 'Uploaded chunks size does not match sizeBytes.');
  }

  const fullFileBytes = new Uint8Array(uploadedBytes);
  let offset = 0;
  for (const chunk of uploadedChunks) {
    fullFileBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const createdBook = await createStoredBook({
    title: data.title,
    author: data.author,
    format: data.format,
    mimeType: data.mimeType,
    sizeBytes: data.sizeBytes,
    fileBytes: fullFileBytes,
    coverUrl: data.coverUrl,
  });

  await deleteUploadTempData(data.uploadId, data.chunkCount);

  return json(createdBook, 201);
};
